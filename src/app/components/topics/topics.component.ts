import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
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
    selector: 'app-topics',
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
    templateUrl: './topics.component.html',
    styleUrls: ['./topics.component.scss']
})
export class TopicsComponent implements OnInit, OnDestroy {
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

    /**
     * Initializes the component.
     */
    ngOnInit(): void {
        if (this.toolbarContent) {
            this.layout.activeToolbarContent = this.toolbarContent;
        }
    }

    /**
     * Cleans up resources when the component is destroyed.
     */
    ngOnDestroy(): void {
        this.layout.activeToolbarContent = undefined;
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
    togglePause(): void {
        this.isPaused = !this.isPaused;
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
     * Checks if a topic has subscribers.
     *
     * @param topic - The topic to check
     * @returns Whether the topic has subscribers
     */
    hasSubscribers(topic: Topic): boolean {
        return topic.subscribers.length > 0;
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

    /**
     * Gets the data for export.
     *
     * @returns Export data
     */
    getExportData(): any {
        return this.topicsService.getTopics().map(topic => ({
            name: topic.name,
            subscriberCount: topic.subscribers.length,
            priorityRange: this.getPriorityRange(topic),
            lastUpdated: this.getFormattedDate(topic.lastUpdated),
            subscribers: topic.subscribers.map(s => ({
                serviceId: s.serviceId,
                priority: s.priority
            }))
        }));
    }
}
