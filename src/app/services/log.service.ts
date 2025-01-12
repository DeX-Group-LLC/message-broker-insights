import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WebsocketService } from './websocket.service';

/** Enum defining available log levels in order of severity */
export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error'
}

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
    /** Subject indicating whether logs are currently being loaded */
    private loadingSubject = new BehaviorSubject<boolean>(false);
    /** Subject holding the current minimum log level */
    private minLogLevelSubject = new BehaviorSubject<LogLevel>(LogLevel.INFO);
    /** Observable stream of log entries */
    logs$ = this.logsSubject.asObservable();
    /** Observable indicating whether logs are currently being loaded */
    public loading$ = this.loadingSubject.asObservable();
    /** Observable of the current minimum log level */
    public minLogLevel$ = this.minLogLevelSubject.asObservable();
    /** Flag indicating if the service has been initialized */
    private isInitialized = false;

    /** Map of log levels to their severity order */
    private readonly logLevelSeverity = {
        [LogLevel.DEBUG]: 0,
        [LogLevel.INFO]: 1,
        [LogLevel.WARN]: 2,
        [LogLevel.ERROR]: 3
    };

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
     * Sets the minimum log level. Only logs of this level and higher severity will be shown.
     * @param level - The minimum log level to set
     */
    setMinLogLevel(level: LogLevel): void {
        this.minLogLevelSubject.next(level);
        this.setupLogSubscription();
    }

    /**
     * Gets the current minimum log level
     * @returns The current minimum log level
     */
    getMinLogLevel(): LogLevel {
        return this.minLogLevelSubject.value;
    }

    /**
     * Checks if a given log level meets the minimum severity threshold
     * @param level - The log level to check
     * @returns True if the log level meets or exceeds the minimum severity
     */
    private meetsMinLogLevel(level: string): boolean {
        const minSeverity = this.logLevelSeverity[this.minLogLevelSubject.value];
        const logSeverity = this.logLevelSeverity[level as LogLevel];
        return logSeverity >= minSeverity;
    }

    /**
     * Sets up subscription to log messages.
     * Requests log updates from the server.
     */
    private async setupLogSubscription() {
        try {
            this.loadingSubject.next(true);
            const minLogLevel = this.minLogLevelSubject.value;
            const levels = Object.values(LogLevel)
                .filter(level => this.meetsMinLogLevel(level));
            return await this.websocketService.request('system.log.subscribe', { levels });
        } finally {
            this.loadingSubject.next(false);
        }
    }
    private _setupLogSubscription = this.setupLogSubscription.bind(this);

    /**
     * Adds a new log entry to the logs collection.
     * Processes the log message and extracts metadata.
     *
     * @param message - Log message from the server
     */
    private addLog(message: any): void {
        if (!this.meetsMinLogLevel(message.level)) {
            return;
        }
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

    /**
     * Manually triggers a log refresh.
     * Returns a promise that resolves when the refresh is complete.
     *
     * @returns Promise that resolves when the refresh is complete
     */
    public async refresh(): Promise<void> {
        return this.setupLogSubscription();
    }
}