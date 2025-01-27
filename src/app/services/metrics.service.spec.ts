import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MetricsService, Metric, MetricInfo } from './metrics.service';
import { WebsocketService } from './websocket.service';
import { TimeFormatService } from './time-format.service';
import { firstValueFrom } from 'rxjs';

/**
 * Mock WebSocket service for testing MetricsService.
 * Provides mock responses for system.metrics requests.
 */
class MockWebsocketService {
    request = jasmine.createSpy('request').and.returnValue(Promise.resolve({
        payload: {
            metrics: {
                'test.metric': {
                    name: 'test.metric',
                    type: 'gauge',
                    timestamp: '2024-01-01T00:00:00Z',
                    value: 42
                }
            }
        }
    }));
}

/**
 * Mock TimeFormat service for testing MetricsService.
 * Provides mock time formatting functionality.
 */
class MockTimeFormatService {
    renderElapsedTime = jasmine.createSpy('renderElapsedTime').and.returnValue('1h 2m 3s');
}

/**
 * Test suite for MetricsService.
 * Tests the functionality for polling, managing, and formatting metrics.
 */
describe('MetricsService', () => {
    let service: MetricsService;
    let mockWebsocketService: MockWebsocketService;
    let mockTimeFormatService: MockTimeFormatService;
    let consoleErrorSpy: jasmine.Spy;

    beforeEach(() => {
        mockWebsocketService = new MockWebsocketService();
        mockTimeFormatService = new MockTimeFormatService();
        consoleErrorSpy = spyOn(console, 'error');

        TestBed.configureTestingModule({
            providers: [
                MetricsService,
                { provide: WebsocketService, useValue: mockWebsocketService },
                { provide: TimeFormatService, useValue: mockTimeFormatService }
            ]
        });

        service = TestBed.inject(MetricsService);
    });

    afterEach(() => {
        consoleErrorSpy.calls.reset();
    });

    /**
     * Tests for service initialization and setup.
     * Verifies that the service is created correctly and starts polling metrics.
     */
    describe('initialization', () => {
        /**
         * Verifies that the service is created successfully.
         */
        it('should be created', () => {
            expect(service).toBeTruthy();
        });

        /**
         * Verifies that the service starts polling metrics on creation.
         * Checks that the WebSocket service is called with correct parameters.
         */
        it('should start polling on creation', fakeAsync(() => {
            tick(1000);
            expect(mockWebsocketService.request).toHaveBeenCalledWith('system.metrics', { showAll: true });
        }));
    });

    /**
     * Tests for metrics polling functionality.
     * Verifies polling behavior, error handling, and loading state management.
     */
    describe('metrics polling', () => {
        beforeEach(() => {
            service.clearHistory();
            mockWebsocketService.request.calls.reset();
        });

        /**
         * Verifies that metrics are updated correctly when polling.
         * Checks that received metrics are stored and accessible.
         */
        it('should update metrics when polling', async () => {
            await service.refresh();
            const metrics = service.getCurrentMetrics();
            expect(metrics.length).toBe(1);
            expect(metrics[0]).toEqual(jasmine.objectContaining({
                name: 'test.metric',
                type: 'gauge',
                value: 42
            }));
        });

        /**
         * Tests error handling during metrics polling.
         * Verifies that:
         * 1. Existing metrics are preserved on error
         * 2. Error is logged correctly
         * 3. Service continues to function after error
         */
        it('should handle polling errors gracefully', async () => {
            // First get some initial metrics
            await service.refresh();
            let metrics = await firstValueFrom(service.metrics$);
            expect(metrics.length).toBe(1);

            // Then test error handling
            mockWebsocketService.request.and.returnValue(Promise.reject(new Error('Test error')));
            await service.refresh();
            metrics = await firstValueFrom(service.metrics$);
            expect(metrics.length).toBe(1);

            // Verify error was logged
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error polling metrics:', jasmine.any(Error));

            // Reset the mock for other tests
            mockWebsocketService.request.and.callFake(async (method: string, params: any) => {
                return Promise.resolve({
                    payload: {
                        metrics: {
                            'test.metric': {
                                name: 'test.metric',
                                type: 'gauge',
                                timestamp: '2024-01-01T00:00:00Z',
                                value: 42
                            }
                        }
                    }
                });
            });
        });

        /**
         * Tests the loading state management during polling.
         * Verifies that loading states transition correctly:
         * [false, true, false] - initial, loading, complete
         */
        it('should update loading state during polling', async () => {
            const loadingStates: boolean[] = [];
            const subscription = service.loading$.subscribe(state => loadingStates.push(state));

            // Clear any initial states
            loadingStates.length = 0;

            // Wait for any pending operations to complete
            await new Promise(resolve => setTimeout(resolve, 0));

            // Capture loading states during refresh
            await service.refresh();
            subscription.unsubscribe();

            // Loading states should be [false, true, false] since we start with false,
            // then set to true during polling, and finally back to false
            expect(loadingStates).toEqual([false, true, false]);
        });
    });

    /**
     * Tests for metric retrieval and formatting functionality.
     * Verifies different metric type formatting and retrieval methods.
     */
    describe('metric retrieval and formatting', () => {
        beforeEach(async () => {
            service.clearHistory();
            await service.refresh();
        });

        /**
         * Tests retrieval of specific metrics by name.
         * Verifies that metrics can be accessed individually.
         */
        it('should get specific metric by name', () => {
            const metric = service.getMetric('test.metric');
            expect(metric).toBeDefined();
            expect(metric?.name).toBe('test.metric');
        });

        /**
         * Verifies behavior when requesting non-existent metrics.
         * Should return undefined for unknown metric names.
         */
        it('should return undefined for non-existent metric', () => {
            const metric = service.getMetric('non.existent');
            expect(metric).toBeUndefined();
        });

        /**
         * Tests formatting of percentage metrics.
         * Verifies that percentage values are formatted with % symbol.
         */
        it('should format percent metrics correctly', () => {
            const metric: Metric = {
                name: 'test.percent',
                type: 'percent',
                timestamp: new Date(),
                value: 0.756
            };
            expect(service.getMetricDisplayValue(metric)).toBe('75.6%');
        });

        /**
         * Tests formatting of rate metrics.
         * Verifies that rate values are formatted with /s suffix.
         */
        it('should format rate metrics correctly', () => {
            const metric: Metric = {
                name: 'test.rate',
                type: 'rate',
                timestamp: new Date(),
                value: 42.5
            };
            expect(service.getMetricDisplayValue(metric)).toBe('42.5/s');
        });

        /**
         * Tests formatting of uptime metrics.
         * Verifies that uptime values are formatted using TimeFormatService.
         */
        it('should format uptime metrics correctly', () => {
            const metric: Metric = {
                name: 'test.uptime',
                type: 'uptime',
                timestamp: new Date(),
                value: 3600
            };
            expect(service.getMetricDisplayValue(metric)).toBe('1h 2m 3s');
            expect(mockTimeFormatService.renderElapsedTime).toHaveBeenCalledWith(3600000);
        });
    });

    /**
     * Tests for metric history management.
     * Verifies storage, retrieval, and management of metric history.
     */
    describe('metric history', () => {
        beforeEach(() => {
            service.clearHistory();
            mockWebsocketService.request.calls.reset();
        });

        /**
         * Tests metric history maintenance.
         * Verifies that multiple metric updates are stored correctly.
         */
        it('should maintain metric history', async () => {
            // First update
            await service.refresh();

            // Second update with different value
            mockWebsocketService.request.and.returnValue(Promise.resolve({
                payload: {
                    metrics: {
                        'test.metric': {
                            name: 'test.metric',
                            type: 'gauge',
                            timestamp: '2024-01-01T00:00:01Z',
                            value: 43
                        }
                    }
                }
            }));
            await service.refresh();

            const history = service.getMetricHistory('test.metric');
            expect(history.length).toBe(2);
            expect(history[0].value).toBe(42);
            expect(history[1].value).toBe(43);
        });

        /**
         * Tests history clearing functionality.
         * Verifies that clearHistory removes all stored metrics.
         */
        it('should clear history when requested', async () => {
            await service.refresh();
            expect(service.getCurrentMetrics().length).toBe(1);

            service.clearHistory();
            expect(service.getCurrentMetrics().length).toBe(0);
            expect(service.getMetricHistory('test.metric').length).toBe(0);
        });

        /**
         * Tests duplicate timestamp handling in history.
         * Verifies that metrics with duplicate timestamps are not stored multiple times.
         */
        it('should filter out duplicate timestamps in history', async () => {
            // First update
            await service.refresh();

            // Second update with same timestamp
            await service.refresh();

            const history = service.getMetricHistory('test.metric');
            expect(history.length).toBe(1);
        });
    });

    /**
     * Tests for service cleanup.
     * Verifies that resources are properly released on service destruction.
     */
    describe('cleanup', () => {
        /**
         * Tests cleanup on service destruction.
         * Verifies that polling stops when service is destroyed.
         */
        it('should stop polling and clean up on destroy', fakeAsync(() => {
            const initialCallCount = mockWebsocketService.request.calls.count();
            service.ngOnDestroy();
            tick(2000);
            expect(mockWebsocketService.request.calls.count()).toBe(initialCallCount);
        }));
    });
});