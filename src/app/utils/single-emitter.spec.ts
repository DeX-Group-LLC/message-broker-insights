import { SingleEmitter } from './single-emitter';

/**
 * Test suite for SingleEmitter class which provides debounced event emission for a single event type
 */
describe('SingleEmitter', () => {
    let emitter: SingleEmitter<(data: string) => void>;
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
            emitter = new SingleEmitter(-1);
        });

        /**
         * Verifies that events are emitted immediately with negative delay
         */
        it('should emit events immediately with negative delay', () => {
            emitter.on(callback);
            emitter.emit('test');

            expect(callback).toHaveBeenCalledWith('test');
            expect(callback).toHaveBeenCalledTimes(1);
        });

        /**
         * Verifies that multiple listeners receive events
         */
        it('should emit to multiple listeners', () => {
            const callback2 = jasmine.createSpy('callback2');

            emitter.on(callback);
            emitter.on(callback2);
            emitter.emit('test');

            expect(callback).toHaveBeenCalledWith('test');
            expect(callback2).toHaveBeenCalledWith('test');
        });
    });

    /**
     * Tests for debounced event emission
     */
    describe('debounced emission', () => {
        const DELAY = 1000;

        beforeEach(() => {
            emitter = new SingleEmitter(DELAY);
        });

        /**
         * Verifies basic debouncing behavior
         */
        it('should emit immediately if no recent emission', () => {
            emitter.on(callback);
            emitter.emit('test1');

            expect(callback).toHaveBeenCalledWith('test1');
            expect(callback).toHaveBeenCalledTimes(1);
        });

        /**
         * Verifies that only the latest event is emitted after delay
         */
        it('should wait for delay after recent emission', () => {
            emitter.on(callback);

            // First emission is immediate
            emitter.emit('test1');
            expect(callback).toHaveBeenCalledWith('test1');

            // Second emission should wait
            emitter.emit('test2');
            expect(callback).toHaveBeenCalledTimes(1);

            // After delay, second emission happens
            jasmine.clock().tick(DELAY);
            expect(callback).toHaveBeenCalledWith('test2');
            expect(callback).toHaveBeenCalledTimes(2);
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
            emitter = new SingleEmitter(-1);
            emitter.once(callback);

            emitter.emit('test1');
            emitter.emit('test2');

            expect(callback).toHaveBeenCalledWith('test1');
            expect(callback).toHaveBeenCalledTimes(1);
        });

        /**
         * Verifies that once listeners work with debouncing
         */
        it('should work with debouncing', () => {
            emitter = new SingleEmitter(1000);
            emitter.once(callback);

            // First emission is immediate
            emitter.emit('test1');
            expect(callback).toHaveBeenCalledWith('test1');
            expect(callback).toHaveBeenCalledTimes(1);

            // Second emission should be ignored since listener was removed
            emitter.emit('test2');
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
            emitter = new SingleEmitter(-1);
            emitter.on(callback);
            emitter.off(callback);
            emitter.emit('test');

            expect(callback).not.toHaveBeenCalled();
        });

        /**
         * Verifies that other listeners remain when one is removed
         */
        it('should not affect other listeners', () => {
            const callback2 = jasmine.createSpy('callback2');

            emitter = new SingleEmitter(-1);
            emitter.on(callback);
            emitter.on(callback2);
            emitter.off(callback);
            emitter.emit('test');

            expect(callback).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });
    });

    /**
     * Tests for clearing all listeners
     */
    describe('clear', () => {
        /**
         * Verifies that all listeners are removed
         */
        it('should remove all listeners', () => {
            const callback2 = jasmine.createSpy('callback2');

            emitter = new SingleEmitter(-1);
            emitter.on(callback);
            emitter.on(callback2);

            emitter.clear();
            emitter.emit('test');

            expect(callback).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
        });
    });
});