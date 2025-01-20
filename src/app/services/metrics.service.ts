import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { WebsocketService } from './websocket.service';
import { TimeFormatService } from './time-format.service';

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
    // Max number of metrics to store
    private maxMetrics = 5*60;

    /**
     * Creates an instance of MetricsService.
     * Initializes the metrics polling when the service is created.
     *
     * @param websocketService - Service for WebSocket communication
     */
    constructor(private websocketService: WebsocketService, private timeFormatService: TimeFormatService) {
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
            const metricsMap = (payload.payload as any).metrics as Record<string, MetricInfo>;
            if (metricsMap && typeof metricsMap === 'object') {
                // Transform metrics from server format to application format
                const newMetrics = Object.entries(metricsMap).map(([name, info]) => ({
                    name,
                    type: info.type,
                    value: info.value,
                    timestamp: new Date(info.timestamp)
                }));

                // Update metrics in place to maintain object references
                const currentMetrics = this.metricsSubject.getValue();
                const newMetricNames = new Set(newMetrics.map(m => m.name));

                // Update existing metrics and add new ones
                newMetrics.forEach(newMetric => {
                    const index = currentMetrics.findIndex(m => m.name === newMetric.name);
                    if (index >= 0) {
                        // Update existing metric in place
                        Object.assign(currentMetrics[index], newMetric);
                    } else {
                        // Add new metric
                        currentMetrics.push(newMetric);
                    }
                });

                // Remove metrics that no longer exist
                const toRemove = currentMetrics.filter(m => !newMetricNames.has(m.name));
                toRemove.forEach(metric => {
                    const index = currentMetrics.indexOf(metric);
                    if (index >= 0) {
                        currentMetrics.splice(index, 1);
                    }
                });

                // Limit the number of metrics to 5min
                if (this.metrics.length >= this.maxMetrics) this.metrics.shift();
                // Add the new metrics to the buffer
                this.metrics.push(newMetrics);
                // Emit the updated metrics to subscribers
                this.metricsSubject.next(currentMetrics);
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
     * Gets the current value of a specific metric.
     * @param metricName - Name of the metric to get the value for
     * @returns Current value of the metric or undefined if not found
     */
    public getMetric(metricName: string): Metric | undefined {
        const metrics = this.metricsSubject.getValue();
        return metrics.find(m => m.name === metricName);
    }

    /**
     * Gets the history of values for a specific metric.
     * Returns an array of value and timestamp pairs.
     * Filters out consecutive entries with the same timestamp.
     *
     * @param metricName - Name of the metric to get history for
     * @returns Array of value and timestamp pairs
     */
    public getMetricHistory(metricName: string): Metric[] {
        const history: Metric[] = [];
        for (const metrics of this.metrics) {
            const metric = metrics.find(m => m.name === metricName);
            if (metric) history.push(metric);
        }

        // Sort by timestamp
        history.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Filter out consecutive entries with the same timestamp
        for (let i = 0; i < history.length; i++) {
            if (i === 0) continue;
            if (history[i].timestamp.getTime() === history[i - 1].timestamp.getTime()) {
                history.splice(i, 1);
                i--;
            }
        }
        return history;
    }

    /**
     * Clears all metric history
     */
    public clearHistory(): void {
        this.metrics = [];
        this.metricsSubject.next([]);
    }

    /**
     * Gets the current metrics value
     * @returns Current metrics array
     */
    public getCurrentMetrics(): Metric[] {
        return this.metricsSubject.getValue();
    }

    /**
     * Gets the formatted metric display value
     * @param metric - Metric to format
     * @returns Formatted value string
     */
    getMetricDisplayValue(metric: Metric): string {
        if (typeof metric.value !== 'number') {
            return String(metric.value);
        }

        switch (metric.type.toLowerCase()) {
            case 'percent':
                return `${(metric.value * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
            case 'rate':
                return `${metric.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}/s`;
            case 'uptime':
                return this.timeFormatService.renderElapsedTime(metric.value * 1000);
            default:
                return metric.value.toLocaleString(undefined, { maximumFractionDigits: 2 });
        }
    }

    /**
     * Manually triggers a metrics refresh.
     * Returns a promise that resolves when the refresh is complete.
     *
     * @returns Promise that resolves when the refresh is complete
     */
    public async refresh(): Promise<void> {
        return await this.pollMetrics();
    }
}