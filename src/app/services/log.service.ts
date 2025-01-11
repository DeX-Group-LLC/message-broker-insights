import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WebsocketService } from './websocket.service';

/** Structure of a log entry in the application */
export interface LogEntry {
    /** Unique identifier for the log entry */
    id: number;
    /** Timestamp when the log was created */
    timestamp: Date;
    /** Log level (e.g., 'info', 'warn', 'error') */
    level: string;
    /** Module that generated the log */
    module: string;
    /** Log message content */
    message: string;
    /** Optional additional metadata */
    meta?: any;
}

/**
 * Service responsible for managing log entries in the application.
 * Handles log subscription, storage, and retrieval.
 */
@Injectable({
    providedIn: 'root'
})
export class LogService implements OnDestroy {
    /** Subject holding the current logs */
    private logsSubject = new BehaviorSubject<LogEntry[]>([]);
    /** Observable stream of log entries */
    logs$ = this.logsSubject.asObservable();
    /** Flag indicating if the service has been initialized */
    private isInitialized = false;

    /**
     * Creates an instance of LogService.
     *
     * @param websocketService - Service for WebSocket communication
     */
    constructor(private websocketService: WebsocketService) {
        this.initialize();
    }

    /**
     * Initializes the log service.
     * Sets up WebSocket subscriptions and event listeners.
     */
    private async initialize() {
        if (this.isInitialized) return;

        await this.websocketService.waitForReady();
        await this.setupLogSubscription();

        // Set up event listeners
        this.websocketService.on('connected', this._setupLogSubscription);
        this.websocketService.on('response:system.log:1.0.0', this._addLog);

        this.isInitialized = true;
    }

    /**
     * Cleans up resources when the service is destroyed.
     * Removes event listeners and completes observables.
     */
    ngOnDestroy() {
        this.websocketService.off('connected', this._setupLogSubscription);
        this.websocketService.off('response:system.log:1.0.0', this._addLog);
        this.logsSubject.complete();
    }

    /**
     * Sets up subscription to log messages.
     * Requests log updates from the server.
     */
    private async setupLogSubscription() {
        return this.websocketService.request('system.log.subscribe', { levels: ['info', 'warn', 'error'] });
    }
    private _setupLogSubscription = this.setupLogSubscription.bind(this);

    /**
     * Adds a new log entry to the logs collection.
     * Processes the log message and extracts metadata.
     *
     * @param message - Log message from the server
     */
    private addLog(message: any): void {
        const log: LogEntry = {
            id: this.logsSubject.value.length,
            timestamp: new Date(),
            level: message.level,
            module: message.module,
            message: message.message
        };

        const baseFields = new Set(Object.keys(log));
        // Add all other fields as meta
        for (const key in message) {
            if (!baseFields.has(key)) {
                log.meta ??= {};
                log.meta[key] = message[key];
            }
        }

        // Limit the number of latest logs to 10000 to prevent memory issues
        const currentLogs = this.logsSubject.value;
        if (currentLogs.length > 10000) currentLogs.shift();

        // Add the log to the logs subject
        currentLogs.push(log);
        this.logsSubject.next(currentLogs);
    }
    private _addLog = this.addLog.bind(this);

    /**
     * Clears all stored logs.
     */
    clearLogs(): void {
        this.logsSubject.next([]);
    }

    /**
     * Gets the current cached logs.
     *
     * @returns Array of log entries
     */
    getCachedLogs(): LogEntry[] {
        return this.logsSubject.value;
    }
}