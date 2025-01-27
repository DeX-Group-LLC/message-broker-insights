import { EventEmitter } from './event-emitter';

/**
 * Test suite for EventEmitter class which provides basic event handling functionality
 */
describe('EventEmitter', () => {
    let emitter: EventEmitter;
    let callback: jasmine.Spy;

    beforeEach(() => {
        emitter = new EventEmitter();
        callback = jasmine.createSpy('callback');
    });

    /**
     * Tests for event subscription and emission
     */
    describe('on/emit', () => {
        /**
         * Verifies basic event subscription and emission
         */
        it('should call listener when event is emitted', () => {
            emitter.on('test', callback);
            (emitter as any).emit('test', 'arg1', 'arg2');

            expect(callback).toHaveBeenCalledWith('arg1', 'arg2');
            expect(callback).toHaveBeenCalledTimes(1);
        });

        /**
         * Verifies multiple listeners for same event
         */
        it('should support multiple listeners for same event', () => {
            const callback2 = jasmine.createSpy('callback2');

            emitter.on('test', callback);
            emitter.on('test', callback2);
            (emitter as any).emit('test', 'data');

            expect(callback).toHaveBeenCalledWith('data');
            expect(callback2).toHaveBeenCalledWith('data');
        });

        /**
         * Verifies that events don't trigger unrelated listeners
         */
        it('should not trigger listeners of other events', () => {
            emitter.on('test1', callback);
            (emitter as any).emit('test2', 'data');

            expect(callback).not.toHaveBeenCalled();
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
            emitter.once('test', callback);

            (emitter as any).emit('test', 'data1');
            (emitter as any).emit('test', 'data2');

            expect(callback).toHaveBeenCalledWith('data1');
            expect(callback).toHaveBeenCalledTimes(1);
        });

        /**
         * Verifies that once listeners are removed after execution
         */
        it('should remove listener after execution', () => {
            emitter.once('test', callback);
            (emitter as any).emit('test');

            expect(callback).toHaveBeenCalledTimes(1);
            callback.calls.reset();

            (emitter as any).emit('test');
            expect(callback).not.toHaveBeenCalled();
        });
    });

    /**
     * Tests for event listener removal
     */
    describe('off', () => {
        /**
         * Verifies that specific listeners can be removed
         */
        it('should remove specific listener', () => {
            emitter.on('test', callback);
            emitter.off('test', callback);
            (emitter as any).emit('test');

            expect(callback).not.toHaveBeenCalled();
        });

        /**
         * Verifies that other listeners remain when one is removed
         */
        it('should not affect other listeners when removing one', () => {
            const callback2 = jasmine.createSpy('callback2');

            emitter.on('test', callback);
            emitter.on('test', callback2);
            emitter.off('test', callback);
            (emitter as any).emit('test');

            expect(callback).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });
    });

    /**
     * Tests for removing all listeners
     */
    describe('removeAllListeners', () => {
        /**
         * Verifies removal of all listeners for specific event
         */
        it('should remove all listeners for specific event', () => {
            const callback2 = jasmine.createSpy('callback2');

            emitter.on('test1', callback);
            emitter.on('test1', callback2);
            emitter.on('test2', callback);

            emitter.removeAllListeners('test1');
            (emitter as any).emit('test1');
            (emitter as any).emit('test2');

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback2).not.toHaveBeenCalled();
        });

        /**
         * Verifies removal of all listeners when no event specified
         */
        it('should remove all listeners when no event specified', () => {
            emitter.on('test1', callback);
            emitter.on('test2', callback);

            emitter.removeAllListeners();
            (emitter as any).emit('test1');
            (emitter as any).emit('test2');

            expect(callback).not.toHaveBeenCalled();
        });
    });
});