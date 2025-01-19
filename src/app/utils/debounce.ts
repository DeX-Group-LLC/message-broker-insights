/**
 * A class that provides debounced execution of a function, ensuring it's only executed
 * after a specified delay since the last call. Caches the latest arguments and only
 * executes once with the most recent values.
 */
export class DebounceTimer<T extends (...args: any[]) => void> {
    private timeoutId: number | undefined;
    private latestArgs!: Parameters<T>;
    private startTime: number | undefined;

    constructor(
        private fn: T,
        private delay: number
    ) {}

    /**
     * Executes the debounced function with the provided arguments.
     * If a timeout is already scheduled, it will cache the new arguments
     * for when the timeout executes.
     * If delay is negative, executes immediately without debouncing.
     */
    execute(...args: Parameters<T>): void {
        // Cache the latest arguments
        this.latestArgs = args;

        // If delay is negative, execute immediately
        if (this.delay < 0) {
            this.fn(...args);
            return;
        }

        // If no timeout is scheduled, create one
        if (this.timeoutId === undefined) {
            this.startTime = Date.now();
            this.timeoutId = window.setTimeout(() => {
                this.fn(...this.latestArgs);
                this.timeoutId = undefined;
                this.startTime = undefined;
            }, this.delay);
        }
    }

    /**
     * Updates the delay time for future executions.
     * If there's an active timeout, it will be rescheduled with the new delay,
     * accounting for time already elapsed.
     */
    setDelay(delay: number): void {
        if (this.timeoutId !== undefined && this.startTime !== undefined) {
            // Calculate how much time has elapsed
            const elapsed = Date.now() - this.startTime;
            // Calculate remaining time with new delay
            const remaining = delay - elapsed;

            // Cancel the current timeout
            this.cancel();

            if (remaining <= 0) {
                // If we've already waited longer than the new delay, execute immediately
                this.fn(...this.latestArgs);
            } else {
                // Otherwise reschedule with remaining time
                this.startTime = Date.now();
                this.timeoutId = window.setTimeout(() => {
                    this.fn(...this.latestArgs);
                    this.timeoutId = undefined;
                    this.startTime = undefined;
                }, remaining);
            }
        }

        this.delay = delay;
    }

    /**
     * Cancels any scheduled execution.
     */
    cancel(): void {
        if (this.timeoutId !== undefined) {
            window.clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
            this.startTime = undefined;
        }
    }
}