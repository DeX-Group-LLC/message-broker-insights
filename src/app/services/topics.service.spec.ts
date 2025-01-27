import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TopicsService, Topic, Subscriber } from './topics.service';
import { WebsocketService } from './websocket.service';
import { firstValueFrom } from 'rxjs';

/**
 * Mock WebSocket service for testing TopicsService.
 * Provides mock responses for system.topic.subscribers requests.
 */
class MockWebsocketService {
    request = jasmine.createSpy('request').and.returnValue(Promise.resolve({
        payload: {
            subscribers: {
                'test.topic': [
                    { serviceId: 'service-1', priority: 1 },
                    { serviceId: 'service-2', priority: 2 }
                ]
            }
        }
    }));
}

/**
 * Test suite for TopicsService.
 * Tests topic management, polling, and subscriber tracking.
 */
describe('TopicsService', () => {
    let service: TopicsService;
    let mockWebsocketService: MockWebsocketService;
    let consoleErrorSpy: jasmine.Spy;

    beforeEach(() => {
        mockWebsocketService = new MockWebsocketService();
        consoleErrorSpy = spyOn(console, 'error');

        TestBed.configureTestingModule({
            providers: [
                TopicsService,
                { provide: WebsocketService, useValue: mockWebsocketService }
            ]
        });

        service = TestBed.inject(TopicsService);
    });

    afterEach(() => {
        consoleErrorSpy.calls.reset();
    });

    /**
     * Tests for service initialization and setup.
     * Verifies service creation and polling setup.
     */
    describe('initialization', () => {
        /**
         * Verifies that the service is created successfully.
         */
        it('should be created', () => {
            expect(service).toBeTruthy();
        });

        /**
         * Tests that polling starts on service creation.
         */
        it('should start polling on creation', fakeAsync(() => {
            tick(5000);
            expect(mockWebsocketService.request).toHaveBeenCalledWith('system.topic.subscribers', {});
        }));
    });

    /**
     * Tests for topic polling functionality.
     * Verifies topic updates and error handling.
     */
    describe('topic polling', () => {
        /**
         * Tests successful topic update.
         * Verifies that topics are correctly parsed and stored.
         */
        it('should update topics when polling', async () => {
            await service.refresh();
            const topics = await firstValueFrom(service.topics$);
            expect(topics.length).toBe(1);
            expect(topics[0]).toEqual(jasmine.objectContaining({
                name: 'test.topic',
                subscriberCount: 2,
                subscribers: [
                    { serviceId: 'service-1', priority: 1 },
                    { serviceId: 'service-2', priority: 2 }
                ]
            }));
        });

        /**
         * Tests error handling during polling.
         * Verifies that errors are logged and existing topics are preserved.
         */
        it('should handle polling errors gracefully', async () => {
            // First get some initial topics
            await service.refresh();
            let topics = await firstValueFrom(service.topics$);
            expect(topics.length).toBe(1);

            // Then test error handling
            mockWebsocketService.request.and.returnValue(Promise.reject(new Error('Test error')));
            await service.refresh();
            topics = await firstValueFrom(service.topics$);
            expect(topics.length).toBe(1);

            // Verify error was logged
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error polling topics:', jasmine.any(Error));

            // Reset the mock for other tests
            mockWebsocketService.request.and.returnValue(Promise.resolve({
                payload: {
                    subscribers: {
                        'test.topic': [
                            { serviceId: 'service-1', priority: 1 },
                            { serviceId: 'service-2', priority: 2 }
                        ]
                    }
                }
            }));
        });

        /**
         * Tests loading state during polling.
         * Verifies that loading state is correctly updated.
         */
        it('should update loading state during polling', async () => {
            const loadingStates: boolean[] = [];
            const subscription = service.loading$.subscribe(state => loadingStates.push(state));

            // Wait for initial state to stabilize
            await new Promise(resolve => setTimeout(resolve, 0));
            loadingStates.length = 0;

            // Start polling
            await service.refresh();

            // Should be [true, false]
            expect(loadingStates).toEqual([true, false]);

            subscription.unsubscribe();
        });
    });

    /**
     * Tests for topic management functionality.
     * Verifies topic tracking and updates.
     */
    describe('topic management', () => {
        beforeEach(async () => {
            await service.refresh();
        });

        /**
         * Tests topic addition and removal.
         * Verifies that topics are correctly tracked when they appear and disappear.
         */
        it('should handle topic addition and removal', async () => {
            // Add a new topic
            mockWebsocketService.request.and.returnValue(Promise.resolve({
                payload: {
                    subscribers: {
                        'test.topic': [
                            { serviceId: 'service-1', priority: 1 }
                        ],
                        'new.topic': [
                            { serviceId: 'service-3', priority: 1 }
                        ]
                    }
                }
            }));
            await service.refresh();
            let topics = service.getTopics();
            expect(topics.length).toBe(2);
            expect(topics.find(t => t.name === 'new.topic')).toBeDefined();

            // Remove a topic
            mockWebsocketService.request.and.returnValue(Promise.resolve({
                payload: {
                    subscribers: {
                        'test.topic': [
                            { serviceId: 'service-1', priority: 1 }
                        ]
                    }
                }
            }));
            await service.refresh();
            topics = service.getTopics();
            expect(topics.length).toBe(1);
            expect(topics.find(t => t.name === 'new.topic')).toBeUndefined();
        });

        /**
         * Tests subscriber updates.
         * Verifies that subscriber lists are correctly updated.
         */
        it('should update subscriber information', async () => {
            // Update subscribers
            mockWebsocketService.request.and.returnValue(Promise.resolve({
                payload: {
                    subscribers: {
                        'test.topic': [
                            { serviceId: 'service-1', priority: 2 }, // Changed priority
                            { serviceId: 'service-3', priority: 1 }  // New subscriber
                        ]
                    }
                }
            }));
            await service.refresh();
            const topics = service.getTopics();
            const topic = topics.find(t => t.name === 'test.topic');
            expect(topic?.subscribers.length).toBe(2);
            expect(topic?.subscribers.find(s => s.serviceId === 'service-1')?.priority).toBe(2);
            expect(topic?.subscribers.find(s => s.serviceId === 'service-3')).toBeDefined();
        });
    });

    /**
     * Tests for cleanup functionality.
     * Verifies proper resource cleanup on service destruction.
     */
    describe('cleanup', () => {
        /**
         * Tests that polling stops and observables are completed on destroy.
         */
        it('should clean up on destroy', fakeAsync(() => {
            const initialCallCount = mockWebsocketService.request.calls.count();
            service.ngOnDestroy();
            tick(10000);
            expect(mockWebsocketService.request.calls.count()).toBe(initialCallCount);
        }));
    });
});