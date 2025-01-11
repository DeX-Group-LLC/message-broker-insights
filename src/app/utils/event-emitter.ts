/** Type definition for event callback functions */
type EventCallback = (...args: any[]) => void;

/**
 * Base class providing event emitter functionality.
 * Allows components to subscribe to and emit events.
 */
export class EventEmitter {
    /** Map storing event listeners for each event type */
    private eventListeners = new Map<string, Set<EventCallback>>();

    /**
     * Adds an event listener for the specified event.
     *
     * @param event - Name of the event to listen for
     * @param callback - Function to call when the event occurs
     */
    on(event: string, callback: EventCallback): void {
        const callbacks = this.eventListeners.get(event) ?? new Set();
        callbacks.add(callback);
        this.eventListeners.set(event, callbacks);
    }

    /**
     * Adds a one-time event listener for the specified event.
     * The listener will be removed after it is called once.
     *
     * @param event - Name of the event to listen for
     * @param callback - Function to call when the event occurs
     */
    once(event: string, callback: EventCallback): void {
        const onceCallback = (...args: any[]) => {
            this.off(event, onceCallback);
            callback(...args);
        };
        this.on(event, onceCallback);
    }

    /**
     * Removes an event listener for the specified event.
     *
     * @param event - Name of the event to remove listener from
     * @param callback - Function to remove from event listeners
     */
    off(event: string, callback: EventCallback): void {
        const callbacks = this.eventListeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this.eventListeners.delete(event);
            }
        }
    }

    /**
     * Emits an event with the specified arguments.
     * Protected method that derived classes can use to emit events.
     *
     * @param event - Name of the event to emit
     * @param args - Arguments to pass to event listeners
     */
    protected emit(event: string, ...args: any[]): void {
        const callbacks = this.eventListeners.get(event);
        if (callbacks) {
            for (const callback of callbacks) {
                callback(...args);
            }
        }
    }

    /**
     * Removes all event listeners.
     * If an event is specified, only removes listeners for that event.
     *
     * @param event - Optional event name to remove listeners for
     */
    removeAllListeners(event?: string): void {
        if (event) {
            this.eventListeners.delete(event);
        } else {
            this.eventListeners.clear();
        }
    }
}