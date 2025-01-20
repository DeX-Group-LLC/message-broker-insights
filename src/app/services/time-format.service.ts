import { Injectable, OnDestroy } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';

/**
 * Service for formatting time and timestamps consistently across the application.
 */
@Injectable({
    providedIn: 'root'
})
export class TimeFormatService implements OnDestroy {
    /** Current timestamp that gets updated every second */
    private currentTimestamp = new BehaviorSubject<number>(Date.now());
    /** Timer reference for cleanup */
    private timer: any;

    constructor() {
        // Update timestamp every second
        this.timer = setInterval(() => {
            this.currentTimestamp.next(Date.now());
        }, 1000);
    }

    ngOnDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        this.currentTimestamp.complete();
    }

    /**
     * Gets a date object from current timestamp minus seconds
     * @param seconds - Timestamp in seconds
     * @returns Date object
     */
    getDate(seconds: number): Date {
        return new Date(this.currentTimestamp.value - seconds * 1000);
    }

    /**
     * Gets the time elapsed since a timestamp in seconds
     * @param timestamp - Timestamp in seconds
     * @returns Time elapsed in seconds
     */
    getElapsed(timestamp: string | Date): number {
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        return Math.max(0, this.currentTimestamp.value - date.getTime());
    }

    /**
     * Gets the time elapsed since a timestamp.
     *
     * @param timestamp - ISO timestamp string or Date object
     * @returns Formatted elapsed time string
     */
    getElapsedTime(timestamp: string | Date): string {
        return this.renderElapsedTime(this.getElapsed(timestamp));
    }

    /**
     * Renders elapsed time in a human readable format.
     *
     * @param elapsed - Elapsed time in milliseconds
     * @returns Formatted elapsed time string
     */
    renderElapsedTime(elapsed: number): string {
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Gets the time elapsed since a timestamp in compact format.
     *
     * @param timestamp - ISO timestamp string or Date object
     * @returns Formatted elapsed time string
     */
    getCompactElapsedTime(timestamp: string | Date): string {
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        const elapsed = Math.max(0, this.currentTimestamp.value - date.getTime());
        return `${Math.floor(elapsed / 1000)}s`;
    }

    /**
     * Gets the current timestamp observable for components that need to react to time updates
     */
    getCurrentTimestamp(): Observable<number> {
        return this.currentTimestamp.asObservable();
    }
}
