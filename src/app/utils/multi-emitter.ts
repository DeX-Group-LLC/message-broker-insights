import { SingleEmitter } from "./single-emitter";

/**
 * Base class providing event emitter functionality.
 * Allows components to subscribe to and emit events.
 */
export class MultiEmitter<T extends (...args: any[]) => void> {
    /** Map storing event emitters for each event type */
    private events = new Map<string, SingleEmitter<T>>();

    /** Default debounce time for new emitters */
    private debounceTime: number;

    /**
     * Constructor for MultiEmitter.
     * @param debounceTime - The debounce time in milliseconds. If set to -1, events are emitted immediately. If set to 0, events are emitted in the next tick.
     */
    constructor(debounceTime: number = 0) {
        this.debounceTime = debounceTime;
    }

    /**
     * Gets or creates a SingleEmitter for the given event type
     */
    private getEmitter(event: string): SingleEmitter<T> {
        let emitter = this.events.get(event);
        if (!emitter) {
            emitter = new SingleEmitter<T>(this.debounceTime);
            this.events.set(event, emitter);
        }
        return emitter;
    }

    /**
     * Adds a listener for the specified event.
     *
     * @param event - Event to add listener to
     * @param callback - Function to call when the event occurs
     */
    on(event: string, callback: T): void {
        this.getEmitter(event).on(callback);
    }

    /**
     * Adds a one-time listener.
     * The listener will be removed after it is called once.
     *
     * @param event - Event to add listener to
     * @param callback - Function to call when the event occurs
     */
    once(event: string, callback: T): void {
        this.getEmitter(event).once(callback);
    }

    /**
     * Removes a listener.
     *
     * @param event - Event to remove listener from
     * @param callback - Function to remove from listeners
     */
    off(event: string, callback: T): void {
        const emitter = this.events.get(event);
        if (emitter) {
            emitter.off(callback);
            // Clean up empty emitters
            if (emitter['listeners'].size === 0) {
                this.events.delete(event);
            }
        }
    }

    /**
     * Emits an event with the specified arguments.
     *
     * @param event - Event to emit
     * @param args - Arguments to pass to event listeners
     */
    emit(event: string, ...args: Parameters<T>): void {
        const emitter = this.events.get(event);
        if (emitter) {
            emitter.emit(...args);
        }
    }

    /**
     * Removes all listeners.
     *
     * @param event - Optional event to clear listeners for
     */
    clear(event?: string): void {
        if (event) {
            const emitter = this.events.get(event);
            if (emitter) {
                emitter.clear();
                this.events.delete(event);
            }
        } else {
            this.events.clear();
        }
    }
}