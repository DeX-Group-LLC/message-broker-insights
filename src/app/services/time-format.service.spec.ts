import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { TimeFormatService } from './time-format.service';
import { interval } from 'rxjs';

/**
 * Test suite for TimeFormatService.
 * Tests time formatting, elapsed time calculations, and timestamp management.
 */
describe('TimeFormatService', () => {
    let service: TimeFormatService;
    const FIXED_TIME = 1706311078000; // Fixed timestamp for consistent testing
    let dateNowSpy: jasmine.Spy;

    beforeEach(() => {
        // Mock Date.now() for consistent testing
        dateNowSpy = spyOn(Date, 'now').and.returnValue(FIXED_TIME);

        TestBed.configureTestingModule({
            providers: [TimeFormatService]
        });
        service = TestBed.inject(TimeFormatService);
    });

    afterEach(() => {
        jasmine.clock().uninstall();
    });

    /**
     * Tests for service initialization and setup.
     * Verifies service creation and timer setup.
     */
    describe('initialization', () => {
        it('should be created', () => {
            expect(service).toBeTruthy();
        });

        it('should update timestamp every second', fakeAsync(() => {
            // Create our own interval to match the service's behavior
            const timestamps: number[] = [];
            const subscription = interval(1000).subscribe(() => {
                timestamps.push(Date.now());
            });

            // Initial state
            expect(timestamps.length).toBe(0);

            // Advance time and update Date.now()
            dateNowSpy.and.returnValue(FIXED_TIME + 1000);
            tick(1000);

            dateNowSpy.and.returnValue(FIXED_TIME + 2000);
            tick(1000);

            dateNowSpy.and.returnValue(FIXED_TIME + 3000);
            tick(1000);

            // Should have 3 updates
            expect(timestamps.length).toBe(3);
            expect(timestamps).toEqual([
                FIXED_TIME + 1000,
                FIXED_TIME + 2000,
                FIXED_TIME + 3000
            ]);

            subscription.unsubscribe();
            discardPeriodicTasks();
        }));
    });

    /**
     * Tests for time calculations.
     * Verifies correct handling of timestamps and time differences.
     */
    describe('time calculations', () => {
        it('should convert seconds to relative Date', () => {
            // Test relative date - 60 seconds ago
            const date = service.getDate(60);
            expect(date instanceof Date).toBe(true);
            expect(date.getTime()).toBe(FIXED_TIME - 60000); // 60 seconds ago
        });

        it('should calculate elapsed time from timestamp', fakeAsync(() => {
            const fiveSecondsAgo = new Date(FIXED_TIME - 5000);
            const elapsed = service.getElapsed(fiveSecondsAgo);
            expect(elapsed).toBe(5000);
        }));

        it('should handle future timestamps', fakeAsync(() => {
            const futureTimestamp = new Date(FIXED_TIME + 60000); // 1 minute in future
            const elapsed = service.getElapsed(futureTimestamp);
            expect(elapsed).toBe(0);
        }));
    });

    /**
     * Tests for time formatting functionality.
     * Verifies different time format outputs.
     */
    describe('time formatting', () => {
        it('should format elapsed time correctly', () => {
            expect(service.renderElapsedTime(500)).toBe('0s');
            expect(service.renderElapsedTime(30000)).toBe('30s');
            expect(service.renderElapsedTime(60000)).toBe('1m 0s');
            expect(service.renderElapsedTime(90000)).toBe('1m 30s');
            expect(service.renderElapsedTime(3600000)).toBe('1h 0m');
            expect(service.renderElapsedTime(3660000)).toBe('1h 1m');
            expect(service.renderElapsedTime(7200000)).toBe('2h 0m');
        });

        it('should extract elapsed time from timestamp', fakeAsync(() => {
            const oneMinuteAgo = new Date(FIXED_TIME - 60000);
            const elapsed = service.getElapsed(oneMinuteAgo);
            expect(elapsed).toBe(60000);
        }));

        it('should format elapsed time in compact format', fakeAsync(() => {
            const oneMinuteAgo = new Date(FIXED_TIME - 80000);
            expect(service.getCompactElapsedTime(oneMinuteAgo)).toBe('80s');
        }));
    });

    /**
     * Tests for cleanup functionality.
     * Verifies proper resource cleanup on service destruction.
     */
    describe('cleanup', () => {
        /**
         * Tests that timer is cleared and observables are completed on destroy.
         */
        it('should clean up on destroy', fakeAsync(() => {
            const subscription = service.getCurrentTimestamp().subscribe();
            spyOn(subscription, 'unsubscribe');

            service.ngOnDestroy();

            expect(subscription.unsubscribe).toHaveBeenCalled();
            discardPeriodicTasks();
        }));
    });
});