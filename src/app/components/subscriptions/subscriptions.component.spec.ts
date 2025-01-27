import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SubscriptionsComponent } from './subscriptions.component';
import { TopicsService, Topic } from '../../services/topics.service';
import { TimeFormatService } from '../../services/time-format.service';
import { LayoutComponent } from '../layout/layout.component';
import { TableComponent } from '../common/table/table.component';

/**
 * Test suite for SubscriptionsComponent.
 * Tests the topic subscription functionality including:
 * - Topic display and formatting
 * - Subscriber count and priority range calculation
 * - Time formatting
 * - Row expansion
 */
describe('SubscriptionsComponent', () => {
    let component: SubscriptionsComponent;
    let fixture: ComponentFixture<SubscriptionsComponent>;
    let mockTopicsService: jasmine.SpyObj<TopicsService>;
    let mockTimeFormatService: jasmine.SpyObj<TimeFormatService>;
    let mockLayoutComponent: jasmine.SpyObj<LayoutComponent>;

    const testTopics: Topic[] = [
        {
            name: 'test.topic.1',
            subscribers: [
                { serviceId: 'service1', priority: 1 },
                { serviceId: 'service2', priority: 2 }
            ],
            subscriberCount: 2,
            lastUpdated: new Date()
        },
        {
            name: 'test.topic.2',
            subscribers: [],
            subscriberCount: 0,
            lastUpdated: new Date()
        }
    ];

    /**
     * Test setup before each test case.
     * Configures TestBed with required imports and service mocks.
     */
    beforeEach(async () => {
        mockTopicsService = jasmine.createSpyObj('TopicsService', [], {
            topics$: jasmine.createSpyObj('Observable', ['subscribe'])
        });

        mockTimeFormatService = jasmine.createSpyObj('TimeFormatService', ['getElapsedTime']);
        mockTimeFormatService.getElapsedTime.and.returnValue('1 minute ago');

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
                TableComponent,
                SubscriptionsComponent
            ],
            providers: [
                { provide: TopicsService, useValue: mockTopicsService },
                { provide: TimeFormatService, useValue: mockTimeFormatService },
                { provide: LayoutComponent, useValue: mockLayoutComponent }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(SubscriptionsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    /**
     * Test case: Component Creation
     * Verifies that the SubscriptionsComponent can be created successfully.
     */
    it('should create', () => {
        expect(component).toBeTruthy();
    });

    /**
     * Test case: Subscriber Check
     * Verifies that subscriber presence is correctly detected.
     */
    it('should detect subscribers correctly', () => {
        expect(component.hasSubscribers(testTopics[0])).toBeTrue();
        expect(component.hasSubscribers(testTopics[1])).toBeFalse();
    });

    /**
     * Test case: Subscriber Count Display
     * Verifies that subscriber count is properly formatted.
     */
    it('should format subscriber count correctly', () => {
        expect(component.getSubscriberCountDisplay(testTopics[0])).toBe('2 subscribers');
        expect(component.getSubscriberCountDisplay(testTopics[1])).toBe('0 subscribers');

        const singleSubscriberTopic: Topic = {
            name: 'test.topic.3',
            subscribers: [{ serviceId: 'service1', priority: 1 }],
            subscriberCount: 1,
            lastUpdated: new Date()
        };
        expect(component.getSubscriberCountDisplay(singleSubscriberTopic)).toBe('1 subscriber');
    });

    /**
     * Test case: Priority Range Display
     * Verifies that priority range is properly calculated and formatted.
     */
    it('should calculate priority range correctly', () => {
        expect(component.getPriorityRange(testTopics[0])).toBe('1 - 2');
        expect(component.getPriorityRange(testTopics[1])).toBe('N/A');

        const singlePriorityTopic: Topic = {
            name: 'test.topic.3',
            subscribers: [
                { serviceId: 'service1', priority: 1 },
                { serviceId: 'service2', priority: 1 }
            ],
            subscriberCount: 2,
            lastUpdated: new Date()
        };
        expect(component.getPriorityRange(singlePriorityTopic)).toBe('1');
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
     * Test case: Component Cleanup
     * Verifies that resources are properly cleaned up on destroy.
     */
    it('should clean up on destroy', () => {
        component.ngOnDestroy();
        expect(mockLayoutComponent.activeToolbarContent).toBeUndefined();
    });
});