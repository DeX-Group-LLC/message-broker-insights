import { DebounceTimer } from "./debounce";

/**
 * Base class providing event emitter functionality.
 * Allows components to subscribe to and emit events.
 */
export class SingleEmitter<T extends (...args: any[]) => void> {
    /** Map storing event listeners for each event type */
    private listeners = new Set<T>();

    /** Debounce timer for emitting events */
    private debounceTimer: DebounceTimer<(...args: Parameters<T>) => void>;

    /**
     * Constructor for SingleEmitter.
     * @param debounceTime - The debounce time in milliseconds. If set to -1, events are emitted immediately. If set to 0, events are emitted in the next tick.
     */
    constructor(debounceTime: number = -1) {
        this.debounceTimer = new DebounceTimer(
            (...args: Parameters<T>) => {
                for (const callback of this.listeners) {
                    callback(...args);
                }
            },
            debounceTime
        );
    }

    /**
     * Adds a listener for the specified event.
     *
     * @param callback - Function to call when the event occurs
     */
    on(callback: T): void {
        this.listeners.add(callback);
    }

    /**
     * Adds a one-time listener.
     * The listener will be removed after it is called once.
     *
     * @param callback - Function to call when the event occurs
     */
    once(callback: T): void {
        const onceCallback = (...args: Parameters<T>) => {
            this.off(onceCallback as T);
            return callback(...args);
        };
        this.on(onceCallback as T);
    }

    /**
     * Removes a listener.
     *
     * @param callback - Function to remove from listeners
     */
    off(callback: T): void {
        this.listeners.delete(callback);
    }

    /**
     * Emits an event with the specified arguments.
     * Protected method that derived classes can use to emit events.
     *
     * @param args - Arguments to pass to event listeners
     */
    emit(...args: Parameters<T>): void {
        this.debounceTimer.execute(...args);
    }

    /**
     * Removes all listeners.
     */
    clear(): void {
        this.listeners.clear();
    }
}