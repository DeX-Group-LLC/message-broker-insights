import { TestBed } from '@angular/core/testing';
import { TrackerService } from './tracker.service';
import { WebsocketService, ActionType, Message, BrokerHeader } from './websocket.service';
import { SingleEmitter } from '../utils/single-emitter';

describe('TrackerService', () => {
    let service: TrackerService;
    let mockWebsocketService: jasmine.SpyObj<WebsocketService>;
    let mockConnectedEmitter: SingleEmitter<() => void>;

    beforeEach(async () => {
        // Create mock SingleEmitter for connected$
        mockConnectedEmitter = new SingleEmitter<() => void>();

        // Create mock WebsocketService with all required methods
        mockWebsocketService = jasmine.createSpyObj('WebsocketService', [
            'waitForReady',
            'subscribe',
            'unsubscribe'  // Add unsubscribe mock
        ]);
        mockWebsocketService.connected$ = mockConnectedEmitter;
        mockWebsocketService.waitForReady.and.returnValue(Promise.resolve());

        TestBed.configureTestingModule({
            providers: [
                TrackerService,
                { provide: WebsocketService, useValue: mockWebsocketService }
            ]
        });

        service = TestBed.inject(TrackerService);
        // Wait for initialization to complete
        await service['initialize']();
    });

    afterEach(() => {
        // Clean up any subscriptions
        service.ngOnDestroy();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should initialize and subscribe to system.message', async () => {
        // Verify waitForReady was called
        expect(mockWebsocketService.waitForReady).toHaveBeenCalled();

        // Verify subscription was made
        expect(mockWebsocketService.subscribe).toHaveBeenCalledWith(
            ActionType.PUBLISH,
            'system.message',
            0,
            jasmine.any(Function)
        );
    });

    it('should maintain MAX_REQUESTS limit', () => {
        // Create more messages than MAX_REQUESTS
        const maxRequests = (service as any).MAX_REQUESTS;
        const timestamp = new Date().toISOString();

        for (let i = 0; i < maxRequests + 1; i++) {
            const message: Message = {
                header: {
                    requestId: `req-${i}`,
                    action: ActionType.PUBLISH,
                    topic: 'test.topic',
                    version: '1.0.0'
                },
                payload: {}
            };

            // Simulate message from client
            const clientMessage = {
                timestamp,
                from: 'test-service',
                message,
                timeout: 5000
            };

            // Call private handleMessage method
            (service as any).handleMessage({}, clientMessage);
        }

        // Verify queue size doesn't exceed MAX_REQUESTS
        expect(service.flows.length).toBe(maxRequests);
    });

    it('should track parent-child message relationships', () => {
        const timestamp = new Date().toISOString();
        const parentMessage: Message = {
            header: {
                requestId: 'parent-req',
                action: ActionType.PUBLISH,
                topic: 'test.topic',
                version: '1.0.0'
            },
            payload: {}
        };

        const childMessage: Message = {
            header: {
                requestId: 'child-req',
                parentRequestId: 'parent-req',
                action: ActionType.PUBLISH,
                topic: 'test.topic',
                version: '1.0.0'
            },
            payload: {}
        };

        // Simulate parent message
        (service as any).handleMessage({}, {
            timestamp,
            from: 'parent-service',
            message: parentMessage,
            timeout: 5000
        });

        // Simulate masked ID mapping from broker
        (service as any).flowMapMasked.set('parent-req', 'parent-req');

        // Simulate child message
        (service as any).handleMessage({}, {
            timestamp,
            from: 'child-service',
            message: childMessage,
            timeout: 5000
        });

        // Get the parent flow
        const parentFlow = service.flows.find(f => f.request.message.header.requestId === 'parent-req');

        // Verify parent-child relationship
        expect(parentFlow).toBeTruthy();
        expect(parentFlow?.childMessages?.length).toBe(1);
        expect(parentFlow?.childMessages?.[0].serviceId).toBe('child-service');
        expect(parentFlow?.childMessages?.[0].header.requestId).toBe('child-req');
    });

    it('should cleanup subscriptions on destroy', () => {
        service.ngOnDestroy();
        expect(mockWebsocketService.unsubscribe).toHaveBeenCalled();
    });
});