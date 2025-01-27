/**
 * Test suite for AppComponent.
 * Tests the core application component functionality including:
 * - Component creation
 * - Title verification
 * - Layout rendering
 */
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { provideAnimations } from '@angular/platform-browser/animations';
import { LogService } from './services/log.service';
import { MetricsService } from './services/metrics.service';
import { ServicesService } from './services/services.service';
import { ThemeService } from './services/theme.service';
import { TopicsService } from './services/topics.service';
import { TrackerService } from './services/tracker.service';
import { LayoutComponent } from './components/layout/layout.component';
import { RouterModule } from '@angular/router';

describe('AppComponent', () => {
    /**
     * Test setup before each test case.
     * Configures TestBed with required imports and service mocks.
     */
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                AppComponent,
                RouterModule.forRoot([]),
                LayoutComponent
            ],
            providers: [
                provideAnimations(),
                { provide: LogService, useValue: jasmine.createSpyObj('LogService', ['']) },
                { provide: MetricsService, useValue: jasmine.createSpyObj('MetricsService', ['']) },
                { provide: ServicesService, useValue: jasmine.createSpyObj('ServicesService', ['']) },
                { provide: ThemeService, useValue: jasmine.createSpyObj('ThemeService', ['']) },
                { provide: TopicsService, useValue: jasmine.createSpyObj('TopicsService', ['']) },
                { provide: TrackerService, useValue: jasmine.createSpyObj('TrackerService', ['']) }
            ]
        }).compileComponents();
    });

    /**
     * Test case: Component Creation
     * Verifies that the AppComponent can be created successfully.
     */
    it('should create the app', () => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.componentInstance;
        expect(app).toBeTruthy();
    });

    /**
     * Test case: Title Verification
     * Verifies that the application title is set correctly.
     */
    it(`should have the correct title`, () => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.componentInstance;
        expect(app.title).toEqual('Message Broker Insights');
    });

    /**
     * Test case: Layout Component Rendering
     * Verifies that the layout component is rendered in the template.
     */
    it('should render the layout component', () => {
        const fixture = TestBed.createComponent(AppComponent);
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('app-layout')).toBeTruthy();
    });
});
