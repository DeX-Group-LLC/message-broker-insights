import { Component, OnDestroy, OnInit, ViewChild, AfterViewInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, Subscription } from 'rxjs';
import { MetricsService, Metric } from '../../services/metrics.service';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { TimeFormatService } from '../../services/time-format.service';
import { LayoutComponent } from '../layout/layout.component';
import { ExportComponent } from '../export/export.component';
import { TableComponent, TableColumn } from '../common/table/table.component';

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
        MatTooltipModule,
        NgChartsModule,
        ExportComponent,
        TableComponent
    ],
    templateUrl: './metrics.component.html',
    styleUrls: ['./metrics.component.scss']
})
export class MetricsComponent implements AfterViewInit, OnDestroy {
    /** Column configurations */
    columns: TableColumn[] = [
        { name: 'name', label: 'Name', sortable: true, filterable: true },
        { name: 'value', label: 'Value', sortable: true, filterable: true },
        { name: 'type', label: 'Type', sortable: true, filterable: true },
        { name: 'timestamp', label: 'Last Updated', sortable: true, filterable: true }
    ];

    /** Currently selected metric */
    selectedMetric?: Metric;

    /** Function that always returns false since we don't want expansion when using selection */
    canExpand = () => false;

    /** Subscription for metrics updates */
    private metricsSubscription?: Subscription;

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

    @ViewChild('toolbarContent') toolbarContent?: TemplateRef<any>;
    @ViewChild(TableComponent) table!: TableComponent;

    constructor(
        public metricsService: MetricsService,
        private timeFormatService: TimeFormatService,
        private layout: LayoutComponent
    ) {}

    ngAfterViewInit(): void {
        setTimeout(() => {
            if (this.toolbarContent) {
                this.layout.activeToolbarContent = this.toolbarContent;
            }
        });

        // Subscribe to metrics updates
        this.metricsSubscription = this.metricsService.metrics$.subscribe(() => {
            this.updateChart();
        });
    }

    ngOnDestroy(): void {
        this.layout.activeToolbarContent = undefined;
        this.metricsSubscription?.unsubscribe();
    }

    /**
     * Gets formatted metric display value
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
     * Gets CSS class for metric type
     * @param type - Metric type
     * @returns CSS class name
     */
    getMetricClass(type: string): string {
        return `${type.toLowerCase()}-metric`;
    }

    /**
     * Gets formatted date string
     * @param timestamp - Date to format
     * @returns Formatted date string
     */
    getFormattedDate(timestamp: Date): string {
        return timestamp.toLocaleString();
    }

    /**
     * Gets elapsed time string
     * @param timestamp - Date to get elapsed time from
     * @returns Elapsed time string
     */
    getElapsedTime(timestamp: Date): string {
        return this.timeFormatService.getElapsedTime(timestamp);
    }

    /**
     * Clears metrics history
     */
    clearHistory(): void {
        this.metricsService.clearHistory();
    }

    /**
     * Handles selection changes from the table
     * @param metrics - Selected metrics
     */
    onSelectionChange(metrics: Metric[]): void {
        // Clear selection if no metrics selected
        if (!metrics.length) {
            this.selectedMetric = undefined;
            this.chartData.datasets[0].data = [];
            this.chartData.labels = [];
            return;
        }

        // Since we're using single select, we only care about the first metric
        this.selectedMetric = metrics[0];
        this.updateChart();
    }

    /**
     * Updates the chart with data for the selected metric
     */
    updateChart(): void {
        // If no metric selected, do nothing
        if (!this.selectedMetric) return;

        // Get metric history
        const history = this.metricsService.getMetricHistory(this.selectedMetric.name);
        if (!history.length) return;

        // Create a new dataset to trigger change detection
        this.chartData = {
            datasets: [{
                data: history.map(h => h.value),
                label: 'Value',
                borderColor: '#1976d2',
                tension: 0.1,
                fill: false
            }],
            labels: history.map(h => h.timestamp.toLocaleTimeString())
        };
    }

    /**
     * Gets chart data in exportable format
     * @returns Chart data for export
     */
    getChartExportData(): any {
        if (!this.selectedMetric) return [];
        return this.chartData.datasets[0].data.map((value, index) => ({
            timestamp: this.chartData.labels?.[index],
            value
        }));
    }

    /**
     * Refreshes metrics data
     */
    async refreshMetrics(): Promise<Metric[]> {
        await this.metricsService.refresh();
        return this.metricsService.getCurrentMetrics();
    }
}
