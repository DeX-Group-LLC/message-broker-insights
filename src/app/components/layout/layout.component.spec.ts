import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LayoutComponent } from './layout.component';
import { ThemeService } from '../../services/theme.service';
import { WebsocketService, ConnectionState, ConnectionDetails, ConnectionEvent, ConnectionEventType } from '../../services/websocket.service';
import { BehaviorSubject } from 'rxjs';
import { provideRouter, Routes } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

/**
 * Mock component for metrics route testing.
 * Empty template as we don't need to test its functionality.
 */
@Component({ template: '' })
class MockMetricsComponent {}

/**
 * Mock component for logs route testing.
 * Empty template as we don't need to test its functionality.
 */
@Component({ template: '' })
class MockLogsComponent {}

// Type definitions for WebSocket event callbacks
/** Callback type for connection state changes */
type EventCallback = (state: ConnectionState) => void;
/** Callback type for latency updates */
type LatencyCallback = (latency: number) => void;
/** Callback type for connection events */
type ConnectionEventCallback = (event: ConnectionEvent) => void;

/**
 * Test suite for the LayoutComponent.
 * Tests the main layout functionality including:
 * - Theme switching
 * - Navigation
 * - WebSocket connection handling
 * - UI state management
 */
describe('LayoutComponent', () => {
    let component: LayoutComponent;
    let fixture: ComponentFixture<LayoutComponent>;
    let themeService: jasmine.SpyObj<ThemeService>;
    let websocketService: jasmine.SpyObj<WebsocketService>;
    let detailsSubject: BehaviorSubject<ConnectionDetails>;
    let stateSubject: BehaviorSubject<ConnectionState>;
    let eventHandlers: Map<string, EventCallback | LatencyCallback | ConnectionEventCallback>;

    // Mock routes configuration for testing
    const mockRoutes: Routes = [
        {
            path: 'metrics',
            component: MockMetricsComponent,
            data: {
                icon: 'monitoring',
                label: 'System Metrics',
                shortLabel: 'Metrics'
            }
        },
        {
            path: 'logs',
            component: MockLogsComponent,
            data: {
                icon: 'article',
                label: 'System Logs',
                shortLabel: 'Logs'
            }
        },
        {
            path: '',
            redirectTo: 'logs',
            pathMatch: 'full'
        }
    ];

    /**
     * Test setup before each test case.
     * Configures:
     * - Mock services
     * - Test module
     * - Component instance
     */
    beforeEach(async () => {
        // Initialize theme service spy with a light theme
        themeService = jasmine.createSpyObj('ThemeService', ['setTheme'], {
            theme$: new BehaviorSubject('light')
        });

        // Initialize connection details with a connected state
        detailsSubject = new BehaviorSubject<ConnectionDetails>({
            state: ConnectionState.CONNECTED,
            url: 'ws://localhost:8080',
            latency: 50,
            lastConnected: new Date(),
            reconnectAttempts: 0,
            recentEvents: [{
                type: ConnectionEventType.CONNECTED,
                timestamp: new Date()
            }]
        });

        // Initialize connection state subject
        stateSubject = new BehaviorSubject<ConnectionState>(ConnectionState.CONNECTED);
        eventHandlers = new Map();

        // Create WebSocket service spy with observable streams
        websocketService = jasmine.createSpyObj('WebsocketService', ['on', 'off'], {
            details$: detailsSubject.asObservable(),
            details: detailsSubject.value,
            state: stateSubject.value
        });

        // Mock event subscription handling
        websocketService.on.and.callFake((event: string, handler: EventCallback | LatencyCallback | ConnectionEventCallback) => {
            eventHandlers.set(event, handler);
        });

        websocketService.off.and.callFake((event: string, handler: EventCallback | LatencyCallback | ConnectionEventCallback) => {
            if (eventHandlers.get(event) === handler) {
                eventHandlers.delete(event);
            }
        });

        // Configure the testing module
        await TestBed.configureTestingModule({
            imports: [LayoutComponent],
            providers: [
                { provide: ThemeService, useValue: themeService },
                { provide: WebsocketService, useValue: websocketService },
                provideRouter(mockRoutes),
                provideLocationMocks(),
                provideNoopAnimations()
            ]
        }).compileComponents();

        // Create component and trigger initial change detection
        fixture = TestBed.createComponent(LayoutComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    /**
     * Tests component creation.
     * Verifies that the component instance is properly initialized.
     */
    it('should create', () => {
        expect(component).toBeTruthy();
    });

    /**
     * Tests theme switching functionality.
     * Verifies that the theme service is called with the correct theme.
     */
    it('should set theme', () => {
        component.setTheme('dark');
        expect(themeService.setTheme).toHaveBeenCalledWith('dark');
    });

    /**
     * Tests navbar toggle functionality.
     * Verifies that the isExpanded state is properly toggled.
     */
    it('should toggle navbar', () => {
        const initialState = component.isExpanded;
        component.toggleNavbar();
        expect(component.isExpanded).toBe(!initialState);
    });

    /**
     * Tests connection details update handling.
     * Verifies that the component properly updates when connection details change.
     */
    it('should handle connection details changes', () => {
        let currentDetails: ConnectionDetails | undefined;
        component.connectionDetails$.subscribe(details => currentDetails = details);

        // Create new connection details for testing
        const newDetails: ConnectionDetails = {
            state: ConnectionState.DISCONNECTED,
            url: 'ws://localhost:8080',
            latency: 100,
            lastConnected: new Date(),
            reconnectAttempts: 1,
            recentEvents: []
        };

        // Update the service state and trigger all relevant events
        Object.defineProperty(websocketService, 'details', { get: () => newDetails });
        detailsSubject.next(newDetails);
        stateSubject.next(ConnectionState.DISCONNECTED);

        // Simulate all WebSocket events
        const stateHandler = eventHandlers.get('stateChange') as EventCallback;
        const latencyHandler = eventHandlers.get('latencyUpdate') as LatencyCallback;
        const eventHandler = eventHandlers.get('connectionEvent') as ConnectionEventCallback;

        if (stateHandler) stateHandler(ConnectionState.DISCONNECTED);
        if (latencyHandler) latencyHandler(100);
        if (eventHandler) eventHandler({
            type: ConnectionEventType.DISCONNECTED,
            timestamp: new Date()
        });

        fixture.detectChanges();
        expect(currentDetails).toEqual(newDetails);
    });

    /**
     * Tests connection icon mapping.
     * Verifies that each connection state maps to the correct Material icon.
     */
    it('should get correct connection icon', () => {
        expect(component.getConnectionIcon(ConnectionState.CONNECTED)).toBe('cloud_done');
        expect(component.getConnectionIcon(ConnectionState.CONNECTING)).toBe('cloud_sync');
        expect(component.getConnectionIcon(ConnectionState.DISCONNECTED)).toBe('cloud_off');
    });

    /**
     * Tests connection label mapping.
     * Verifies that each connection state maps to the correct display label.
     */
    it('should get correct connection label', () => {
        expect(component.getConnectionLabel(ConnectionState.CONNECTED)).toBe('Connected');
        expect(component.getConnectionLabel(ConnectionState.CONNECTING)).toBe('Connecting');
        expect(component.getConnectionLabel(ConnectionState.DISCONNECTED)).toBe('Disconnected');
    });

    /**
     * Tests theme label mapping.
     * Verifies that each theme maps to the correct display label.
     */
    it('should get correct theme label', () => {
        expect(component.getThemeLabel('light')).toBe('Light');
        expect(component.getThemeLabel('dark')).toBe('Dark');
        expect(component.getThemeLabel('system')).toBe('System');
    });

    /**
     * Tests theme icon mapping.
     * Verifies that each theme maps to the correct Material icon.
     */
    it('should get correct theme icon', () => {
        expect(component.getThemeIcon('light')).toBe('light_mode');
        expect(component.getThemeIcon('dark')).toBe('dark_mode');
        expect(component.getThemeIcon('system')).toBe('settings_suggest');
    });

    /**
     * Tests date formatting.
     * Verifies that dates are properly formatted for display.
     */
    it('should format date correctly', () => {
        const date = new Date('2024-01-01T12:00:00Z');
        expect(component.formatDate(date)).toBe(date.toLocaleString());
        expect(component.formatDate(undefined)).toBe('Never');
    });

    /**
     * Tests latency formatting.
     * Verifies that latency values are properly formatted for display.
     */
    it('should format latency correctly', () => {
        expect(component.formatLatency(100)).toBe('100ms');
        expect(component.formatLatency(undefined)).toBe('Unknown');
    });

    /**
     * Tests connection state change handling.
     * Verifies that the component properly updates when the connection state changes.
     */
    it('should handle connection state changes', () => {
        let currentState: ConnectionState | undefined;
        component.connectionState$.subscribe(state => currentState = state);

        // Simulate state change through WebSocket events
        const stateHandler = eventHandlers.get('stateChange') as EventCallback;
        if (stateHandler) {
            stateHandler(ConnectionState.RECONNECTING);
            stateSubject.next(ConnectionState.RECONNECTING);
            Object.defineProperty(websocketService, 'state', { get: () => ConnectionState.RECONNECTING });
        }

        fixture.detectChanges();
        expect(currentState).toBe(ConnectionState.RECONNECTING);
    });

    /**
     * Tests page title updates.
     * Verifies that the page title observable is properly initialized.
     */
    it('should update page title on navigation', () => {
        expect(component.currentPageTitle$).toBeDefined();
    });
});