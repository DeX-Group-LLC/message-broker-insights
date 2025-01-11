import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { Component } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { LogService } from './services/log.service';
import { MetricsService } from './services/metrics.service';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { WebsocketService, ConnectionState } from './services/websocket.service';
import { LayoutComponent } from './components/layout/layout.component';
import { ThemeService } from './services/theme.service';

// Mock LayoutComponent to avoid WebSocket dependencies
@Component({
    selector: 'app-layout',
    template: '<div>Mock Layout</div>',
    standalone: true
})
class MockLayoutComponent {
    isExpanded = true;
    currentTheme$ = of('light');
    currentPageTitle$ = of('Test Page');
    connectionState = ConnectionState;
    connectionState$ = of(ConnectionState.CONNECTED);
    connectionDetails$ = of({
        state: ConnectionState.CONNECTED,
        url: 'ws://test',
        latency: 0,
        lastConnected: new Date(),
        lastDisconnected: null,
        events: []
    });
}

/**
 * Test suite for the AppComponent.
 * Verifies the core functionality of the root application component:
 * - Component creation and initialization
 * - Service initialization and availability
 * - Layout rendering
 * - Title configuration
 * - Service interactions
 */
describe('AppComponent', () => {
    let logService: LogService;
    let metricsService: MetricsService;
    let websocketService: WebsocketService;
    let mockLogsSubject: BehaviorSubject<any[]>;
    let mockMetricsSubject: BehaviorSubject<any[]>;

    /**
     * Test setup before each test case.
     * Configures the testing module with required imports and providers:
     * - AppComponent as the main component
     * - Router configuration for navigation
     * - Animation support
     * - Core services (LogService and MetricsService)
     * - Mock WebSocket service
     */
    beforeEach(async () => {
        mockLogsSubject = new BehaviorSubject<any[]>([]);
        mockMetricsSubject = new BehaviorSubject<any[]>([]);

        const mockWebsocketService = {
            ...jasmine.createSpyObj('WebsocketService', {
                waitForReady: Promise.resolve(),
                request: Promise.resolve({ success: true }),
                on: undefined,
                off: undefined
            }),
            state: ConnectionState.CONNECTED,
            details: {
                state: ConnectionState.CONNECTED,
                url: 'ws://test',
                latency: 0,
                lastConnected: new Date(),
                lastDisconnected: null,
                events: []
            }
        };

        await TestBed.configureTestingModule({
            imports: [
                AppComponent
            ],
            providers: [
                provideAnimationsAsync(),
                provideRouter([]),
                { provide: WebsocketService, useValue: mockWebsocketService },
                { provide: ThemeService, useValue: { theme$: of('light') } },
                { provide: LayoutComponent, useClass: MockLayoutComponent },
                LogService,
                MetricsService
            ]
        }).compileComponents();

        // Inject services for use in test cases
        logService = TestBed.inject(LogService);
        metricsService = TestBed.inject(MetricsService);
        websocketService = TestBed.inject(WebsocketService);
    });

    /**
     * Verifies that the AppComponent can be created successfully.
     * This is a basic smoke test to ensure the component's dependencies are properly configured.
     */
    it('should create the app', () => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.componentInstance;
        expect(app).toBeTruthy();
    });

    /**
     * Verifies that the application title is set correctly.
     * The title should match the application's branding requirements.
     */
    it(`should have the correct title`, () => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.componentInstance;
        // Title should match the application's name
        expect(app.title).toEqual('Message Broker Insights');
    });

    /**
     * Verifies that the LogService is properly initialized when the component is created.
     * Tests that the logs$ observable is available and properly initialized.
     */
    it('should have LogService initialized', fakeAsync(() => {
        const fixture = TestBed.createComponent(AppComponent);
        fixture.detectChanges();
        tick();

        // Verify the logs$ observable is available and initialized
        expect(logService.logs$).toBeTruthy();
        logService.logs$.subscribe(logs => {
            expect(logs).toBeDefined();
            expect(Array.isArray(logs)).toBeTrue();
        });
    }));

    /**
     * Verifies that the MetricsService is properly initialized when the component is created.
     * Tests that both metrics$ and loading$ observables are available and properly initialized.
     */
    it('should have MetricsService initialized', fakeAsync(() => {
        const fixture = TestBed.createComponent(AppComponent);
        fixture.detectChanges();
        tick();

        // Verify both observables are available and initialized
        expect(metricsService.metrics$).toBeTruthy();
        expect(metricsService.loading$).toBeTruthy();

        metricsService.metrics$.subscribe(metrics => {
            expect(metrics).toBeDefined();
            expect(Array.isArray(metrics)).toBeTrue();
        });

        metricsService.loading$.subscribe(loading => {
            expect(loading).toBeDefined();
            expect(typeof loading).toBe('boolean');
        });
    }));

    /**
     * Verifies that the layout component is properly rendered in the template.
     * The layout component is the main container for the application's UI.
     */
    it('should render the layout component', () => {
        const fixture = TestBed.createComponent(AppComponent);
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;
        // Check that the layout component selector is present in the DOM
        expect(compiled.querySelector('app-layout')).toBeTruthy();
    });

    /**
     * Verifies that the WebSocket connection is properly handled.
     */
    it('should handle WebSocket connection', fakeAsync(() => {
        const fixture = TestBed.createComponent(AppComponent);
        fixture.detectChanges();
        tick();

        expect(websocketService.waitForReady).toHaveBeenCalled();
    }));
});
