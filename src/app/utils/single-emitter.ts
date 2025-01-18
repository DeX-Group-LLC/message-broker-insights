import { debounce } from "rxjs";

/**
 * Base class providing event emitter functionality.
 * Allows components to subscribe to and emit events.
 */
export class SingleEmitter<T extends (...args: any[]) => void> {
    /** Map storing event listeners for each event type */
    private listeners = new Set<T>();

    /** Last time the emitter was called */
    private lastTime: Date = new Date();
    private debounceTimer?: number;

    constructor(private debounceTime: number = 0) {}

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
        // If debounce time is set and the last time the emitter was called is less than the debounce time,
        if (this.debounceTime > 0) {
            const timeLeft = this.debounceTime - (new Date().getTime() - this.lastTime.getTime());
            if (timeLeft > 0) {
                if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
                this.debounceTimer = window.setTimeout(() => {
                    this.emit(...args);
                    this.debounceTimer = undefined;
                }, timeLeft);
                return;
            }
        }

        // Otherwise, emit the event immediately
        this.lastTime = new Date();
        for (const callback of this.listeners) {
            callback(...args);
        }
    }

    /**
     * Removes all listeners.
     */
    clear(): void {
        this.listeners.clear();
    }
}