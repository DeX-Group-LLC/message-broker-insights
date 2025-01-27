import { DebounceTimer } from './debounce';

/**
 * Test suite for DebounceTimer class which provides debounced execution functionality
 */
describe('DebounceTimer', () => {
    let mockFn: jasmine.Spy;
    let timer: DebounceTimer<typeof mockFn>;

    beforeEach(() => {
        jasmine.clock().install();
        mockFn = jasmine.createSpy('mockFn');
    });

    afterEach(() => {
        jasmine.clock().uninstall();
    });

    /**
     * Tests for immediate execution when delay is <= 0
     */
    describe('immediate execution', () => {
        beforeEach(() => {
            timer = new DebounceTimer(mockFn, -1);
        });

        /**
         * Verifies that function executes immediately with delay <= 0
         */
        it('should execute immediately when delay is <= 0', () => {
            timer.execute('test');
            expect(mockFn).toHaveBeenCalledWith('test');
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        /**
         * Verifies that multiple calls execute immediately
         */
        it('should execute multiple calls immediately', () => {
            timer.execute('test1');
            timer.execute('test2');
            expect(mockFn).toHaveBeenCalledWith('test1');
            expect(mockFn).toHaveBeenCalledWith('test2');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });
    });

    /**
     * Tests for debounced execution with positive delay
     */
    describe('debounced execution', () => {
        const DELAY = 1000;

        beforeEach(() => {
            timer = new DebounceTimer(mockFn, DELAY);
        });

        /**
         * Verifies basic debouncing behavior
         */
        it('should execute immediately if no recent execution', () => {
            timer.execute('test1');
            expect(mockFn).toHaveBeenCalledWith('test1');
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        /**
         * Verifies that multiple calls within delay window use latest arguments
         */
        it('should wait for delay after recent execution', () => {
            // First call executes immediately
            timer.execute('test1');
            expect(mockFn).toHaveBeenCalledWith('test1');

            // Second call should wait
            timer.execute('test2');
            expect(mockFn).toHaveBeenCalledTimes(1);

            // After delay, second call executes
            jasmine.clock().tick(DELAY);
            expect(mockFn).toHaveBeenCalledWith('test2');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        /**
         * Verifies that function executes with remaining delay from last execution
         */
        it('should consider time since last execution', () => {
            timer.execute('test1');
            expect(mockFn).toHaveBeenCalledWith('test1');
            expect(mockFn).toHaveBeenCalledTimes(1);

            // Wait half the delay and execute again
            jasmine.clock().tick(DELAY / 2);
            timer.execute('test2');
            jasmine.clock().tick(DELAY);
            expect(mockFn).toHaveBeenCalledWith('test2');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });
    });

    /**
     * Tests for delay modification
     */
    describe('setDelay', () => {
        /**
         * Verifies that changing delay affects future executions
         */
        it('should update delay for future executions', () => {
            timer = new DebounceTimer(mockFn, 1000);
            timer.execute('test');
            expect(mockFn).toHaveBeenCalledWith('test');
            expect(mockFn).toHaveBeenCalledTimes(1);

            // Change delay and execute again
            timer.setDelay(500);
            timer.execute('test2');
            jasmine.clock().tick(500);
            expect(mockFn).toHaveBeenCalledWith('test2');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        /**
         * Verifies that changing delay to <= 0 executes immediately
         */
        it('should execute immediately when delay changed to <= 0', () => {
            timer = new DebounceTimer(mockFn, 1000);
            timer.execute('test');
            expect(mockFn).toHaveBeenCalledWith('test');

            timer.setDelay(-1);
            timer.execute('test2');
            expect(mockFn).toHaveBeenCalledWith('test2');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });
    });

    /**
     * Tests for cancellation functionality
     */
    describe('cancel', () => {
        /**
         * Verifies that pending execution can be cancelled
         */
        it('should not affect already executed calls', () => {
            timer = new DebounceTimer(mockFn, 1000);
            timer.execute('test');
            expect(mockFn).toHaveBeenCalledWith('test');

            timer.cancel();
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        /**
         * Verifies that cancel is safe to call multiple times
         */
        it('should be safe to call cancel multiple times', () => {
            timer = new DebounceTimer(mockFn, 1000);
            timer.execute('test');
            expect(mockFn).toHaveBeenCalledWith('test');

            timer.cancel();
            timer.cancel();
            expect(mockFn).toHaveBeenCalledTimes(1);
        });
    });
});