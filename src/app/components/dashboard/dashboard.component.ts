import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { Subscription } from 'rxjs';
import { ChartConfiguration, ChartOptions, Tick, TooltipItem } from 'chart.js';
import 'chartjs-adapter-moment';
import { BaseChartDirective } from 'ng2-charts';
import { MetricsService, Metric } from '../../services/metrics.service';
import { LogService } from '../../services/log.service';
import { TimeFormatService } from '../../services/time-format.service';
import { ThemeService } from '../../services/theme.service';
import { TableComponent, TableColumn } from '../common/table/table.component';
import { cssvar } from '../utils/style.utils';

interface SystemMetrics {
    systemCpuPercent?: Metric[];
    processCpuPercent?: Metric[];
    systemMemoryPercent?: Metric[];
    processMemoryPercent?: Metric[];
    systemUptime?: Metric;
    processUptime?: Metric;
    connectedServices?: Metric;
    messageRate?: Metric;
    errorCount?: Metric;
    avgMessageSize?: Metric;
}

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
    imports: [
        CommonModule,
        MatCardModule,
        MatTableModule,
        BaseChartDirective,
        TableComponent
    ],
    standalone: true
})
export class DashboardComponent implements OnInit, OnDestroy {
    /** Column configurations */
    columns: TableColumn[] = [
        { name: 'timestamp', label: 'Timestamp', sortable: true, filterable: true },
        { name: 'level', label: 'Level', sortable: true, filterable: true },
        { name: 'module', label: 'Module', sortable: true, filterable: true },
        { name: 'message', label: 'Message', sortable: true, filterable: true }
    ];

    private subscriptions: Subscription[] = [];

    /** Chart data configuration */
    chartData: ChartConfiguration<'line'>['data'] = {
        labels: [],
        datasets: [{
            label: 'System CPU',
            data: [],
            borderColor: '#1976D2',         // Darker Blue
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            pointBackgroundColor: '#1976D2',
            pointBorderColor: '#1976D2',
            borderWidth: 2,
            tension: 0.2,
            fill: true
        }, {
            label: 'Process CPU',
            data: [],
            borderColor: '#7B1FA2',         // Darker Purple
            backgroundColor: 'rgba(123, 31, 162, 0.1)',
            pointBackgroundColor: '#7B1FA2',
            pointBorderColor: '#7B1FA2',
            borderWidth: 2,
            tension: 0.2,
            fill: true
        }, {
            label: 'System Memory',
            data: [],
            borderColor: '#64B5F6',         // Lighter Blue
            backgroundColor: 'rgba(100, 181, 246, 0.1)',
            pointBackgroundColor: '#64B5F6',
            pointBorderColor: '#64B5F6',
            borderWidth: 2,
            tension: 0.2,
            fill: true
        }, {
            label: 'Process Memory',
            data: [],
            borderColor: '#BA68C8',         // Lighter Purple
            backgroundColor: 'rgba(186, 104, 200, 0.1)',
            pointBackgroundColor: '#BA68C8',
            pointBorderColor: '#BA68C8',
            borderWidth: 2,
            tension: 0.2,
            fill: true
        }]
    };

