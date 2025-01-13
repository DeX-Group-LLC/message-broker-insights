import { CommonModule } from '@angular/common';
import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { Subscription } from 'rxjs';
import { Topic, TopicsService } from '../../services/topics.service';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { TimeFormatService } from '../../services/time-format.service';
import { LayoutComponent } from '../../components/layout/layout.component';
import { ExportComponent } from '../export/export.component';

/**
 * Component for displaying and managing topics.
 * Provides filtering, sorting, and expansion functionality for topics.
 */
@Component({
    selector: 'app-topics',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatSortModule,
        MatTableModule,
        MatTooltipModule,
        MatMenuModule,
        ExportComponent
    ],
    templateUrl: './topics.component.html',
    styleUrls: ['./topics.component.scss'],
    animations: [
        trigger('detailExpand', [
            state('collapsed', style({ height: '0px', minHeight: '0' })),
            state('expanded', style({ height: '*' })),
            transition('expanded <=> collapsed', animate('150ms ease')),
        ]),
    ],
})
export class TopicsComponent implements OnInit, AfterViewInit, OnDestroy {
    /** Columns to display in the table */
    displayedColumns = ['name', 'subscriberCount', 'priorityRange', 'lastUpdated'];
    /** Data source for the table */
    dataSource = new MatTableDataSource<Topic>([]);
    /** Set of currently expanded rows */
    expandedRows = new Set<Topic>();
    /** Whether multiple rows can be expanded simultaneously */
    isMultiExpandEnabled = false;
    /** Whether topic updates are paused */
    isPaused = false;
    /** Loading state */
    loading = false;
    /** Latest topics data */
    private latestTopics: Topic[] = [];

    /** Filter for name column */
    nameFilter = '';
    /** Filter for subscriber count column */
    subscriberFilter = '';
    /** Filter for priority range column */
    priorityFilter = '';
    /** Filter for last updated column */
    lastUpdatedFilter = '';

    /** Subscription to topics updates */
    private topicsSubscription?: Subscription;
    /** Subscription to loading state updates */
    private loadingSubscription?: Subscription;

    /** Reference to the paginator */
    @ViewChild(MatPaginator) paginator!: MatPaginator;
    /** Reference to the sort header */
    @ViewChild(MatSort) sort!: MatSort;

    @ViewChild('toolbarContent') toolbarContent?: TemplateRef<any>;

    /**
     * Creates an instance of TopicsComponent.
     *
     * @param topicsService - Service for managing topics
     * @param timeFormatService - Service for formatting time
     * @param layout - Layout component
     */
    constructor(
        private topicsService: TopicsService,
        private timeFormatService: TimeFormatService,
        private layout: LayoutComponent
    ) {}

    /**
     * Initializes the component.
     * Sets up subscriptions to topics and loading state.
     */
    ngOnInit(): void {
        this.setupLoadingSubscription();
        this.setupTopicsSubscription();
    }

    /**
     * Sets up the component after view initialization.
     * Configures the paginator and sort functionality.
     */
    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;

        // Set default sort to name ascending
        setTimeout(() => {
            this.sort.sort({
                id: 'name',
                start: 'asc',
                disableClear: false
            });
        });

