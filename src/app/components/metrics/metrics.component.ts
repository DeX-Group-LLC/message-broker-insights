import { Component, OnDestroy, OnInit, ViewChild, AfterViewInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import { Subject, Subscription } from 'rxjs';
import { MetricsService, Metric } from '../../services/metrics.service';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { TimeFormatService } from '../../services/time-format.service';
import { LayoutComponent } from '../layout/layout.component';
import { ExportComponent } from '../export/export.component';

/**
 * Component for displaying and managing system metrics.
 * Provides a table view of metrics with filtering, sorting, and selection capabilities.
 */
@Component({
    selector: 'app-metrics',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatTooltipModule,
        MatInputModule,
        MatFormFieldModule,
        MatMenuModule,
        NgChartsModule,
        ExportComponent
    ],
    templateUrl: './metrics.component.html',
    styleUrls: ['./metrics.component.scss']
})
export class MetricsComponent implements OnInit, AfterViewInit, OnDestroy {
    /** Columns to display in the metrics table */
    displayedColumns: string[] = ['name', 'value', 'type', 'timestamp'];
    /** Data source for the metrics table */
    dataSource = new MatTableDataSource<Metric>([]);
    /** Whether metrics updates are paused */
    isPaused = false;
    /** Currently selected metric name */
    selectedMetric?: string;
    /** Loading state */
    loading = false;

    // Filter states
    /** Filter for metric names */
    nameFilter = '';
    /** Filter for metric values */
    valueFilter = '';
    /** Filter for metric types */
    typeFilter = '';
    /** Filter for metric timestamps */
    timestampFilter = '';

    /** Chart data configuration */
    chartData: ChartConfiguration<'line'>['data'] = {
        datasets: [{
            data: [],
            label: 'Value',
            borderColor: '#1976d2',
            tension: 0.1,
            fill: false
        }],
        labels: []
    };

