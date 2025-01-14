import { Component, OnDestroy, OnInit, ViewChild, AfterViewInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import 'chartjs-adapter-moment';
import { MetricsService, Metric } from '../../services/metrics.service';
import { ThemeService } from '../../services/theme.service';
import { TimeFormatService } from '../../services/time-format.service';
import { LayoutComponent } from '../layout/layout.component';
import { ExportComponent } from '../common/export/export.component';
import { TableComponent, TableColumn } from '../common/table/table.component';
import { cssvar } from '../utils/style.utils';

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

    private subscriptions: Subscription[] = [];

    /** Currently selected metric */
    selectedMetric?: Metric;

    /** Function that always returns false since we don't want expansion when using selection */
    canExpand = (row: any): boolean => {
        // Allow expansion for group rows
        return row?.__isGroup === true;
    };

    /** Function to get the group name for a metric */
    getMetricGroup = (metric: Metric): string => {
        if (!metric?.name) return 'Other';
        const parts = metric.name.split('.');
        const groupName = parts[0];
        return groupName;
    };

    /** Subscription for metrics updates */
    private metricsSubscription?: Subscription;

    /** Chart data configuration */
    chartData: ChartConfiguration<'line'>['data'] = {
        datasets: [{
            data: [],
            label: 'Value',
            borderColor: cssvar('--mat-sys-primary'),
            backgroundColor: cssvar('--mat-sys-primary-container'),
            pointBackgroundColor: cssvar('--mat-sys-primary'),
            pointBorderColor: cssvar('--mat-sys-primary'),
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
        interaction: {
            intersect: false,
            mode: 'nearest'
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    color: cssvar('--mat-sys-on-surface')
                },
                grid: {
                    color: cssvar('--mat-sys-outline-variant')
                },
                ticks: {
                    color: cssvar('--mat-sys-on-surface-variant')
                }
            },
            x: {
                type: 'time',
                time: {
                    unit: 'second'
                },
                reverse: false,
                grid: {
                    display: true,
                    color: cssvar('--mat-sys-outline-variant')
                },
                ticks: {
                    maxTicksLimit: 10,
                    color: cssvar('--mat-sys-on-surface-variant')
                }
            }
        },
        plugins: {
            legend: {
                display: false
            },
        }
    };

    @ViewChild('toolbarContent') toolbarContent?: TemplateRef<any>;
    @ViewChild(TableComponent) table!: TableComponent;

    constructor(
        public metricsService: MetricsService,
        private timeFormatService: TimeFormatService,
        private layout: LayoutComponent,
        private themeService: ThemeService
    ) {}

    ngOnInit(): void {
        // Subscribe to theme changes
        this.subscriptions.push(
            this.themeService.theme$.subscribe(() => {
                setTimeout(() => {
                    this.updateChartColors();
                });
            }),
            this.themeService.colorPalette$.subscribe(() => {
                setTimeout(() => {
                    this.updateChartColors();
                });
            })
        );
    }

    ngAfterViewInit(): void {
        setTimeout(() => {
            if (this.toolbarContent) {
                this.layout.activeToolbarContent = this.toolbarContent;
            }
        });

        // Subscribe to metrics updates
        this.metricsSubscription = this.metricsService.metrics$.subscribe(metrics => {
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
        return this.metricsService.getMetricDisplayValue(metric);
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
        this.chartData.datasets[0].data = history.map(h => ({ x: h.timestamp.getTime(), y: h.value }));
        // Force update
        this.chartData = { ...this.chartData };
    }


    /**
     * Updates the chart colors based on the current theme
     */
    private updateChartColors(): void {
        const scales = this.chartOptions.scales as any;
        const plugins = this.chartOptions.plugins;

        if (scales?.['y']?.grid) {
            scales['y'].grid.color = cssvar('--mat-sys-outline-variant');
        }
        if (scales?.['y']?.ticks) {
            scales['y'].ticks.color = cssvar('--mat-sys-on-surface-variant');
        }
        if (scales?.['y']?.title) {
            scales['y'].title.color = cssvar('--mat-sys-on-surface');
        }
        if (scales?.['x']?.grid) {
            scales['x'].grid.color = cssvar('--mat-sys-outline-variant');
        }
        if (scales?.['x']?.ticks) {
            scales['x'].ticks.color = cssvar('--mat-sys-on-surface-variant');
        }
        if (plugins?.legend?.labels) {
            plugins.legend.labels.color = cssvar('--mat-sys-on-surface');
        }

        // Update chart data
        this.chartData.datasets[0].borderColor = cssvar('--mat-sys-primary');
        this.chartData.datasets[0].backgroundColor = cssvar('--mat-sys-primary-container');
        this.chartData.datasets[0].pointBackgroundColor = cssvar('--mat-sys-primary');
        this.chartData.datasets[0].pointBorderColor = cssvar('--mat-sys-primary');

        // Force update
        this.chartData = { ...this.chartData };
        this.chartOptions = { ...this.chartOptions };
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
