import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BehaviorSubject } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { MetricsComponent } from './metrics.component';
import { MetricsService, Metric } from '../../services/metrics.service';
import { ThemeService } from '../../services/theme.service';
import { TimeFormatService } from '../../services/time-format.service';
import { LayoutComponent } from '../layout/layout.component';
import { TableComponent } from '../common/table/table.component';

/**
 * Test suite for MetricsComponent.
 * Tests the metrics visualization functionality including:
 * - Metric display and formatting
 * - Chart updates and configuration
 * - Theme changes
 * - Selection handling
 * - Service integration
 */
describe('MetricsComponent', () => {
    let component: MetricsComponent;
    let fixture: ComponentFixture<MetricsComponent>;
    let mockMetricsService: jasmine.SpyObj<MetricsService>;
    let mockTimeFormatService: jasmine.SpyObj<TimeFormatService>;
    let mockThemeService: jasmine.SpyObj<ThemeService>;
    let mockLayoutComponent: jasmine.SpyObj<LayoutComponent>;
    let metrics$: BehaviorSubject<Metric[]>;

    const testMetrics: Metric[] = [
        {
            name: 'system.cpu.usage',
            value: 75.5,
            type: 'GAUGE',
            timestamp: new Date()
        },
        {
            name: 'system.memory.used',
            value: 8589934592, // 8GB in bytes
            type: 'GAUGE',
            timestamp: new Date()
        }
    ];

    /**
     * Test setup before each test case.
     * Configures TestBed with required imports and service mocks.
     */
    beforeEach(async () => {
        metrics$ = new BehaviorSubject<Metric[]>([]);

        mockMetricsService = jasmine.createSpyObj('MetricsService', [
            'getMetricDisplayValue',
            'clearHistory',
            'getMetricHistory'
        ], {
            metrics$: metrics$.asObservable()
        });
        mockMetricsService.getMetricDisplayValue.and.returnValue('75.5%');
        mockMetricsService.getMetricHistory.and.returnValue([
            {
                name: 'system.cpu.usage',
                value: 70.0,
                type: 'GAUGE',
                timestamp: new Date(Date.now() - 60000) // 1 minute ago
            },
            {
                name: 'system.cpu.usage',
                value: 75.5,
                type: 'GAUGE',
                timestamp: new Date()
            }
        ]);

        mockTimeFormatService = jasmine.createSpyObj('TimeFormatService', ['getElapsedTime']);
        mockTimeFormatService.getElapsedTime.and.returnValue('1 minute ago');

        mockThemeService = jasmine.createSpyObj('ThemeService', [], {
            themeChanged$: { on: jasmine.createSpy(), off: jasmine.createSpy() }
        });

        mockLayoutComponent = jasmine.createSpyObj('LayoutComponent', [], {
            activeToolbarContent: undefined
        });

        await TestBed.configureTestingModule({
            imports: [
                NoopAnimationsModule,
                FormsModule,
                MatButtonModule,
                MatCardModule,
                MatIconModule,
                MatTooltipModule,
                BaseChartDirective,
                TableComponent,
                MetricsComponent
            ],
            providers: [
                { provide: MetricsService, useValue: mockMetricsService },
                { provide: TimeFormatService, useValue: mockTimeFormatService },
                { provide: ThemeService, useValue: mockThemeService },
                { provide: LayoutComponent, useValue: mockLayoutComponent }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(MetricsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    /**
     * Test case: Component Creation
     * Verifies that the MetricsComponent can be created successfully.
     */
    it('should create', () => {
        expect(component).toBeTruthy();
    });

    /**
     * Test case: Metric Display
     * Verifies that metrics are properly displayed and formatted.
     */
    it('should display formatted metric values', () => {
        const metric = testMetrics[0];
        const displayValue = component.getMetricDisplayValue(metric);
        expect(mockMetricsService.getMetricDisplayValue).toHaveBeenCalledWith(metric);
        expect(displayValue).toBe('75.5%');
    });

    /**
     * Test case: Metric Type Classes
     * Verifies that metric type classes are correctly generated.
     */
    it('should generate correct metric type classes', () => {
        expect(component.getMetricClass('GAUGE')).toBe('gauge-metric');
        expect(component.getMetricClass('COUNTER')).toBe('counter-metric');
    });

    /**
     * Test case: Date Formatting
     * Verifies that dates are properly formatted.
     */
    it('should format dates correctly', () => {
        const date = new Date();
        const formatted = component.getFormattedDate(date);
        expect(formatted).toBe(date.toLocaleString());
    });

    /**
     * Test case: Elapsed Time
     * Verifies that elapsed time is properly calculated and formatted.
     */
    it('should calculate elapsed time correctly', () => {
        const date = new Date();
        const elapsed = component.getElapsedTime(date);
        expect(mockTimeFormatService.getElapsedTime).toHaveBeenCalledWith(date);
        expect(elapsed).toBe('1 minute ago');
    });

    /**
     * Test case: Metric Selection
     * Verifies that metric selection updates the chart correctly.
     */
    it('should handle metric selection', () => {
        const selectedMetrics = [testMetrics[0]];
        component.onSelectionChange(selectedMetrics);
        expect(component.selectedMetrics).toEqual(selectedMetrics);
        // Chart should be updated with the selected metric
        expect(component.chartData.datasets.length).toBe(1);
    });

    /**
     * Test case: Pause Functionality
     * Verifies that pausing stops chart updates.
     */
    it('should handle pause/resume', () => {
        expect(component.isPaused).toBeFalse();
        component.togglePause();
        expect(component.isPaused).toBeTrue();
        // Chart updates should be skipped when paused
        component.updateChart();
        expect(component.chartData.datasets.length).toBe(0);
    });

    /**
     * Test case: History Clear
     * Verifies that metric history can be cleared.
     */
    it('should clear metric history', () => {
        component.clearHistory();
        expect(mockMetricsService.clearHistory).toHaveBeenCalled();
    });

    /**
     * Test case: Metric Grouping
     * Verifies that metrics are properly grouped by their names.
     */
    it('should group metrics correctly', () => {
        expect(component.getMetricGroup(testMetrics[0])).toBe('system');
        expect(component.getMetricGroup({ name: '', value: 0, type: 'GAUGE', timestamp: new Date() })).toBe('Other');
    });

    /**
     * Test case: Component Cleanup
     * Verifies that subscriptions are properly cleaned up on destroy.
     */
    it('should clean up on destroy', () => {
        component.ngOnDestroy();
        expect(mockThemeService.themeChanged$.off).toHaveBeenCalled();
        expect(mockLayoutComponent.activeToolbarContent).toBeUndefined();
    });
});