        if (this.toolbarContent) {
            this.layout.activeToolbarContent = this.toolbarContent;
        }
    }

    /**
     * Cleans up resources when the component is destroyed.
     */
    ngOnDestroy(): void {
        this.topicsSubscription?.unsubscribe();
        this.loadingSubscription?.unsubscribe();
        this.layout.activeToolbarContent = undefined;
    }

    /**
     * Sets up subscription to topics updates.
     */
    private setupTopicsSubscription(): void {
        this.topicsSubscription = this.topicsService.topics$.subscribe(topics => {
            this.latestTopics = topics;
            if (!this.isPaused) {
                this.dataSource.data = this.applyFilters(this.latestTopics);
            }
        });
        this.refresh();
    }

    /**
     * Sets up subscription to loading state updates.
     */
    private setupLoadingSubscription(): void {
        this.loadingSubscription = this.topicsService.loading$.subscribe(loading => {
            this.loading = loading;
        });
    }

    /**
     * Applies current filters to the data source.
     */
    applyFilter(): void {
        this.dataSource.data = this.applyFilters(this.latestTopics);
        if (this.dataSource.paginator) {
            this.dataSource.paginator.firstPage();
        }
    }

    /**
     * Applies filters to a set of topics.
     *
     * @param topics - Topics to filter
     * @returns Filtered topics
     */
    private applyFilters(topics: Topic[]): Topic[] {
        return topics.filter(topic => {
            const matchesName = !this.nameFilter ||
                topic.name.toLowerCase().includes(this.nameFilter.toLowerCase());
            const matchesSubscriber = !this.subscriberFilter ||
                topic.subscribers.some(s => s.serviceId.toLowerCase().includes(this.subscriberFilter.toLowerCase()) || s.priority.toString().includes(this.subscriberFilter.toLowerCase()));
            const matchesPriority = !this.priorityFilter ||
                (topic.subscribers.length > 0 && (
                    // Match individual priority numbers
                    topic.subscribers.some(s => s.priority.toString().includes(this.priorityFilter)) ||
                    // Match the formatted range string
                    this.getPriorityRange(topic).includes(this.priorityFilter)
                ));
            const matchesLastUpdated = !this.lastUpdatedFilter ||
                this.getFormattedDate(topic.lastUpdated).toLowerCase().includes(this.lastUpdatedFilter.toLowerCase()) ||
                this.getElapsedTime(topic.lastUpdated).toLowerCase().includes(this.lastUpdatedFilter.toLowerCase());

            return matchesName && matchesSubscriber && matchesPriority && matchesLastUpdated;
        });
    }

    /**
     * Forces a refresh of the topics data.
     */
    async refresh(): Promise<void> {
        await this.topicsService.refresh();
    }

    /**
     * Toggles the pause state of topic updates.
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        if (!this.isPaused) {
            this.dataSource.data = this.applyFilters(this.latestTopics);
        }
    }

    /**
     * Toggles multi-expand functionality.
     */
    toggleMultiExpand(): void {
        this.isMultiExpandEnabled = !this.isMultiExpandEnabled;
        if (!this.isMultiExpandEnabled) {
            this.expandedRows.clear();
        }
    }

    /**
     * Toggles the expansion state of a topic's details.
     *
     * @param topic - Topic to toggle
     */
    toggleExpansion(topic: Topic): void {
        if (this.isMultiExpandEnabled) {
            if (this.expandedRows.has(topic)) {
                this.expandedRows.delete(topic);
            } else {
                this.expandedRows.add(topic);
            }
        } else {
            if (this.expandedRows.has(topic)) {
                this.expandedRows.clear();
            } else {
                this.expandedRows.clear();
                this.expandedRows.add(topic);
            }
        }
    }

    /**
     * Checks if a topic is expanded.
     *
     * @param topic - Topic to check
     * @returns Whether the topic is expanded
     */
    isExpanded(topic: Topic): boolean {
        return this.expandedRows.has(topic);
    }

    /**
     * Gets the subscriber count display text.
     *
     * @param topic - The topic to get subscriber count for
     * @returns Formatted subscriber count string
     */
    getSubscriberCountDisplay(topic: Topic): string {
        if (!topic.subscribers.length) return 'No subscribers';
        return `${topic.subscriberCount} subscriber${topic.subscriberCount !== 1 ? 's' : ''}`;
    }

    /**
     * Gets the priority range for a topic.
     *
     * @param topic - The topic to get the priority range for
     * @returns Formatted priority range string
     */
    getPriorityRange(topic: Topic): string {
        if (!topic.subscribers.length) return 'N/A';

        const priorities = topic.subscribers.map(s => s.priority);
        const min = Math.min(...priorities);
        const max = Math.max(...priorities);

        return min === max ? `${min}` : `${min} - ${max}`;
    }

    /**
     * Gets a preview of subscribers.
     *
     * @param topic - The topic to get subscribers for
     * @returns String describing number of subscribers
     */
    getSubscribersPreview(topic: Topic): string {
        if (!topic.subscribers.length) return 'No subscribers';
        return topic.subscribers.length === 1
            ? '1 subscriber'
            : `${topic.subscribers.length} subscribers`;
    }

    /**
     * Gets the elapsed time since a timestamp.
     *
     * @param timestamp - Date object
     * @returns Formatted elapsed time string
     */
    getElapsedTime(timestamp: Date): string {
        return this.timeFormatService.getElapsedTime(timestamp);
    }

    /**
     * Gets the formatted date string for display.
     *
     * @param timestamp - Date object
     * @returns Formatted date string
     */
    getFormattedDate(timestamp: Date): string {
        return timestamp.toLocaleString();
    }

    /**
     * Clears all active filters.
     */
    clearFilters(): void {
        this.nameFilter = '';
        this.subscriberFilter = '';
        this.priorityFilter = '';
        this.lastUpdatedFilter = '';
        this.applyFilter();
    }

    /**
     * Clears the name filter.
     */
    clearNameFilter(): void {
        this.nameFilter = '';
        this.applyFilter();
    }

    /**
     * Clears the subscriber filter.
     */
    clearSubscriberFilter(): void {
        this.subscriberFilter = '';
        this.applyFilter();
    }

    /**
     * Clears the priority filter.
     */
    clearPriorityFilter(): void {
        this.priorityFilter = '';
        this.applyFilter();
    }

    /**
     * Clears the last updated filter.
     */
    clearLastUpdatedFilter(): void {
        this.lastUpdatedFilter = '';
        this.applyFilter();
    }

    /**
     * Checks if any filters are currently active.
     *
     * @returns Whether any filters are active
     */
    hasActiveFilters(): boolean {
        return !!(this.nameFilter || this.subscriberFilter || this.priorityFilter || this.lastUpdatedFilter);
    }

    /**
     * Exports the current data source.
     */
    getExportData(): any {
        return this.dataSource.data.map(topic => ({
            name: topic.name,
            subscribers: topic.subscribers.map(s => ({
                serviceId: s.serviceId,
                priority: s.priority
            })),
            priorityRange: this.getPriorityRange(topic),
            lastUpdated: topic.lastUpdated
        }));
    }
}
