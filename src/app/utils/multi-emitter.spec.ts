import { MultiEmitter } from './multi-emitter';

/**
 * Test suite for MultiEmitter class which provides debounced event emission for multiple event types
 */
describe('MultiEmitter', () => {
    let emitter: MultiEmitter<(data: string) => void>;
    let callback: jasmine.Spy;

    beforeEach(() => {
        jasmine.clock().install();
        callback = jasmine.createSpy('callback');
    });

    afterEach(() => {
        jasmine.clock().uninstall();
    });

    /**
     * Tests for immediate event emission
     */
    describe('immediate emission', () => {
        beforeEach(() => {
            emitter = new MultiEmitter(-1);
        });

        /**
         * Verifies that events are emitted immediately with negative delay
         */
        it('should emit events immediately with negative delay', () => {
            emitter.on('test', callback);
            emitter.emit('test', 'data');

            expect(callback).toHaveBeenCalledWith('data');
            expect(callback).toHaveBeenCalledTimes(1);
        });

        /**
         * Verifies that multiple listeners for same event receive events
         */
        it('should emit to multiple listeners for same event', () => {
            const callback2 = jasmine.createSpy('callback2');

            emitter.on('test', callback);
            emitter.on('test', callback2);
            emitter.emit('test', 'data');

            expect(callback).toHaveBeenCalledWith('data');
            expect(callback2).toHaveBeenCalledWith('data');
        });

        /**
         * Verifies that events don't trigger unrelated listeners
         */
        it('should not trigger listeners of other events', () => {
            emitter.on('test1', callback);
            emitter.emit('test2', 'data');

            expect(callback).not.toHaveBeenCalled();
        });
    });

    /**
     * Tests for debounced event emission
     */
    describe('debounced emission', () => {
        const DELAY = 1000;

        beforeEach(() => {
            emitter = new MultiEmitter(DELAY);
        });

        /**
         * Verifies basic debouncing behavior
         */
        it('should emit immediately if no recent emission', () => {
            emitter.on('test', callback);
            emitter.emit('test', 'data1');

            expect(callback).toHaveBeenCalledWith('data1');
            expect(callback).toHaveBeenCalledTimes(1);
        });

        /**
         * Verifies that only the latest event is emitted after delay
         */
        it('should wait for delay after recent emission', () => {
            emitter.on('test', callback);

            // First emission is immediate
            emitter.emit('test', 'data1');
            expect(callback).toHaveBeenCalledWith('data1');

            // Second emission should wait
            emitter.emit('test', 'data2');
            expect(callback).toHaveBeenCalledTimes(1);

            // After delay, second emission happens
            jasmine.clock().tick(DELAY);
            expect(callback).toHaveBeenCalledWith('data2');
            expect(callback).toHaveBeenCalledTimes(2);
        });

        /**
         * Verifies that different events are debounced independently
         */
        it('should debounce each event type independently', () => {
            const callback2 = jasmine.createSpy('callback2');
            emitter.on('test1', callback);
            emitter.on('test2', callback2);

            // First emissions are immediate
            emitter.emit('test1', 'data1');
            expect(callback).toHaveBeenCalledWith('data1');
            expect(callback).toHaveBeenCalledTimes(1);

            emitter.emit('test2', 'data2');
            expect(callback2).toHaveBeenCalledWith('data2');
            expect(callback2).toHaveBeenCalledTimes(1);

            // Second emissions should wait
            emitter.emit('test1', 'data3');
            emitter.emit('test2', 'data4');
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1);

            // After delay, both second emissions happen
            jasmine.clock().tick(DELAY);
            expect(callback).toHaveBeenCalledWith('data3');
            expect(callback2).toHaveBeenCalledWith('data4');
            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback2).toHaveBeenCalledTimes(2);
        });
    });

    /**
     * Tests for one-time event subscription
     */
    describe('once', () => {
        /**
         * Verifies that once listeners are called only once
         */
        it('should call listener only once', () => {
            emitter = new MultiEmitter(-1);
            emitter.once('test', callback);

            emitter.emit('test', 'data1');
            emitter.emit('test', 'data2');

            expect(callback).toHaveBeenCalledWith('data1');
            expect(callback).toHaveBeenCalledTimes(1);
        });

        /**
         * Verifies that once listeners work with debouncing
         */
        it('should work with debouncing', () => {
            emitter = new MultiEmitter(1000);
            emitter.once('test', callback);

            // First emission is immediate
            emitter.emit('test', 'data1');
            expect(callback).toHaveBeenCalledWith('data1');
            expect(callback).toHaveBeenCalledTimes(1);

            // Second emission should be ignored since listener was removed
            emitter.emit('test', 'data2');
            jasmine.clock().tick(1000);
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    /**
     * Tests for listener removal
     */
    describe('off', () => {
        /**
         * Verifies that listeners can be removed
         */
        it('should remove listener', () => {
            emitter = new MultiEmitter(-1);
            emitter.on('test', callback);
            emitter.off('test', callback);
            emitter.emit('test', 'data');

            expect(callback).not.toHaveBeenCalled();
        });

        /**
         * Verifies that other listeners remain when one is removed
         */
        it('should not affect other listeners', () => {
            const callback2 = jasmine.createSpy('callback2');

            emitter = new MultiEmitter(-1);
            emitter.on('test', callback);
            emitter.on('test', callback2);
            emitter.off('test', callback);
            emitter.emit('test', 'data');

            expect(callback).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });

        /**
         * Verifies that listeners for other events are unaffected
         */
        it('should not affect listeners of other events', () => {
            emitter = new MultiEmitter(-1);
            emitter.on('test1', callback);
            emitter.on('test2', callback);
            emitter.off('test1', callback);

            emitter.emit('test2', 'data');
            expect(callback).toHaveBeenCalled();
        });
    });

    /**
     * Tests for clearing listeners
     */
    describe('clear', () => {
        /**
         * Verifies that all listeners for specific event are removed
         */
        it('should remove all listeners for specific event', () => {
            const callback2 = jasmine.createSpy('callback2');

            emitter = new MultiEmitter(-1);
            emitter.on('test1', callback);
            emitter.on('test1', callback2);
            emitter.on('test2', callback);

            emitter.clear('test1');
            emitter.emit('test1', 'data');
            emitter.emit('test2', 'data');

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback2).not.toHaveBeenCalled();
        });

        /**
         * Verifies that all listeners are removed when no event specified
         */
        it('should remove all listeners when no event specified', () => {
            const callback2 = jasmine.createSpy('callback2');

            emitter = new MultiEmitter(-1);
            emitter.on('test1', callback);
            emitter.on('test2', callback2);

            emitter.clear();
            emitter.emit('test1', 'data');
            emitter.emit('test2', 'data');

            expect(callback).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
        });
    });
});