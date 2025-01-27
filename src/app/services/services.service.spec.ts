import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ServicesService, ServiceInfo, ServiceStatus } from './services.service';
import { WebsocketService } from './websocket.service';
import { MetricsService } from './metrics.service';
import { firstValueFrom } from 'rxjs';

/**
 * Mock WebSocket service for testing ServicesService.
 * Provides mock responses for system.service.list and system.service.subscriptions requests.
 */
class MockWebsocketService {
    request = jasmine.createSpy('request').and.callFake(async (method: string, params: any) => {
        if (method === 'system.service.list') {
            return {
                payload: {
                    services: [
                        {
                            id: 'test-service-1',
                            name: 'Test Service 1',
                            description: 'Test Description 1',
                            connectedAt: '2024-01-01T00:00:00Z',
                            lastHeartbeat: '2024-01-01T00:00:01Z',
                            extraField: 'extra value'
                        }
                    ]
                }
            };
        } else if (method === 'system.service.subscriptions') {
            return {
                payload: {
                    subscriptions: [
                        { topic: 'test.topic', priority: 1 }
                    ]
                }
            };
        }
        return { payload: {} };
    });
}

/**
 * Mock Metrics service for testing ServicesService.
 * Provides mock metrics data for service-specific metrics.
 */
class MockMetricsService {
    getCurrentMetrics = jasmine.createSpy('getCurrentMetrics').and.returnValue([
        {
            name: 'metric.name{serviceid:test-service-1}',
            type: 'gauge',
            timestamp: new Date(),
            value: 42
        }
    ]);
}

/**
 * Test suite for ServicesService.
 * Tests the functionality for polling, managing, and monitoring services.
 */
