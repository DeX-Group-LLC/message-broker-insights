import { Component, OnDestroy, OnInit, ViewChild, AfterViewInit } from '@angular/core';
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
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { Observable, Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { MetricsService, Metric } from '../../services/metrics.service';

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
        MatMenuModule
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

    // Filter states
    /** Filter for metric names */
    nameFilter = '';
    /** Filter for metric values */
    valueFilter = '';
    /** Filter for metric types */
    typeFilter = '';
    /** Filter for metric timestamps */
    timestampFilter = '';

    /** Subject for handling component destruction */
    private destroy$ = new Subject<void>();
    /** Subscription to metrics updates */
    private metricsSubscription?: Subscription;
    /** Latest unfiltered metrics data */
    private latestMetrics: Metric[] = [];

    /** Reference to the paginator component */
    @ViewChild(MatPaginator) paginator!: MatPaginator;
    /** Reference to the sort component */
    @ViewChild(MatSort) sort!: MatSort;

    /**
     * Creates an instance of MetricsComponent.
     *
     * @param metricsService - Service for managing system metrics
     */
    constructor(private metricsService: MetricsService) {
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
    }

    /**
     * Cleans up resources when the component is destroyed.
     */
    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.metricsSubscription?.unsubscribe();
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
        if (this.metricsSubscription) {
            this.metricsSubscription.unsubscribe();
        }

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
            }
        });
    }

    /**
     * Refreshes the metrics display with the latest data.
     */
    refreshMetrics() {
        this.dataSource.data = this.applyFilters(this.latestMetrics);
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
     * @param metric - Metric to toggle selection for
     */
    selectMetric(metric: Metric): void {
        this.selectedMetric = this.selectedMetric === metric.name ? undefined : metric.name;
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
            case 'rate':
                return `${metric.value}/sec`;
            case 'uptime':
                return `${metric.value}sec`;
            case 'gauge':
            default:
                return metric.value.toString();
        }
    }

    /**
     * Gets the CSS class for a metric based on its type.
     *
     * @param type - Type of the metric
     * @returns CSS class name
     */
    getMetricClass(type: string): string {
        switch (type.toLowerCase()) {
            case 'gauge':
                return 'gauge-metric';
            case 'rate':
                return 'rate-metric';
            case 'uptime':
                return 'uptime-metric';
            default:
                return 'unknown-metric';
        }
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
     * Applies all active filters to a set of metrics.
     *
     * @param metrics - Metrics to filter
     * @returns Filtered metrics
     */
    private applyFilters(metrics: Metric[]): Metric[] {
        return metrics.filter(metric => {
            const matchesName = !this.nameFilter ||
                metric.name.toLowerCase().includes(this.nameFilter.toLowerCase());
            const matchesValue = !this.valueFilter ||
                metric.value.toString().includes(this.valueFilter);
            const matchesType = !this.typeFilter ||
                metric.type.toLowerCase().includes(this.typeFilter.toLowerCase());
            const matchesTimestamp = !this.timestampFilter ||
                metric.timestamp.toLocaleString().toLowerCase().includes(this.timestampFilter.toLowerCase());

            return matchesName && matchesValue && matchesType && matchesTimestamp;
        });
    }
}
