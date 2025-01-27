/**
 * Test suite for TrackerComponent.
 * Tests the message tracking functionality including:
 * - Message flow visualization
 * - Table column configuration
 * - Flow selection and deselection
 * - Date and time formatting
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TrackerComponent } from './tracker.component';
import { TableComponent } from '../common/table/table.component';
import { FlowDiagramComponent } from './flow-diagram/flow-diagram.component';
import { ExportComponent } from '../common/export/export.component';
import { WebsocketService, Message, ActionType, BrokerHeader } from '../../services/websocket.service';
import { TrackerService, MessageFlow } from '../../services/tracker.service';
import { ServicesService } from '../../services/services.service';
import { TimeFormatService } from '../../services/time-format.service';
import { LayoutComponent } from '../layout/layout.component';
import { SingleEmitter } from '../../utils/single-emitter';

describe('TrackerComponent', () => {
    let component: TrackerComponent;
    let fixture: ComponentFixture<TrackerComponent>;
    let mockWebsocketService: jasmine.SpyObj<WebsocketService>;
    let mockTrackerService: jasmine.SpyObj<TrackerService>;
    let mockServicesService: jasmine.SpyObj<ServicesService>;
    let mockTimeFormatService: jasmine.SpyObj<TimeFormatService>;
    let mockLayoutComponent: jasmine.SpyObj<LayoutComponent>;

    /**
     * Test setup before each test case.
     * Configures TestBed with required imports and service mocks.
     */
    beforeEach(async () => {
        mockWebsocketService = jasmine.createSpyObj('WebsocketService', ['getMessageSize']);
        mockWebsocketService.getMessageSize.and.returnValue(100);

        const dataEmitter = new SingleEmitter<(data: MessageFlow) => void>();
        mockTrackerService = jasmine.createSpyObj('TrackerService', [], {
            data$: dataEmitter,
            flows: []
        });

        mockServicesService = jasmine.createSpyObj('ServicesService', ['getService']);
        mockTimeFormatService = jasmine.createSpyObj('TimeFormatService', ['getElapsedTime']);
        mockTimeFormatService.getElapsedTime.and.returnValue('elapsed-time');

        mockLayoutComponent = jasmine.createSpyObj('LayoutComponent', [], {
            activeToolbarContent: null
        });

        await TestBed.configureTestingModule({
            imports: [
                NoopAnimationsModule,
                MatTabsModule,
                MatCardModule,
                MatExpansionModule,
                MatIconModule,
                MatTooltipModule,
                TrackerComponent,
                TableComponent,
                FlowDiagramComponent,
                ExportComponent
            ],
            providers: [
                { provide: WebsocketService, useValue: mockWebsocketService },
                { provide: TrackerService, useValue: mockTrackerService },
                { provide: ServicesService, useValue: mockServicesService },
                { provide: TimeFormatService, useValue: mockTimeFormatService },
                { provide: LayoutComponent, useValue: mockLayoutComponent }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(TrackerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    /**
     * Test case: Component Creation
     * Verifies that the TrackerComponent can be created successfully.
     */
    it('should create', () => {
        expect(component).toBeTruthy();
    });

    /**
     * Test case: Table Column Initialization
     * Verifies that the message table columns are properly configured.
     */
    it('should initialize table columns', () => {
        expect(component.columns.length).toBeGreaterThan(0);
        expect(component.columns.find(col => col.name === 'request.receivedAt')).toBeTruthy();
        expect(component.columns.find(col => col.name === 'request.message.header.requestId')).toBeTruthy();
        expect(component.columns.find(col => col.name === 'request.message.header.topic')).toBeTruthy();
    });

    /**
     * Test case: Flow Selection
     * Verifies that message flows can be selected and stored in component state.
     */
    it('should handle flow selection', () => {
        const mockFlow: MessageFlow = {
            request: {
                serviceId: 'test-service',
                message: {
                    header: {
                        action: ActionType.REQUEST,
                        topic: 'test-topic',
                        version: '1.0',
                        requestId: 'test-request'
                    },
                    payload: {}
                },
                timeout: 5000,
                receivedAt: new Date()
            },
            updateCount: 0
        };

        component.onSelectionChange([mockFlow]);
        expect(component.selectedFlow).toBe(mockFlow);
    });

    /**
     * Test case: Date Formatting
     * Verifies that dates are properly formatted using toLocaleString.
     */
    it('should format dates using toLocaleString', () => {
        const timestamp = new Date();
        const result = component.getFormattedDate(timestamp);
        expect(result).toBe(timestamp.toLocaleString());
    });

    /**
     * Test case: Elapsed Time Formatting
     * Verifies that elapsed time is properly formatted using TimeFormatService.
     */
    it('should format elapsed time using TimeFormatService', () => {
        const timestamp = new Date();
        const result = component.getElapsedTime(timestamp);
        expect(mockTimeFormatService.getElapsedTime).toHaveBeenCalledWith(timestamp);
        expect(result).toBe('elapsed-time');
    });

    /**
     * Test case: Data Change Handling
     * Verifies that component state is properly updated when data changes.
     */
    it('should handle data changes', () => {
        const mockFlow: MessageFlow = {
            request: {
                serviceId: 'test-service',
                message: {
                    header: {
                        action: ActionType.REQUEST,
                        topic: 'test-topic',
                        version: '1.0',
                        requestId: 'test-request'
                    },
                    payload: {}
                },
                timeout: 5000,
                receivedAt: new Date()
            },
            updateCount: 0
        };

        component.handleDataChange(mockFlow);
        expect(component.selectedFlow).toBeNull();
    });

    /**
     * Test case: Subscription Cleanup
     * Verifies that subscriptions are properly cleaned up on component destruction.
     */
    it('should clean up subscriptions on destroy', () => {
        const offSpy = spyOn(mockTrackerService.data$, 'off');
        component.ngOnDestroy();
        expect(offSpy).toHaveBeenCalled();
    });
});