/**
 * Base class providing event emitter functionality.
 * Allows components to subscribe to and emit events.
 */
export class MultiEmitter<T extends (...args: any[]) => void> {
    /** Map storing event listeners for each event type */
    private listeners = new Map<string, Set<T>>();

    /**
     * Adds a listener for the specified event.
     *
     * @param event - Event to add listener to
     * @param callback - Function to call when the event occurs
     */
    on(event: string, callback: T): void {
        const callbacks = this.listeners.get(event) ?? new Set();
        callbacks.add(callback);
        this.listeners.set(event, callbacks);
    }

    /**
     * Adds a one-time listener.
     * The listener will be removed after it is called once.
     *
     * @param event - Event to add listener to
     * @param callback - Function to call when the event occurs
     */
    once(event: string, callback: T): void {
        const onceCallback = (...args: Parameters<T>) => {
            this.off(event, onceCallback as T);
            return callback(...args);
        };
        this.on(event, onceCallback as T);
    }

    /**
     * Removes a listener.
     *
     * @param event - Event to remove listener from
     * @param callback - Function to remove from listeners
     */
    off(event: string, callback: T): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    /**
     * Emits an event with the specified arguments.
     * Protected method that derived classes can use to emit events.
     *
     * @param event - Event to emit
     * @param args - Arguments to pass to event listeners
     */
    emit(event: string, ...args: Parameters<T>): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            for (const callback of callbacks) {
                callback(...args);
            }
        }
    }

    /**
     * Removes all listeners.
     *
     * @param event - Optional event to clear listeners for
     */
    clear(event?: string): void {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}