describe('ServicesService', () => {
    let service: ServicesService;
    let mockWebsocketService: MockWebsocketService;
    let mockMetricsService: MockMetricsService;
    let consoleErrorSpy: jasmine.Spy;

    beforeEach(() => {
        mockWebsocketService = new MockWebsocketService();
        mockMetricsService = new MockMetricsService();
        consoleErrorSpy = spyOn(console, 'error');

        TestBed.configureTestingModule({
            providers: [
                ServicesService,
                { provide: WebsocketService, useValue: mockWebsocketService },
                { provide: MetricsService, useValue: mockMetricsService }
            ]
        });

        service = TestBed.inject(ServicesService);
    });

    afterEach(() => {
        consoleErrorSpy.calls.reset();
    });

    /**
     * Tests for service initialization and setup.
     * Verifies that the service is created correctly and starts polling services.
     */
    describe('initialization', () => {
        /**
         * Verifies that the service is created successfully.
         */
        it('should be created', () => {
            expect(service).toBeTruthy();
        });

        /**
         * Verifies that the service starts polling on creation.
         * Checks that the WebSocket service is called with correct parameters.
         */
        it('should start polling on creation', fakeAsync(() => {
            tick(5000);
            expect(mockWebsocketService.request).toHaveBeenCalledWith('system.service.list', {});
        }));
    });

    /**
     * Tests for service polling functionality.
     * Verifies polling behavior, error handling, and loading state management.
     */
    describe('service polling', () => {
        beforeEach(async () => {
            // Reset services to empty state
            await service.refresh();
            mockWebsocketService.request.calls.reset();
        });

        /**
         * Verifies that services are updated correctly when polling.
         * Checks that received services are stored and accessible.
         */
        it('should update services when polling', async () => {
            await service.refresh();
            const services = await firstValueFrom(service.services$);
            expect(services.length).toBe(1);
            expect(services[0]).toEqual(jasmine.objectContaining({
                id: 'test-service-1',
                name: 'Test Service 1',
                description: 'Test Description 1',
                status: 'connected'
            }));
        });

        /**
         * Tests error handling during service polling.
         * Verifies that:
         * 1. Existing services are preserved on error
         * 2. Error is logged correctly
         * 3. Service continues to function after error
         */
        it('should handle polling errors gracefully', async () => {
            // First get some initial services
            await service.refresh();
            let services = await firstValueFrom(service.services$);
            expect(services.length).toBe(1);

            // Then test error handling - services should be preserved on error
            mockWebsocketService.request.and.returnValue(Promise.reject(new Error('Test error')));
            await service.refresh();
            services = await firstValueFrom(service.services$);
            expect(services.length).toBe(1);

            // Verify error was logged
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error polling services:', jasmine.any(Error));

            // Reset the mock for other tests
            mockWebsocketService.request.and.callFake(async (method: string, params: any) => {
                if (method === 'system.service.list') {
                    return {
                        payload: {
                            services: [
                                {
                                    id: 'test-service-1',
                                    name: 'Test Service 1',
                                    description: 'Test Description 1',
                                    connectedAt: '2024-01-01T00:00:00Z',
                                    lastHeartbeat: '2024-01-01T00:00:01Z',
                                    extraField: 'extra value'
                                }
                            ]
                        }
                    };
                }
                return { payload: {} };
            });
        });

        /**
         * Tests the loading state management during polling.
         * Verifies that loading states transition correctly:
         * [true, false] - loading, complete
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

            // Loading states should be [true, false] since we start with true during polling,
            // and then back to false when done
            expect(loadingStates).toEqual([true, false]);
        });

        /**
         * Tests extraction of metadata from service responses.
         * Verifies that additional fields are stored in the meta property.
         */
        it('should extract metadata from service response', async () => {
            await service.refresh();
            const services = await firstValueFrom(service.services$);
            expect(services[0].meta).toBeDefined();
            expect(services[0].meta.extraField).toBe('extra value');
        });
    });

    /**
     * Tests for service retrieval and management functionality.
     * Verifies service lookup and status tracking.
     */
    describe('service management', () => {
        beforeEach(async () => {
            await service.refresh();
        });

        /**
         * Tests retrieval of specific services by ID.
         * Verifies that services can be accessed individually.
         */
        it('should get specific service by id', () => {
            const serviceInfo = service.getService('test-service-1');
            expect(serviceInfo).toBeDefined();
            expect(serviceInfo?.id).toBe('test-service-1');
        });

        /**
         * Verifies behavior when requesting non-existent services.
         * Should return undefined for unknown service IDs.
         */
        it('should return undefined for non-existent service', () => {
            const serviceInfo = service.getService('non-existent');
            expect(serviceInfo).toBeUndefined();
        });

        /**
         * Tests tracking of disconnected services.
         * Verifies that services are marked as disconnected when they disappear from updates.
         */
        it('should track disconnected services', async () => {
            // First update with service
            await service.refresh();

            // Second update without the service
            mockWebsocketService.request.and.returnValue(Promise.resolve({
                payload: {
                    services: []
                }
            }));
            await service.refresh();

            const services = await firstValueFrom(service.services$);
            const disconnectedService = services.find(s => s.id === 'test-service-1');
            expect(disconnectedService).toBeDefined();
            expect(disconnectedService?.status).toBe('disconnected');
        });
    });

    /**
     * Tests for service subscription functionality.
     * Verifies retrieval of service-specific subscriptions.
     */
    describe('service subscriptions', () => {
        /**
         * Tests fetching of service subscriptions.
         * Verifies that subscription data is retrieved correctly.
         */
        it('should fetch service subscriptions', async () => {
            const result = await service.fetchServiceSubscriptions('test-service-1');
            expect(result.subscriptions).toEqual([
                { topic: 'test.topic', priority: 1 }
            ]);
        });
    });

    /**
     * Tests for service metrics functionality.
     * Verifies retrieval of service-specific metrics.
     */
    describe('service metrics', () => {
        /**
         * Tests fetching of service metrics.
         * Verifies that metrics are filtered correctly by service ID.
         */
        it('should fetch service metrics', async () => {
            const metrics = await service.fetchServiceMetrics('test-service-1');
            expect(metrics.length).toBe(1);
            expect(metrics[0].name).toContain('serviceid:test-service-1');
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
            tick(10000);
            expect(mockWebsocketService.request.calls.count()).toBe(initialCallCount);
        }));
    });
});