import { CommonModule } from '@angular/common';
import { Component, OnDestroy, ViewChild, TemplateRef, AfterViewInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { ServicesService, ServiceInfo, ServiceStatus } from '../../services/services.service';
import { TimeFormatService } from '../../services/time-format.service';
import { LayoutComponent } from '../layout/layout.component';
import { ExportComponent } from '../common/export/export.component';
import { TableComponent, TableColumn } from '../common/table/table.component';
import { Metric, MetricsService } from '../../services/metrics.service';
import { MetricInfo } from '../../services/metrics.service';
/** Tab index for service details */
export enum ServiceDetailsTab {
    Overview = 0,
    Metrics = 1,
    Subscriptions = 2
}

/**
 * Component for displaying and managing system services.
 * Provides filtering, sorting, and selection functionality for service entries.
 */
@Component({
    selector: 'app-services',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatTooltipModule,
        MatTabsModule,
        ExportComponent,
        TableComponent
    ],
    templateUrl: './services.component.html',
    styleUrls: ['./services.component.scss']
})
export class ServicesComponent implements AfterViewInit, OnDestroy {
    /** Whether service updates are paused */
    isPaused = false;
    /** Loading state */
    loading = false;
    /** Currently selected service */
    selectedService?: ServiceInfo;
    /** Current tab in the details panel */
    selectedTab = ServiceDetailsTab.Overview;
    /** Interval ID for polling selected service details */
    private selectedServiceInterval?: number;

    /** Table columns configuration */
    columns: TableColumn[] = [
        { name: 'id', label: 'ID', sortable: true, filterable: true },
        { name: 'name', label: 'Name', sortable: true, filterable: true },
        { name: 'description', label: 'Description', sortable: true, filterable: true },
        { name: 'status', label: 'Status', sortable: true, filterable: true },
        { name: 'connectedAt', label: 'Connected', sortable: true, filterable: true },
        { name: 'heartbeat', label: 'Heartbeat', sortable: false, filterable: true }
    ];

    @ViewChild('toolbarContent') toolbarContent?: TemplateRef<any>;
    @ViewChild(TableComponent) table!: TableComponent;

    /** Enum for tab indices */
    readonly ServiceDetailsTab = ServiceDetailsTab;

    /**
     * Creates an instance of ServicesComponent.
     *
     * @param servicesService - Service for managing services
     * @param timeFormatService - Service for formatting time
     * @param layout - Layout component
     */
    constructor(
        public servicesService: ServicesService,
        private timeFormatService: TimeFormatService,
        private layout: LayoutComponent,
        private metricsService: MetricsService
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
        this.stopSelectedServicePolling();
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
     * Gets the display name for a service.
     *
     * @param service - Service to get name for
     * @returns Display name
     */
    getDisplayName(service: ServiceInfo): string {
        return service.name || service.id;
    }

    /**
     * Gets the display description for a service.
     *
     * @param service - Service to get description for
     * @returns Display description
     */
    getDisplayDescription(service: ServiceInfo): string {
        return service.description || 'No description';
    }

    /**
     * Gets formatted metric display value
     * @param metric - Metric to format
     * @returns Formatted value string
     */
    getMetricDisplayValue(metric: Metric): string {
        return this.metricsService.getMetricDisplayValue(metric);
    }

    /**
     * Checks if a service has a name.
     *
     * @param service - Service to check
     * @returns Whether the service has a name
     */
    hasName(service: ServiceInfo): boolean {
        return !!service.name;
    }

    /**
     * Checks if a service has a description.
     *
     * @param service - Service to check
     * @returns Whether the service has a description
     */
    hasDescription(service: ServiceInfo): boolean {
        return !!service.description;
    }

    /**
     * Gets the heartbeat status class for a service.
     *
     * @param service - Service to get status for
     * @returns Status class name
     */
    getHeartbeatStatus(service: ServiceInfo): string {
        const elapsed = Date.now() - new Date(service.lastHeartbeat).getTime();
        if (elapsed > 60000) return 'error';
        if (elapsed > 30000) return 'warning';
        return '';
    }

    /**
     * Gets the formatted status string.
     *
     * @param status - Status to format
     * @returns Formatted status string
     */
    getFormattedStatus(status: ServiceStatus): string {
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    /**
     * Gets the status class for a service status.
     *
     * @param status - Status to get class for
     * @returns Status class name
     */
    getStatusClass(status: ServiceStatus): string {
        return status === 'connected' ? 'success' : 'error';
    }

    /**
     * Selects a service for detailed view.
     *
     * @param service - Service to select
     */
    selectService(service: ServiceInfo): void {
        // If selecting the same service, do nothing
        if (this.selectedService === service) return;

        // Stop polling for previous service
        this.stopSelectedServicePolling();

        this.selectedService = service;
        this.selectedTab = ServiceDetailsTab.Overview;

        // Start polling for new service if it's connected
        if (service && service.status === 'connected') {
            this.startSelectedServicePolling();
        }
    }

    /**
     * Starts polling for selected service details.
     */
    private startSelectedServicePolling(): void {
        // Initial fetch
        this.fetchSelectedServiceDetails();

        // Set up polling interval
        this.selectedServiceInterval = window.setInterval(() => {
            if (this.selectedService?.status === 'connected') {
                this.fetchSelectedServiceDetails();
            } else {
                this.stopSelectedServicePolling();
            }
        }, 5000);
    }

    /**
     * Stops polling for selected service details.
     */
    private stopSelectedServicePolling(): void {
        if (this.selectedServiceInterval) {
            clearInterval(this.selectedServiceInterval);
            this.selectedServiceInterval = undefined;
        }
    }

    /**
     * Fetches details for the selected service.
     */
    private async fetchSelectedServiceDetails(): Promise<void> {
        if (!this.selectedService || this.selectedService.status !== 'connected') return;

        try {
            // Fetch subscriptions
            const subsResponse = await this.servicesService.fetchServiceSubscriptions(this.selectedService.id);
            if (subsResponse && subsResponse.subscriptions) {
                this.selectedService.subscriptions = subsResponse.subscriptions;
            } else {
                delete this.selectedService.subscriptions;
            }
        } catch (error) {
            console.warn(`Failed to get subscriptions for service ${this.selectedService.id}:`, error);
            delete this.selectedService.subscriptions;
        }

        try {
            // Fetch metrics
            const metricsResponse = await this.servicesService.fetchServiceMetrics(this.selectedService.id);
            if (metricsResponse && metricsResponse.length > 0) {
                this.selectedService.metrics = metricsResponse;
            } else {
                delete this.selectedService.metrics;
            }
        } catch (error) {
            console.warn(`Failed to get metrics for service ${this.selectedService.id}:`, error);
            delete this.selectedService.metrics;
        }
    }

    /**
     * Checks if a service is selected.
     *
     * @param service - Service to check
     * @returns Whether the service is selected
     */
    isSelected(service: ServiceInfo): boolean {
        return this.selectedService === service;
    }

    /**
     * Closes the service details panel.
     */
    closeDetails(): void {
        this.stopSelectedServicePolling();
        this.selectedService = undefined;
    }

    /**
     * Handles tab changes in the details panel.
     *
     * @param tabIndex - New tab index
     */
    onTabChange(tabIndex: number): void {
        this.selectedTab = tabIndex;
    }

    /**
     * Clears disconnected services.
     */
    clearDisconnected(): void {
        this.servicesService.clearDisconnected();
    }
}