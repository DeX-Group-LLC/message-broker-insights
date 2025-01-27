import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { BehaviorSubject } from 'rxjs';
import { LogsComponent } from './logs.component';
import { LogService, LogEntry, LogLevel } from '../../services/log.service';
import { TimeFormatService } from '../../services/time-format.service';
import { LayoutComponent } from '../layout/layout.component';
import { TableComponent } from '../common/table/table.component';

/**
 * Test suite for LogsComponent.
 * Tests the log display functionality including:
 * - Log entry display and formatting
 * - Log level filtering
 * - Metadata handling
 * - Time formatting
 * - Row expansion
 */
describe('LogsComponent', () => {
    let component: LogsComponent;
    let fixture: ComponentFixture<LogsComponent>;
    let mockLogService: jasmine.SpyObj<LogService>;
    let mockTimeFormatService: jasmine.SpyObj<TimeFormatService>;
    let mockLayoutComponent: jasmine.SpyObj<LayoutComponent>;
    let minLogLevel$: BehaviorSubject<LogLevel>;

    const testLogs: LogEntry[] = [
        {
            id: 1,
            timestamp: new Date(),
            level: LogLevel.INFO,
            module: 'TestModule',
            message: 'Test message 1',
            meta: { key: 'value' }
        },
        {
            id: 2,
            timestamp: new Date(),
            level: LogLevel.ERROR,
            module: 'TestModule',
            message: 'Test error message',
            meta: null
        }
    ];

    /**
     * Test setup before each test case.
     * Configures TestBed with required imports and service mocks.
     */
    beforeEach(async () => {
        minLogLevel$ = new BehaviorSubject<LogLevel>(LogLevel.INFO);

        mockLogService = jasmine.createSpyObj('LogService', ['clearLogs', 'setMinLogLevel'], {
            minLogLevel$: minLogLevel$.asObservable()
        });

        mockTimeFormatService = jasmine.createSpyObj('TimeFormatService', ['getElapsedTime']);
        mockTimeFormatService.getElapsedTime.and.returnValue('1 minute ago');

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
                MatSelectModule,
                TableComponent,
                LogsComponent
            ],
            providers: [
                { provide: LogService, useValue: mockLogService },
                { provide: TimeFormatService, useValue: mockTimeFormatService },
                { provide: LayoutComponent, useValue: mockLayoutComponent }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(LogsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    /**
     * Test case: Component Creation
     * Verifies that the LogsComponent can be created successfully.
     */
    it('should create', () => {
        expect(component).toBeTruthy();
    });

    /**
     * Test case: Column Configuration
     * Verifies that table columns are properly configured.
     */
    it('should have correct column configuration', () => {
        expect(component.columns.length).toBe(5);
        expect(component.columns.map(c => c.name)).toEqual([
            'timestamp',
            'level',
            'module',
            'message',
            'meta'
        ]);
    });

    /**
     * Test case: Log Level Change
     * Verifies that log level changes are properly handled.
     */
    it('should handle log level changes', () => {
        component.onLogLevelChange(LogLevel.ERROR);
        expect(mockLogService.setMinLogLevel).toHaveBeenCalledWith(LogLevel.ERROR);
    });

    /**
     * Test case: Metadata Preview
     * Verifies that metadata previews are properly generated.
     */
    it('should generate metadata previews', () => {
        const shortMeta = { key: 'value' };
        const longMeta = { key: 'a'.repeat(100) };

        expect(component.getMetaPreview(shortMeta)).toBe(JSON.stringify(shortMeta));
        expect(component.getMetaPreview(longMeta).length).toBe(53); // 50 chars + '...'
        expect(component.getMetaPreview(longMeta).endsWith('...')).toBeTrue();
    });

    /**
     * Test case: Metadata Detection
     * Verifies that metadata presence is correctly detected.
     */
    it('should detect metadata correctly', () => {
        expect(component.hasMetaData(testLogs[0])).toBeTrue();
        expect(component.hasMetaData(testLogs[1])).toBeFalse();
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
     * Test case: History Clear
     * Verifies that log history can be cleared.
     */
    it('should clear log history', () => {
        component.clearHistory();
        expect(mockLogService.clearLogs).toHaveBeenCalled();
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