import { TestBed } from '@angular/core/testing';
import { LogService, LogLevel, LogEntry } from './log.service';
import { WebsocketService } from './websocket.service';
import { BehaviorSubject } from 'rxjs';

/**
 * Mock WebSocket service for testing LogService
 */
class MockWebsocketService {
    private messageCallback: Function | undefined;

    connected$ = {
        on: jasmine.createSpy('on'),
        off: jasmine.createSpy('off')
    };
    message$ = {
        on: jasmine.createSpy('on').and.callFake((event: string, callback: Function) => {
            this.messageCallback = callback;
        }),
        off: jasmine.createSpy('off')
    };
    waitForReady = jasmine.createSpy('waitForReady').and.returnValue(Promise.resolve());
    request = jasmine.createSpy('request').and.returnValue(Promise.resolve({ success: true }));

    // Helper method to trigger the message callback
    triggerMessage(header: any, payload: any) {
        if (this.messageCallback) {
            this.messageCallback(header, payload);
        }
    }
}

/**
 * Test suite for LogService
 */
describe('LogService', () => {
    let service: LogService;
    let mockWebsocketService: MockWebsocketService;

    beforeEach(async () => {
        mockWebsocketService = new MockWebsocketService();
        TestBed.configureTestingModule({
            providers: [
                LogService,
                { provide: WebsocketService, useValue: mockWebsocketService }
            ]
        });
        service = TestBed.inject(LogService);
        // Wait for initialization to complete
        await new Promise(resolve => setTimeout(resolve, 0));
    });

    /**
     * Test initialization and setup
     */
    describe('initialization', () => {
        it('should be created', () => {
            expect(service).toBeTruthy();
        });

        it('should wait for websocket to be ready during initialization', () => {
            expect(mockWebsocketService.waitForReady).toHaveBeenCalled();
        });

        it('should set up event listeners', () => {
            expect(mockWebsocketService.connected$.on).toHaveBeenCalled();
            expect(mockWebsocketService.message$.on).toHaveBeenCalledWith('response:system.log:1.0.0', jasmine.any(Function));
        });
    });

    /**
     * Test log level management
     */
    describe('log level management', () => {
        it('should initialize with INFO as default minimum log level', () => {
            expect(service.getMinLogLevel()).toBe(LogLevel.INFO);
        });

        it('should update minimum log level', () => {
            service.setMinLogLevel(LogLevel.DEBUG);
            expect(service.getMinLogLevel()).toBe(LogLevel.DEBUG);
        });

        it('should trigger log subscription update when changing log level', () => {
            mockWebsocketService.request.calls.reset();
            service.setMinLogLevel(LogLevel.WARN);
            expect(mockWebsocketService.request).toHaveBeenCalledWith(
                'system.log.subscribe',
                { levels: [LogLevel.WARN, LogLevel.ERROR] }
            );
        });
    });

    /**
     * Test log management functionality
     */
    describe('log management', () => {
        beforeEach(() => {
            service.clearLogs();
        });

        it('should add a log entry when receiving a valid log message', () => {
            const mockLog = {
                level: LogLevel.INFO,
                module: 'test',
                message: 'test message'
            };

            mockWebsocketService.triggerMessage({}, mockLog);

            const logs = service.getCachedLogs();
            expect(logs.length).toBe(1);
            expect(logs[0]).toEqual(jasmine.objectContaining({
                level: LogLevel.INFO,
                module: 'test',
                message: 'test message'
            }));
        });

        it('should ignore logs below minimum level', () => {
            service.setMinLogLevel(LogLevel.WARN);

            const mockLog = {
                level: LogLevel.INFO,
                module: 'test',
                message: 'test message'
            };

            mockWebsocketService.triggerMessage({}, mockLog);

            expect(service.getCachedLogs().length).toBe(0);
        });

        it('should clear logs when requested', () => {
            const mockLog = {
                level: LogLevel.INFO,
                module: 'test',
                message: 'test message'
            };

            mockWebsocketService.triggerMessage({}, mockLog);
            expect(service.getCachedLogs().length).toBe(1);

            service.clearLogs();
            expect(service.getCachedLogs().length).toBe(0);
        });

        it('should include additional fields as metadata', () => {
            const mockLog = {
                level: LogLevel.INFO,
                module: 'test',
                message: 'test message',
                extraField: 'extra value'
            };

            mockWebsocketService.triggerMessage({}, mockLog);

            const logs = service.getCachedLogs();
            expect(logs.length).toBe(1);
            expect(logs[0].meta).toBeDefined();
            expect(logs[0].meta.extraField).toBe('extra value');
        });
    });

    /**
     * Test cleanup and resource management
     */
    describe('cleanup', () => {
        it('should remove event listeners on destroy', () => {
            service.ngOnDestroy();
            expect(mockWebsocketService.connected$.off).toHaveBeenCalled();
            expect(mockWebsocketService.message$.off).toHaveBeenCalledWith('response:system.log:1.0.0', jasmine.any(Function));
        });
    });

    /**
     * Test refresh functionality
     */
    describe('refresh', () => {
        it('should trigger a log subscription refresh', async () => {
            mockWebsocketService.request.calls.reset();
            await service.refresh();
            expect(mockWebsocketService.request).toHaveBeenCalledWith(
                'system.log.subscribe',
                { levels: jasmine.any(Array) }
            );
        });
    });
});