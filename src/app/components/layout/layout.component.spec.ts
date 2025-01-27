/**
 * Test suite for LayoutComponent.
 * Tests the main layout functionality including:
 * - Navigation sidebar behavior
 * - Theme switching
 * - Connection status display
 * - Observable initialization
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { LayoutComponent } from './layout.component';
import { ThemeService } from '../../services/theme.service';
import { WebsocketService } from '../../services/websocket.service';
import { ConnectionState, ConnectionDetails } from '../../services/websocket.service';
import { SingleEmitter } from '../../utils/single-emitter';

describe('LayoutComponent', () => {
    let component: LayoutComponent;
    let fixture: ComponentFixture<LayoutComponent>;
    let themeService: jasmine.SpyObj<ThemeService>;
    let websocketService: jasmine.SpyObj<WebsocketService>;
    let dialog: jasmine.SpyObj<MatDialog>;

    /**
     * Test setup before each test case.
     * Configures TestBed with required imports and service mocks.
     */
    beforeEach(async () => {
        themeService = jasmine.createSpyObj('ThemeService', ['setTheme']);

        const stateEmitter = new SingleEmitter<(state: ConnectionState) => void>();
        const latencyEmitter = new SingleEmitter<(latency: number) => void>();
        const connectionEmitter = new SingleEmitter<(event: any) => void>();

        websocketService = jasmine.createSpyObj('WebsocketService', [], {
            state: ConnectionState.DISCONNECTED,
            details: {
                state: ConnectionState.DISCONNECTED,
                url: 'ws://localhost:3000',
                reconnectAttempts: 0,
                events: []
            } as ConnectionDetails,
            stateChange$: stateEmitter,
            latencyUpdate$: latencyEmitter,
            connection$: connectionEmitter
        });

        dialog = jasmine.createSpyObj('MatDialog', ['open']);

        await TestBed.configureTestingModule({
            imports: [
                RouterTestingModule,
                NoopAnimationsModule,
                LayoutComponent
            ],
            providers: [
                { provide: ThemeService, useValue: themeService },
                { provide: WebsocketService, useValue: websocketService },
                { provide: MatDialog, useValue: dialog }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(LayoutComponent);
        component = fixture.componentInstance;
    });

    /**
     * Test case: Component Creation
     * Verifies that the LayoutComponent can be created successfully.
     */
    it('should create', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    /**
     * Test case: Navbar Toggle
     * Verifies that the navigation sidebar can be toggled between expanded and collapsed states.
     */
    it('should toggle navbar state', () => {
        fixture.detectChanges();
        expect(component.isExpanded).toBeTrue();
        component.toggleNavbar();
        expect(component.isExpanded).toBeFalse();
        component.toggleNavbar();
        expect(component.isExpanded).toBeTrue();
    });

    /**
     * Test case: Theme Setting
     * Verifies that themes can be set through the ThemeService.
     */
    it('should set theme', () => {
        fixture.detectChanges();
        component.setTheme('dark');
        expect(themeService.setTheme).toHaveBeenCalledWith('dark');
    });

    /**
     * Test case: Theme Icons
     * Verifies that correct Material Icons are returned for different themes.
     */
    it('should get correct theme icon', () => {
        fixture.detectChanges();
        expect(component.getThemeIcon('light')).toBe('light_mode');
        expect(component.getThemeIcon('dark')).toBe('dark_mode');
        expect(component.getThemeIcon('system')).toBe('brightness_auto');
        expect(component.getThemeIcon('invalid' as any)).toBe('light_mode');
    });

    /**
     * Test case: Theme Labels
     * Verifies that theme names are properly formatted for display.
     */
    it('should get correct theme label', () => {
        fixture.detectChanges();
        expect(component.getThemeLabel('light')).toBe('Light');
        expect(component.getThemeLabel('dark')).toBe('Dark');
        expect(component.getThemeLabel('system')).toBe('System');
    });

    /**
     * Test case: Connection Icons
     * Verifies that correct Material Icons are returned for different connection states.
     */
    it('should get correct connection icon', () => {
        fixture.detectChanges();
        expect(component.getConnectionIcon(ConnectionState.CONNECTING)).toBe('cloud_sync');
        expect(component.getConnectionIcon(ConnectionState.RECONNECTING)).toBe('cloud_sync');
        expect(component.getConnectionIcon(ConnectionState.CONNECTED)).toBe('cloud_done');
        expect(component.getConnectionIcon(ConnectionState.DISCONNECTED)).toBe('cloud_off');
        expect(component.getConnectionIcon('invalid' as any)).toBe('warning');
    });

    /**
     * Test case: Connection Labels
     * Verifies that connection states are properly formatted for display.
     */
    it('should get correct connection label', () => {
        fixture.detectChanges();
        expect(component.getConnectionLabel(ConnectionState.CONNECTING)).toBe('Connecting');
        expect(component.getConnectionLabel(ConnectionState.RECONNECTING)).toBe('Reconnecting');
        expect(component.getConnectionLabel(ConnectionState.CONNECTED)).toBe('Connected');
        expect(component.getConnectionLabel(ConnectionState.DISCONNECTED)).toBe('Disconnected');
        expect(component.getConnectionLabel('invalid' as any)).toBe('Invalid');
    });

    /**
     * Test case: Observable Initialization
     * Verifies that all required observables are properly initialized.
     */
    it('should initialize observables in ngOnInit', () => {
        fixture.detectChanges();
        component.ngOnInit();
        expect(component.currentPageTitle$).toBeTruthy();
        expect(component.currentPageIcon$).toBeTruthy();
        expect(component.connectionState$).toBeTruthy();
        expect(component.connectionDetails$).toBeTruthy();
    });

    /**
     * Test case: Date Formatting
     * Verifies that dates are properly formatted for display.
     */
    it('should format date correctly', () => {
        fixture.detectChanges();
        const date = new Date();
        expect(component.formatDate(date)).toBe(date.toLocaleString());
        expect(component.formatDate(undefined)).toBe('Never');
    });

    /**
     * Test case: Latency Formatting
     * Verifies that latency values are properly formatted for display.
     */
    it('should format latency correctly', () => {
        fixture.detectChanges();
        expect(component.formatLatency(100)).toBe('100ms');
        expect(component.formatLatency(undefined)).toBe('Unknown');
    });

    /**
     * Test case: Connection Tooltip
     * Verifies that connection tooltips contain all required information.
     */
    it('should get connection tooltip', () => {
        fixture.detectChanges();
        const details: ConnectionDetails = {
            state: ConnectionState.CONNECTED,
            url: 'ws://localhost:3000',
            lastConnected: new Date(),
            reconnectAttempts: 0,
            latency: 100,
            events: []
        };
        const tooltip = component.getConnectionTooltip(details);
        expect(tooltip).toContain('Server:');
        expect(tooltip).toContain('Status:');
        expect(tooltip).toContain('Last Connected:');
        expect(tooltip).toContain('Latency:');
    });
});