import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { WebsocketService } from './websocket.service';

/**
 * Raw metric information received from the server.
 */
export interface MetricInfo {
    /** Name of the metric */
    name: string;
    /** Type of the metric (gauge, rate, uptime) */
    type: string;
    /** ISO timestamp string of when the metric was last updated */
    timestamp: string;
    /** Current value of the metric */
    value: number;
}

/**
 * Processed metric information used in the application.
 */
export interface Metric {
    /** Name of the metric */
    name: string;
    /** Type of the metric (gauge, rate, uptime) */
    type: string;
    /** JavaScript Date object of when the metric was last updated */
    timestamp: Date;
    /** Current value of the metric */
    value: number;
}

/**
 * Service responsible for polling and managing system metrics.
 * Provides an observable stream of metrics that components can subscribe to.
 */
@Injectable({
    providedIn: 'root'
})
export class MetricsService implements OnDestroy {
    /** Subject holding the current metrics data */
    private metricsSubject = new BehaviorSubject<Metric[]>([]);
    /** Subject indicating whether metrics are currently being loaded */
    private loadingSubject = new BehaviorSubject<boolean>(false);
    /** Observable stream of metrics that components can subscribe to */
    public metrics$ = this.metricsSubject.asObservable();
    /** Observable indicating whether metrics are currently being loaded */
    public loading$ = this.loadingSubject.asObservable();
    /** ID of the polling interval timer */
    private intervalId?: number;
    // Store the last 5min of metrics to prevent memory issues
    private metrics: Metric[][] = [];

    /**
     * Creates an instance of MetricsService.
     * Initializes the metrics polling when the service is created.
     *
     * @param websocketService - Service for WebSocket communication
     */
    constructor(private websocketService: WebsocketService) {
        this.startPolling();
    }

    /**
     * Cleans up resources when the service is destroyed.
     * Stops polling and completes observables.
     */
    ngOnDestroy(): void {
        this.stopPolling();
        this.metricsSubject.complete();
        this.loadingSubject.complete();
    }

    /**
     * Starts polling for metrics at regular intervals.
     * Clears any existing polling interval before starting a new one.
     */
    private async startPolling(): Promise<void> {
        // Clear any existing interval
        this.stopPolling();

        // Set a new interval to poll for metrics
        this.intervalId = window.setInterval(this.pollMetrics.bind(this), 1000);
        await this.pollMetrics();
    }

    /**
     * Polls the server for current metrics.
     * Transforms the received metrics and emits them to subscribers.
     */
    private async pollMetrics(): Promise<void> {
        try {
            this.loadingSubject.next(true);
            const payload = await this.websocketService.request('system.metrics', { showAll: true });
            const metricsMap = payload.metrics as Record<string, MetricInfo>;
            if (metricsMap && typeof metricsMap === 'object') {
                // Transform metrics from server format to application format
                const metrics = Object.entries(metricsMap).map(([name, info]) => ({
                    name,
                    type: info.type,
                    value: info.value,
                    timestamp: new Date(info.timestamp)
                }));
                // Limit the number of metrics to 5min
                if (this.metrics.length > 5*60) this.metrics.shift();
                // Add the new metrics to the buffer
                this.metrics.push(metrics);
                // Emit the latest metrics to subscribers
                this.metricsSubject.next(metrics);
            } else {
                console.error('Invalid metrics response:', metricsMap);
            }
        } catch (error) {
            console.error('Error polling metrics:', error);
        } finally {
            this.loadingSubject.next(false);
        }
    }

    /**
     * Stops the metrics polling interval.
     * Cleans up the interval timer.
     */
    private stopPolling(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }

    /**
     * Gets the history of values for a specific metric.
     * Returns an array of value and timestamp pairs.
     * Filters out consecutive entries with the same timestamp.
     *
     * @param metricName - Name of the metric to get history for
     * @returns Array of value and timestamp pairs
     */
    public getMetricHistory(metricName: string): { value: number, timestamp: Date }[] {
        const history = this.metrics.map(metrics => {
            const metric = metrics.find(m => m.name === metricName);
            return metric ? { value: metric.value, timestamp: metric.timestamp } : null;
        }).filter((entry): entry is { value: number, timestamp: Date } => entry !== null);

        // Sort by timestamp
        history.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Filter out consecutive entries with the same timestamp
        return history.filter((entry, index, array) => {
            if (index === 0) return true;
            return entry.timestamp.getTime() !== array[index - 1].timestamp.getTime();
        });
    }
}
