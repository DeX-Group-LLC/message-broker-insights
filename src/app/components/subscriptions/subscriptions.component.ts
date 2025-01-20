import { CommonModule } from '@angular/common';
import { Component, OnDestroy, ViewChild, TemplateRef, AfterViewInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Topic, TopicsService } from '../../services/topics.service';
import { TimeFormatService } from '../../services/time-format.service';
import { LayoutComponent } from '../layout/layout.component';
import { ExportComponent } from '../common/export/export.component';
import { TableComponent } from '../common/table/table.component';
import { TableColumn } from '../common/table/table.component';

/**
 * Component for displaying and managing topics.
 * Provides filtering, sorting, and expansion functionality for topics.
 */
@Component({
    selector: 'app-subscriptions',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatTooltipModule,
        ExportComponent,
        TableComponent
    ],
    templateUrl: './subscriptions.component.html',
    styleUrls: ['./subscriptions.component.scss']
})
export class SubscriptionsComponent implements AfterViewInit, OnDestroy {
    /** Whether topic updates are paused */
    isPaused = false;
    /** Loading state */
    loading = false;
    /** Whether multiple rows can be expanded simultaneously */
    isMultiExpandEnabled = false;
    /** Set of currently expanded rows */
    expandedRows = new Set<Topic>();

    /** Table columns configuration */
    columns: TableColumn[] = [
        { name: 'name', label: 'Topic', sortable: true },
        { name: 'subscriberCount', label: 'Subscribers', sortable: true },
        { name: 'priorityRange', label: 'Priority Range', sortable: false },
        { name: 'lastUpdated', label: 'Last Updated', sortable: true }
    ];

    @ViewChild('toolbarContent') toolbarContent?: TemplateRef<any>;
    @ViewChild(TableComponent) table!: TableComponent;

    /**
     * Creates an instance of TopicsComponent.
     *
     * @param topicsService - Service for managing topics
     * @param timeFormatService - Service for formatting time
     * @param layout - Layout component
     */
    constructor(
        public topicsService: TopicsService,
        private timeFormatService: TimeFormatService,
        private layout: LayoutComponent
    ) {}

    ngAfterViewInit() {
        setTimeout(() => {
            if (this.toolbarContent) {
                this.layout.activeToolbarContent = this.toolbarContent;
            }
        });
    }

    /**
     * Cleans up resources when the component is destroyed.
     */
    ngOnDestroy(): void {
        this.layout.activeToolbarContent = undefined;
    }

    /**
     * Checks if a topic has subscribers.
     *
     * @param topic - The topic to check
     * @returns Whether the topic has subscribers
     */
    hasSubscribers(topic: Topic): boolean {
        return topic.subscribers.length > 0;
    }

    /**
     * Checks if a topic is expanded.
     *
     * @param topic - Topic to check
     * @returns Whether the topic is expanded
     */
    isExpanded(topic: Topic): boolean {
        return this.table.isExpanded(topic);
    }

    /**
     * Gets the subscriber count display string for a topic.
     *
     * @param topic - Topic to get subscriber count for
     * @returns Subscriber count display string
     */
    getSubscriberCountDisplay(topic: Topic): string {
        const count = topic.subscribers.length;
        return `${count} subscriber${count !== 1 ? 's' : ''}`;
    }

    /**
     * Gets the priority range string for a topic.
     *
     * @param topic - Topic to get priority range for
     * @returns Priority range string
     */
    getPriorityRange(topic: Topic): string {
        if (!topic.subscribers.length) return 'N/A';

        const priorities = topic.subscribers.map(s => s.priority);
        const min = Math.min(...priorities);
        const max = Math.max(...priorities);
        return min === max ? `${min}` : `${min} - ${max}`;
    }

    /**
     * Gets the elapsed time string for a timestamp.
     *
     * @param timestamp - Timestamp to get elapsed time for
     * @returns Elapsed time string
     */
    getElapsedTime(timestamp: Date): string {
        return this.timeFormatService.getElapsedTime(timestamp);
    }

    /**
     * Gets the formatted date string for a timestamp.
     *
     * @param timestamp - Timestamp to format
     * @returns Formatted date string
     */
    getFormattedDate(timestamp: Date): string {
        return timestamp.toLocaleString();
    }
}
