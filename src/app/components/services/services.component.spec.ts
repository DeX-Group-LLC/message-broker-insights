import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { BehaviorSubject } from 'rxjs';
import { ServicesComponent, ServiceDetailsTab } from './services.component';
import { ServicesService, ServiceInfo, ServiceStatus } from '../../services/services.service';
import { TimeFormatService } from '../../services/time-format.service';
import { LayoutComponent } from '../layout/layout.component';
import { MetricsService, Metric } from '../../services/metrics.service';
import { TableComponent } from '../common/table/table.component';

/**
 * Test suite for ServicesComponent.
 * Tests the service management functionality including:
 * - Service display and formatting
 * - Service selection and details
 * - Status handling and heartbeat monitoring
 * - Time formatting
 * - Tab management
 */
describe('ServicesComponent', () => {
    let component: ServicesComponent;
    let fixture: ComponentFixture<ServicesComponent>;
    let mockServicesService: jasmine.SpyObj<ServicesService>;
    let mockTimeFormatService: jasmine.SpyObj<TimeFormatService>;
    let mockMetricsService: jasmine.SpyObj<MetricsService>;
    let mockLayoutComponent: jasmine.SpyObj<LayoutComponent>;

    const testServices: ServiceInfo[] = [
        {
            id: 'service1',
            name: 'Test Service 1',
            description: 'A test service',
            status: 'connected' as ServiceStatus,
            connectedAt: new Date(),
            lastHeartbeat: new Date()
        },
        {
            id: 'service2',
            name: '',
            description: '',
            status: 'disconnected' as ServiceStatus,
            connectedAt: new Date(),
            lastHeartbeat: new Date(Date.now() - 70000) // 70 seconds ago
        }
    ];

    const testMetric: Metric = {
        name: 'test.metric',
        value: 75.5,
        type: 'GAUGE',
        timestamp: new Date()
    };

    /**
     * Test setup before each test case.
     * Configures TestBed with required imports and service mocks.
     */
    beforeEach(async () => {
        mockServicesService = jasmine.createSpyObj('ServicesService', [
            'clearDisconnected',
            'fetchServiceSubscriptions',
            'fetchServiceMetrics'
        ], {
            services$: new BehaviorSubject(testServices).asObservable()
        });
        mockServicesService.fetchServiceSubscriptions.and.returnValue(Promise.resolve({
            subscriptions: [
                { topic: 'test.topic', priority: 1 }
            ]
        }));
        mockServicesService.fetchServiceMetrics.and.returnValue(Promise.resolve([testMetric]));

        mockTimeFormatService = jasmine.createSpyObj('TimeFormatService', ['getElapsedTime']);
        mockTimeFormatService.getElapsedTime.and.returnValue('1 minute ago');

        mockMetricsService = jasmine.createSpyObj('MetricsService', ['getMetricDisplayValue']);
        mockMetricsService.getMetricDisplayValue.and.returnValue('75.5%');

        mockLayoutComponent = jasmine.createSpyObj('LayoutComponent', [], {
            activeToolbarContent: undefined
        });

        await TestBed.configureTestingModule({
            imports: [
                NoopAnimationsModule,
                MatButtonModule,
                MatCardModule,
                MatIconModule,
                MatTooltipModule,
                MatTabsModule,
                TableComponent,
                ServicesComponent
            ],
            providers: [
                { provide: ServicesService, useValue: mockServicesService },
                { provide: TimeFormatService, useValue: mockTimeFormatService },
                { provide: MetricsService, useValue: mockMetricsService },
                { provide: LayoutComponent, useValue: mockLayoutComponent }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(ServicesComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    /**
     * Test case: Component Creation
     * Verifies that the ServicesComponent can be created successfully.
     */
    it('should create', () => {
        expect(component).toBeTruthy();
    });

    /**
     * Test case: Column Configuration
     * Verifies that table columns are properly configured.
     */
    it('should have correct column configuration', () => {
        expect(component.columns.length).toBe(6);
        expect(component.columns.map(c => c.name)).toEqual([
            'id',
            'name',
            'description',
            'status',
            'connectedAt',
            'heartbeat'
        ]);
    });

    /**
     * Test case: Service Display
     * Verifies that service information is properly displayed.
     */
    it('should display service information correctly', () => {
        expect(component.getDisplayName(testServices[0])).toBe('Test Service 1');
        expect(component.getDisplayName(testServices[1])).toBe('service2');
        expect(component.getDisplayDescription(testServices[0])).toBe('A test service');
        expect(component.getDisplayDescription(testServices[1])).toBe('No description');
    });

    /**
     * Test case: Service Status
     * Verifies that service status is properly handled.
     */
    it('should handle service status correctly', () => {
        expect(component.getStatusClass('connected')).toBe('success');
        expect(component.getStatusClass('disconnected')).toBe('error');
        expect(component.getFormattedStatus('connected')).toBe('Connected');
    });

    /**
     * Test case: Heartbeat Status
     * Verifies that heartbeat status is properly calculated.
     */
    it('should calculate heartbeat status correctly', () => {
        expect(component.getHeartbeatStatus(testServices[0])).toBe('');
        expect(component.getHeartbeatStatus(testServices[1])).toBe('error');
    });

    /**
     * Test case: Service Selection
     * Verifies that service selection works correctly.
     */
    it('should handle service selection', () => {
        component.selectService(testServices[0]);
        expect(component.selectedService).toBe(testServices[0]);
        expect(component.selectedTab).toBe(ServiceDetailsTab.Overview);

        // Selecting same service should not change anything
        const currentTab = component.selectedTab;
        component.selectService(testServices[0]);
        expect(component.selectedTab).toBe(currentTab);
    });

    /**
     * Test case: Tab Changes
     * Verifies that tab changes are properly handled.
     */
    it('should handle tab changes', () => {
        component.onTabChange(ServiceDetailsTab.Metrics);
        expect(component.selectedTab).toBe(ServiceDetailsTab.Metrics);
    });

    /**
     * Test case: Service Property Checks
     * Verifies that service property checks work correctly.
     */
    it('should check service properties correctly', () => {
        expect(component.hasName(testServices[0])).toBeTrue();
        expect(component.hasName(testServices[1])).toBeFalse();
        expect(component.hasDescription(testServices[0])).toBeTrue();
        expect(component.hasDescription(testServices[1])).toBeFalse();
    });

    /**
     * Test case: Time Formatting
     * Verifies that timestamps are properly formatted.
     */
    it('should format time correctly', () => {
        const date = new Date();
        expect(component.getElapsedTime(date)).toBe('1 minute ago');
        expect(mockTimeFormatService.getElapsedTime).toHaveBeenCalledWith(date);
        expect(component.getFormattedDate(date)).toBe(date.toLocaleString());
    });

    /**
     * Test case: Metric Display
     * Verifies that metrics are properly displayed.
     */
    it('should display metrics correctly', () => {
        expect(component.getMetricDisplayValue(testMetric)).toBe('75.5%');
        expect(mockMetricsService.getMetricDisplayValue).toHaveBeenCalledWith(testMetric);
    });

    /**
     * Test case: Component Cleanup
     * Verifies that resources are properly cleaned up on destroy.
     */
    it('should clean up on destroy', () => {
        component.ngOnDestroy();
        expect(mockLayoutComponent.activeToolbarContent).toBeUndefined();
    });
});