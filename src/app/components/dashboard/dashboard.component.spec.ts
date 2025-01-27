/**
 * Test suite for DashboardComponent.
 * Tests the dashboard functionality including:
 * - Component creation
 * - Chart initialization
 * - Metric updates
 * - Theme changes
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { MetricsService, Metric } from '../../services/metrics.service';
import { LogService } from '../../services/log.service';
import { TimeFormatService } from '../../services/time-format.service';
import { ThemeService } from '../../services/theme.service';
import { Observable, of } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { TableComponent } from '../common/table/table.component';
import { BaseChartDirective } from 'ng2-charts';
import { SingleEmitter } from '../../utils/single-emitter';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

// Register Chart.js components
Chart.register(...registerables);

describe('DashboardComponent', () => {
    let component: DashboardComponent;
    let fixture: ComponentFixture<DashboardComponent>;
    let mockMetricsService: jasmine.SpyObj<MetricsService>;
    let mockLogService: jasmine.SpyObj<LogService>;
    let mockTimeFormatService: jasmine.SpyObj<TimeFormatService>;
    let mockThemeService: jasmine.SpyObj<ThemeService>;
    let mockThemeChangedEmitter: SingleEmitter<(mode: string, colorPalette: any) => void>;
    let metricsSubject: Observable<Metric[]>;

    /**
     * Test setup before each test case.
     * Configures TestBed with required imports and service mocks.
     */
    beforeEach(async () => {
        // Create mock services
        mockMetricsService = jasmine.createSpyObj('MetricsService', ['getMetricHistory', 'getMetric']);
        metricsSubject = of([]); // Use Observable instead of BehaviorSubject
        mockMetricsService.metrics$ = metricsSubject;

        mockLogService = jasmine.createSpyObj('LogService', ['']);
        mockTimeFormatService = jasmine.createSpyObj('TimeFormatService', ['renderElapsedTime']);
        mockThemeService = jasmine.createSpyObj('ThemeService', ['']);

        // Create proper SingleEmitter for theme changes
        mockThemeChangedEmitter = new SingleEmitter();
        mockThemeService.themeChanged$ = mockThemeChangedEmitter;

        await TestBed.configureTestingModule({
            imports: [
                MatCardModule,
                MatTableModule,
                TableComponent,
                DashboardComponent,
                BaseChartDirective,
                NoopAnimationsModule  // Add NoopAnimationsModule for tests
            ],
            providers: [
                { provide: MetricsService, useValue: mockMetricsService },
                { provide: LogService, useValue: mockLogService },
                { provide: TimeFormatService, useValue: mockTimeFormatService },
                { provide: ThemeService, useValue: mockThemeService }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(DashboardComponent);
        component = fixture.componentInstance;
    });

    /**
     * Test case: Component Creation
     * Verifies that the DashboardComponent can be created successfully.
     */
    it('should create', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    /**
     * Test case: Chart Initialization
     * Verifies that the chart is properly initialized with default data.
     */
    it('should initialize chart with empty data', () => {
        fixture.detectChanges();
        expect(component.chartData.datasets.length).toBe(4);
        expect(component.chartData.datasets[0].data.length).toBe(0);
    });

    /**
     * Test case: Metric Updates
     * Verifies that the chart updates when new metrics are received.
     */
    it('should update charts when metrics change', () => {
        const mockMetrics: Metric = {
            name: 'system.cpu.percent',
            type: 'gauge',
            value: 0.5,
            timestamp: new Date()
        };

        mockMetricsService.getMetricHistory.and.returnValue([mockMetrics]);

        fixture.detectChanges();
        // Use the metrics$ observable directly
        metricsSubject = of([mockMetrics]);
        mockMetricsService.metrics$ = metricsSubject;

        expect(mockMetricsService.getMetricHistory).toHaveBeenCalled();
        expect(component.chartData.datasets[0].data.length).toBe(1);
    });

    /**
     * Test case: Cleanup
     * Verifies that subscriptions are cleaned up on component destruction.
     */
    it('should clean up subscriptions on destroy', () => {
        fixture.detectChanges();
        const offSpy = spyOn(mockThemeChangedEmitter, 'off');
        component.ngOnDestroy();
        expect(offSpy).toHaveBeenCalled();
    });
});