    /** Chart options configuration */
    chartOptions: ChartOptions = {
        responsive: true,
        animation: false,
        maintainAspectRatio: false,
        interaction: {
            intersect: false,
            mode: 'index'
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                title: {
                    display: true,
                    color: cssvar('--mat-sys-on-surface')
                },
                grid: {
                    color: cssvar('--mat-sys-outline-variant')
                },
                ticks: {
                    color: cssvar('--mat-sys-on-surface-variant'),
                    callback: (value: string | number, index: number, ticks: Tick[]) => `${value}%`
                }
            },
            x: {
                type: 'time',
                time: {
                    unit: 'second'
                },
                display: true,
                title: {
                    display: false
                },
                grid: {
                    display: true,
                    color: cssvar('--mat-sys-outline-variant')
                },
                ticks: {
                    maxTicksLimit: 10,
                    color: cssvar('--mat-sys-on-surface-variant'),
                    callback: (value: string | number, index: number, ticks: Tick[]) => new Date(value).toLocaleTimeString()
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
                    label: (context: TooltipItem<'line'>) => `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`
                }
            }
        }
    };

    metrics: SystemMetrics = {};

    @ViewChild(BaseChartDirective) private baseChart?: BaseChartDirective;

    constructor(
        private metricsService: MetricsService,
        public logService: LogService,
        private timeFormatService: TimeFormatService,
        private themeService: ThemeService
    ) {}

    ngOnInit(): void {
        // Subscribe to metrics
        this.subscriptions.push(
            this.metricsService.metrics$.subscribe(metrics => {
                this.metrics = {
                    systemCpuPercent: this.metricsService.getMetricHistory('system.cpu.percent'),
                    processCpuPercent: this.metricsService.getMetricHistory('process.cpu.percent'),
                    systemMemoryPercent: this.metricsService.getMetricHistory('system.memory.percent'),
                    processMemoryPercent: this.metricsService.getMetricHistory('process.memory.percent'),
                    systemUptime: this.metricsService.getMetric('system.uptime'),
                    processUptime: this.metricsService.getMetric('process.uptime'),
                    connectedServices: this.metricsService.getMetric('connection.active'),
                    messageRate: this.metricsService.getMetric('router.message.rate'),
                    errorCount: this.metricsService.getMetric('router.message.rate.error'),
                    avgMessageSize: this.metricsService.getMetric('router.message.size.avg')
                };
                this.updateCharts();
            })
        );

        // Subscribe to theme changes
        this.themeService.themeChanged$.on(this._updateChartColorsDelayed);
    }

    ngAfterViewInit(): void {
        setTimeout(() => {
            this.updateChartColors();
            this.updateCharts();
        }, 100);
    }

    ngOnDestroy(): void {
        // Clean up subscriptions and charts
        for (const sub of this.subscriptions) {
            sub.unsubscribe();
        }
        this.subscriptions = [];
        this.themeService.themeChanged$.off(this._updateChartColorsDelayed);
    }

    /**
     * Converts a metric array to an array of { x: number, y: number } pairs.
     * @param metric - The metric array to convert.
     * @returns An array of { x: number, y: number } pairs.
     */
    private toXY(metric: Metric[]): { x: number, y: number }[] {
        return Array.from({ length: metric.length }, (_, i) => {
            const x = Math.round(metric[i].timestamp.getTime() / 1000) * 1000;
            return { x, y: metric[i].value * 100 };
        });
    }

    /**
     * Updates the charts with the latest metrics.
     */
    private async updateCharts(): Promise<void> {
        this.chartData.datasets[0].data = this.toXY(this.metrics.systemCpuPercent || []);
        this.chartData.datasets[1].data = this.toXY(this.metrics.processCpuPercent || []);
        this.chartData.datasets[2].data = this.toXY(this.metrics.systemMemoryPercent || []);
        this.chartData.datasets[3].data = this.toXY(this.metrics.processMemoryPercent || []);

        // Force update
        this.baseChart?.update();
    }

    formatUptime(seconds: number): string {
        return this.timeFormatService.renderElapsedTime(seconds * 1000);
    }

    formatNumber(value: number): string {
        return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
     * Updates the chart colors based on the current theme
     */
    private updateChartColors(): void {
        const scales = this.chartOptions.scales as any;
        const plugins = this.chartOptions.plugins;

        const gridColor = cssvar('--mat-sys-outline-variant');
        const tickColor = cssvar('--mat-sys-on-surface-variant');
        const titleColor = cssvar('--mat-sys-on-surface');

        if (scales?.['y']?.grid) {
            scales['y'].grid.color = gridColor;
        }
        if (scales?.['y']?.ticks) {
            scales['y'].ticks.color = tickColor;
        }
        if (scales?.['y']?.title) {
            scales['y'].title.color = titleColor;
        }
        if (scales?.['x']?.grid) {
            scales['x'].grid.color = gridColor;
        }
        if (scales?.['x']?.ticks) {
            scales['x'].ticks.color = tickColor;
        }
        if (plugins?.legend?.labels) {
            plugins.legend.labels.color = titleColor;
        }

        // Force update
        this.baseChart?.update();
    }
    private _updateChartColors = this.updateChartColors.bind(this);
    private _updateChartColorsDelayed = () => {
        setTimeout(this._updateChartColors);
    };
}
