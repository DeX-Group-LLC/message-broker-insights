/**
 * A class that provides debounced execution of a function, ensuring it's only executed
 * after a specified delay since the last call. Caches the latest arguments and only
 * executes once with the most recent values.
 */
export class DebounceTimer<T extends (...args: any[]) => void> {
    private timeoutId: number | undefined;
    private latestArgs!: Parameters<T>;
    private lastTime: number = -Number.MAX_SAFE_INTEGER;

    constructor(
        private fn: T,
        private delay: number
    ) {}

    /**
     * Executes the debounced function with the provided arguments.
     * If a timeout is already scheduled, it will cache the new arguments
     * and reschedule based on the remaining delay.
     * If the computed delay is <= 0, executes immediately.
     */
    execute(...args: Parameters<T>): void {
        // If delay is <= 0, execute immediately
        if (this.delay <= 0) {
            this.lastTime = Date.now();
            this.fn(...args);
            return;
        }

        // Cache the latest arguments
        this.latestArgs = args;

        // If no timeout is scheduled, create one
        if (this.timeoutId === undefined) {
            // Calculate the actual delay based on lastTime if it exists
            const actualDelay = this.delay - (Date.now() - this.lastTime);
            // If delay is <= 0, execute immediately
            if (actualDelay <= 0) {
                this.lastTime = Date.now();
                this.fn(...this.latestArgs);
                return;
            }
            // Otherwise, schedule a timeout
            this.timeoutId = window.setTimeout(() => {
                // Clear the timeout and update lastTime
                this.timeoutId = undefined;
                this.lastTime = Date.now();
                // Execute the function with the latest arguments
                this.fn(...this.latestArgs);
            }, actualDelay);
        }
    }

    /**
     * Updates the delay time for future executions.
     * If there's an active timeout, it will be rescheduled with the new delay,
     * accounting for time already elapsed.
     */
    setDelay(delay: number): void {
        // Update the delay
        this.delay = delay;

        // If there's an active timeout, cancel it and re-execute
        if (this.timeoutId !== undefined) {
            // Cancel the current timeout
            this.cancel();

            // Execute:
            this.execute(...this.latestArgs);
        }
    }

    /**
     * Cancels any scheduled execution.
     */
    cancel(): void {
        if (this.timeoutId !== undefined) {
            window.clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
    }
}