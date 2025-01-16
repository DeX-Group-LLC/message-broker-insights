import { Component, OnDestroy, ViewChild, AfterViewInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { NgChartsModule, BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartOptions, Point, TooltipItem } from 'chart.js';
import 'chartjs-adapter-moment';
import { MetricsService, Metric } from '../../services/metrics.service';
import { ThemeService } from '../../services/theme.service';
import { TimeFormatService } from '../../services/time-format.service';
import { LayoutComponent } from '../layout/layout.component';
import { ExportComponent } from '../common/export/export.component';
import { TableComponent, TableColumn } from '../common/table/table.component';
import { cssvar, hexToRGBA, scaledLightDark, scaledMix } from '../utils/style.utils';

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
    selectedMetrics: Metric[] = [];

    /** Whether the chart is paused */
    isPaused = false;

    /** Toggles the pause state */
    togglePause(): void {
        this.isPaused = !this.isPaused;
    }

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
    chartData: ChartConfiguration<'line', Point[]>['data'] = {
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
            /*y: {
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
            },*/
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
                position: 'top',
                labels: {
                    padding: 20,
                    color: cssvar('--mat-sys-on-surface'),
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                callbacks: {
                    label: (context: TooltipItem<'line'>) => `${context.dataset.label}: ${this.getMetricDisplayValue((context.raw as any).metric)}`
                }
            }
        }
    };

    @ViewChild(BaseChartDirective) private baseChart?: BaseChartDirective;
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
        this.themeService.themeChanged$.on(this._updateChartColorsDelayed);
    }

    ngAfterViewInit(): void {
        setTimeout(() => {
            if (this.toolbarContent) {
                this.layout.activeToolbarContent = this.toolbarContent;
            }
        });

        // Subscribe to metrics updates
        this.metricsSubscription = this.metricsService.metrics$.subscribe(this._updateChart);
    }

    ngOnDestroy(): void {
        this.layout.activeToolbarContent = undefined;
        this.metricsSubscription?.unsubscribe();
        this.themeService.themeChanged$.off(this._updateChartColorsDelayed);
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
        this.selectedMetrics = metrics;

        // Update the chart
        this.updateChart();
    }

    /**
     * Updates the chart with data for the selected metric
     */
    updateChart(): void {
        // If paused, do nothing
        if (this.isPaused) return;

        // Clear chart data
        this.chartData.datasets = [];
        this.chartData.labels = [];
        // Remove all y-axes
        for (const scale of Object.keys(this.chartOptions.scales!)) {
            if (scale.startsWith('y-')) {
                delete this.chartOptions.scales![scale];
            }
        }

        // If no metric selected, do nothing
        if (this.selectedMetrics.length) {
            const showYAxis = this.selectedMetrics.length === 1;
            const primary = cssvar('--mat-sys-primary');
            const primaryContainer = cssvar('--mat-sys-primary-container');

            // Add data for each selected metric
            for (const metric of this.selectedMetrics) {
                // Get metric history
                const history = this.metricsService.getMetricHistory(metric.name);
                if (!history.length) return;

                // Add y-axis for each metric
                this.chartOptions.scales![`y-${this.chartData.datasets.length}`] = {
                    display: showYAxis,
                    beginAtZero: true,
                    ticks: {
                        display: showYAxis
                    },
                    grid: {
                        display: showYAxis
                    }
                };

                // Add data for each metric
                const alpha = this.chartData.datasets.length / Math.max(1, this.selectedMetrics.length - 1);
                const color = scaledMix(primary, primaryContainer, 1 - alpha);
                this.chartData.datasets.push({
                    data: history.map(h => {
                        const x = Math.round(h.timestamp.getTime() / 1000) * 1000;
                        return { x, y: h.value, metric: h };
                    }),
                    label: metric.name,
                    borderColor: color,
                    pointBorderColor: color,
                    backgroundColor: color,
                    pointBackgroundColor: color,
                    tension: 0.1,
                    yAxisID: `y-${this.chartData.datasets.length}`
                });
            }

            this.chartOptions.interaction!.mode = this.chartData.datasets.length > 1 ? 'index' : 'nearest';
        }

        // Update the chart
        if (this.baseChart) {
            // Clone chart data and options to avoid mutating the original objects, and forcing a rebuild of the entire chart
            //this.chartData = { ...this.chartData };
            this.chartOptions = { ...this.chartOptions };
            this.baseChart.update();
        }
    }
    private _updateChart = this.updateChart.bind(this);

    /**
     * Updates the chart colors based on the current theme
     */
    private updateChartColors(): void {
        const scales = this.chartOptions.scales as any;
        const plugins = this.chartOptions.plugins;

        if (scales?.['x']?.grid) {
            scales['x'].grid.color = cssvar('--mat-sys-outline-variant');
        }
        if (scales?.['x']?.ticks) {
            scales['x'].ticks.color = cssvar('--mat-sys-on-surface-variant');
        }
        if (plugins?.legend?.labels) {
            plugins.legend.labels.color = cssvar('--mat-sys-on-surface');
        }

        const primary = cssvar('--mat-sys-primary');
        const primaryContainer = cssvar('--mat-sys-primary-container');

        // Update chart data
        for (let i = 0; i < this.chartData.datasets.length; i++) {
            const alpha = i / Math.max(1, this.chartData.datasets.length - 1);
            const color = scaledMix(primary, primaryContainer, 1 - alpha);
            this.chartData.datasets[i].borderColor = color;
            this.chartData.datasets[i].backgroundColor = color;
            this.chartData.datasets[i].pointBackgroundColor = color;
            this.chartData.datasets[i].pointBorderColor = color;
        }

        // Update the chart after color changes
        this.baseChart?.update();
    }
    private _updateChartColors = this.updateChartColors.bind(this);
    private _updateChartColorsDelayed = () => {
        setTimeout(this._updateChartColors);
    };

    /**
     * Gets chart data in exportable format
     * @returns Chart data for export
     */
    getChartExportData(): any {
        if (!this.chartData.datasets.length) return [];

        // Get data for each selected metric
        const data = new Map<number, Map<string, number>>();
        for (const dataset of this.chartData.datasets) {
            for (const h of dataset.data) {
                // Get set for this timestamp
                const set = data.get(h.x) || new Map<string, number>();
                // Add value to set
                set.set(dataset.label!.toLowerCase(), h.y);
                // Add set to data
                data.set(h.x, set);
            }
        }

        const exportData = [];
        for (const [timestamp, set] of data.entries()) {
            exportData.push({
                timestamp: new Date(timestamp),
                ...Object.fromEntries(set.entries())
            });
        }
        // Sort by timestamp
        exportData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Return export data
        return exportData;
    }

    /**
     * Refreshes metrics data
     */
    async refreshMetrics(): Promise<Metric[]> {
        await this.metricsService.refresh();
        return this.metricsService.getCurrentMetrics();
    }
}