    /** Chart options configuration */
    chartOptions: ChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
            y: {
                beginAtZero: true
            },
            x: {
                reverse: false,
                ticks: {
                    maxTicksLimit: 10
                }
            }
        },
        plugins: {
            legend: {
                display: false
            }
        }
    };

    /** Subject for handling component destruction */
    private destroy$ = new Subject<void>();
    /** Subscription to loading state updates */
    private loadingSubscription?: Subscription;
    /** Subscription to metrics updates */
    private metricsSubscription?: Subscription;
    /** Latest unfiltered metrics data */
    private latestMetrics: Metric[] = [];

    /** Reference to the paginator component */
    @ViewChild(MatPaginator) paginator!: MatPaginator;
    /** Reference to the sort component */
    @ViewChild(MatSort) sort!: MatSort;
    @ViewChild('toolbarContent') toolbarContent?: TemplateRef<any>;

    /**
     * Creates an instance of MetricsComponent.
     *
     * @param metricsService - Service for managing system metrics
     * @param timeFormatService - Service for formatting timestamps
     * @param layout - Layout component instance
     */
    constructor(
        private metricsService: MetricsService,
        private timeFormatService: TimeFormatService,
        private layout: LayoutComponent
    ) {
    }

    /**
     * Initializes the component.
     * Clears the data source.
     */
    ngOnInit(): void {
        // Clear data source
        this.dataSource.data = [];
    }

    /**
     * Sets up the component after view initialization.
     * Configures the paginator, sort, and metrics subscription.
     */
    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;

        setTimeout(() => {
            // Subscribe to metrics and update the data source
            this.setupMetricsSubscription();

            // Set default sort to name ascending
            this.sort.sort({
                id: 'name',
                start: 'asc',
                disableClear: false
            });
        });

        if (this.toolbarContent) {
            this.layout.activeToolbarContent = this.toolbarContent;
        }
    }

    /**
     * Cleans up resources when the component is destroyed.
     */
    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.loadingSubscription?.unsubscribe();
        this.metricsSubscription?.unsubscribe();
        this.layout.activeToolbarContent = undefined;
    }

    /**
     * Track function for ngFor optimization.
     * Uses metric name as the tracking key.
     *
     * @param index - Index of the metric in the array
     * @param metric - Metric object
     * @returns Unique identifier for the metric
     */
    trackByMetric(index: number, metric: Metric): string {
        return metric.name;
    }

    /**
     * Sets up the subscription to metrics updates.
     * Updates metrics in place to minimize re-renders.
     */
    private setupMetricsSubscription() {
        // Unsubscribe from any existing subscription
        this.loadingSubscription?.unsubscribe();
        this.metricsSubscription?.unsubscribe();

        // Subscribe to loading state
        this.loadingSubscription = this.metricsService.loading$.subscribe(
            loading => this.loading = loading
        );

        // Subscribe to metrics updates
        this.metricsSubscription = this.metricsService.metrics$.subscribe(metrics => {
            if (!this.isPaused) {
                // Update metrics in place
                const currentData = this.dataSource.data;
                const newMetricNames = new Set(metrics.map(m => m.name));

                // Update existing metrics and add new ones
                metrics.forEach(newMetric => {
                    const index = currentData.findIndex(m => m.name === newMetric.name);
                    if (index >= 0) {
                        // Update existing metric
                        Object.assign(currentData[index], newMetric);
                    } else {
                        // Add new metric
                        currentData.push(newMetric);
                    }
                });

                // Remove metrics that no longer exist
                const toRemove = currentData.filter(m => !newMetricNames.has(m.name));
                toRemove.forEach(metric => {
                    const index = currentData.indexOf(metric);
                    if (index >= 0) {
                        currentData.splice(index, 1);
                    }
                });

                // Keep selection if metric still exists
                if (this.selectedMetric && !newMetricNames.has(this.selectedMetric)) {
                    this.selectedMetric = undefined;
                }

                // Update filtered data
                this.latestMetrics = currentData;
                this.dataSource.data = this.applyFilters(currentData);

                // Update chart if there's a selected metric
                if (this.selectedMetric) {
                    this.updateChart(this.selectedMetric);
                }
            }
        });
    }

    /**
     * Updates the chart with the latest data for the selected metric.
     *
     * @param metricName - Name of the metric to update chart for
     */
    private updateChart(metricName: string): void {
        const history = this.metricsService.getMetricHistory(metricName);
        if (history.length > 0) {
            this.chartData = {
                datasets: [{
                    data: history.map(h => h.value),
                    label: metricName,
                    borderColor: '#1976d2',
                    tension: 0.1,
                    fill: false
                }],
                labels: history.map(h => h.timestamp.toLocaleTimeString())
            };
        }
    }

    /**
     * Refreshes the metrics display with the latest data.
     */
    refreshMetrics() {
        this.metricsService.refresh();
    }

    /**
     * Applies filters to the metrics data.
     *
     * @param metrics - Metrics to filter
     * @returns Filtered metrics
     */
    private applyFilters(metrics: Metric[]): Metric[] {
        return metrics.filter(metric => {
            const matchesName = !this.nameFilter ||
                metric.name.toLowerCase().includes(this.nameFilter.toLowerCase());
            const matchesValue = !this.valueFilter ||
                this.getMetricDisplayValue(metric).includes(this.valueFilter);
            const matchesType = !this.typeFilter ||
                metric.type.toLowerCase().includes(this.typeFilter.toLowerCase());
            const matchesTimestamp = !this.timestampFilter ||
                this.getFormattedDate(metric.timestamp).toLowerCase().includes(this.timestampFilter.toLowerCase());

            return matchesName && matchesValue && matchesType && matchesTimestamp;
        });
    }

    /**
     * Toggles the paused state of metrics updates.
     */
    togglePolling(): void {
        this.isPaused = !this.isPaused;
        if (!this.isPaused) {
            this.refreshMetrics();
        }
    }

    /**
     * Toggles the selection state of a metric.
     *
     * @param metric - Metric to toggle selection for, or undefined to clear selection
     */
    selectMetric(metric?: Metric): void {
        if (!metric) {
            this.selectedMetric = undefined;
            return;
        }
        this.selectedMetric = this.selectedMetric === metric.name ? undefined : metric.name;
        if (this.selectedMetric) {
            this.updateChart(this.selectedMetric);
        }
    }

    /**
     * Checks if a metric is currently selected.
     *
     * @param metric - Metric to check selection state for
     * @returns Whether the metric is selected
     */
    isSelected(metric: Metric): boolean {
        return this.selectedMetric === metric.name;
    }

    /**
     * Gets the display value for a metric based on its type.
     *
     * @param metric - Metric to get display value for
     * @returns Formatted display value
     */
    getMetricDisplayValue(metric: Metric): string {
        switch (metric.type.toLowerCase()) {
            case 'percent':
                return `${(Math.round(metric.value * 10000) / 100).toLocaleString()}%`;
            case 'rate':
                return `${metric.value.toLocaleString()}/sec`;
            case 'uptime':
                return this.timeFormatService.getElapsedTime(new Date(Date.now() - metric.value * 1000));
            case 'gauge':
            default:
                return metric.value.toLocaleString();
        }
    }

    /**
     * Gets the CSS class for a metric based on its type.
     *
     * @param type - Type of the metric
     * @returns CSS class name
     */
    getMetricClass(type: string): string {
        return type.toLowerCase() + '-metric';
    }

    /**
     * Gets the formatted date string for display.
     *
     * @param timestamp - Date object
     * @returns Formatted date string
     */
    getFormattedDate(timestamp: Date): string {
        return timestamp.toLocaleString();
    }

    /**
     * Clears all active filters.
     */
    clearFilters() {
        this.nameFilter = '';
        this.valueFilter = '';
        this.typeFilter = '';
        this.timestampFilter = '';
        this.applyFilter();
    }

    /**
     * Clears the name filter.
     */
    clearNameFilter() {
        this.nameFilter = '';
        this.applyFilter();
    }

    /**
     * Clears the value filter.
     */
    clearValueFilter() {
        this.valueFilter = '';
        this.applyFilter();
    }

    /**
     * Clears the type filter.
     */
    clearTypeFilter() {
        this.typeFilter = '';
        this.applyFilter();
    }

    /**
     * Clears the timestamp filter.
     */
    clearTimestampFilter() {
        this.timestampFilter = '';
        this.applyFilter();
    }

    /**
     * Checks if any filters are currently active.
     *
     * @returns Whether any filters are active
     */
    hasActiveFilters(): boolean {
        return !!(this.nameFilter || this.valueFilter || this.typeFilter || this.timestampFilter);
    }

    /**
     * Applies current filters to the data source.
     */
    applyFilter() {
        this.dataSource.data = this.applyFilters(this.latestMetrics);
    }

    /**
     * Gets the elapsed time since a timestamp.
     *
     * @param timestamp - Timestamp to get elapsed time for
     * @returns Formatted elapsed time string
     */
    getElapsedTime(timestamp: Date): string {
        return this.timeFormatService.getElapsedTime(timestamp);
    }

    /**
     * Clears all metric history from the metrics service
     */
    clearHistory(): void {
        this.metricsService.clearHistory();
    }

    /**
     * Exports the current chart data.
     */
    getChartExportData(): any {
        if (!this.selectedMetric) return [];

        const latestMetric = this.latestMetrics.find(m => m.name === this.selectedMetric);
        if (!latestMetric) return [];

        const history = this.metricsService.getMetricHistory(this.selectedMetric);
        return history.map(h => ({
            name: latestMetric.name,
            value: h.value,
            type: latestMetric.type,
            timestamp: h.timestamp
        }));
    }
}
