import { Component, OnInit, ViewChild, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { ServicesService, ServiceInfo, ServiceStatus } from '../../services/services.service';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { TimeFormatService } from '../../services/time-format.service';
import { MatTabsModule } from '@angular/material/tabs';
import { MetricsService } from '../../services/metrics.service';

/** Tab index for service details */
export enum ServiceDetailsTab {
    Overview = 0,
    Metrics = 1,
    Subscriptions = 2
}

/**
 * Component for displaying and managing system services.
 * Provides filtering, sorting, and expansion functionality for service entries.
 */
@Component({
    selector: 'app-services',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatTableModule,
        MatSortModule,
        MatPaginatorModule,
        MatIconModule,
        MatButtonModule,
        MatMenuModule,
        MatFormFieldModule,
        MatInputModule,
        MatTooltipModule,
        MatTabsModule
    ],
    templateUrl: './services.component.html',
    styleUrls: ['./services.component.scss'],
    animations: [
        trigger('detailExpand', [
            state('collapsed', style({ height: '0px', minHeight: '0' })),
            state('expanded', style({ height: '*' })),
            transition('expanded <=> collapsed', animate('150ms ease')),
        ]),
    ],
})
export class ServicesComponent implements OnInit, AfterViewInit, OnDestroy {
    /** Columns to display in the table */
    displayedColumns = ['id', 'name', 'description', 'status', 'connectedAt', 'heartbeat'];
    /** Data source for the table */
    dataSource = new MatTableDataSource<ServiceInfo>([]);
    /** Set of currently expanded rows */
    expandedRows = new Set<ServiceInfo>();
    /** Whether multiple rows can be expanded simultaneously */
    isMultiExpandEnabled = false;
    /** Whether service updates are paused */
    isPaused = false;
    /** Currently selected service */
    selectedService?: ServiceInfo;
    /** Current tab in the details panel */
    selectedTab = ServiceDetailsTab.Overview;

    /** Reference to the table's sort directive */
    @ViewChild(MatSort) sort!: MatSort;
    /** Reference to the table's paginator */
    @ViewChild(MatPaginator) paginator!: MatPaginator;

    /** Filter for id column */
    idFilter = '';
    /** Filter for name column */
    nameFilter = '';
    /** Filter for description column */
    descriptionFilter = '';
    /** Filter for connected at column */
    connectedAtFilter = '';
    /** Filter for heartbeat column */
    heartbeatFilter = '';
    /** Filter for meta column */
    metaFilter = '';
    /** Filter for status column */
    statusFilter = '';

    /** Subject for handling component destruction */
    private destroy$ = new Subject<void>();
    /** Subscription to services updates */
    private servicesSubscription?: Subscription;
    /** Latest services received from the service */
    private latestServices: ServiceInfo[] = [];
    /** Subscription to metrics updates */
    private metricsSubscription?: Subscription;
    /** Interval ID for polling subscriptions */
    private subscriptionsInterval?: number;

    /** Enum for tab indices */
    readonly ServiceDetailsTab = ServiceDetailsTab;

    /**
     * Creates an instance of ServicesComponent.
     *
     * @param servicesService - Service for managing services
     * @param timeFormatService - Service for formatting time
     * @param metricsService - Service for fetching service metrics
     */
    constructor(
        private servicesService: ServicesService,
        private timeFormatService: TimeFormatService,
        private metricsService: MetricsService
    ) {}

    /**
     * Initializes the component.
     * Clears data source and expanded state.
     */
    ngOnInit() {
        this.dataSource.data = [];
        this.expandedRows.clear();
    }

    /**
     * Sets up the component after view initialization.
     * Configures sorting and pagination, and sets up services subscription.
     */
    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
        this.dataSource.paginator = this.paginator;

        setTimeout(() => {
            // Setup initial services subscription
            this.setupServicesSubscription();

            // Set default sort to name ascending
            this.sort.sort({
                id: 'name',
                start: 'asc',
                disableClear: false
            });
        });
    }

    /**
     * Cleans up resources when the component is destroyed.
     */
    ngOnDestroy(): void {
        this.servicesSubscription?.unsubscribe();
        this.metricsSubscription?.unsubscribe();
        if (this.subscriptionsInterval) {
            clearInterval(this.subscriptionsInterval);
            this.subscriptionsInterval = undefined;
        }
    }

    /**
     * Sets up subscription to services updates.
     * Updates the data source when new services are received.
     */
    private setupServicesSubscription() {
        if (this.servicesSubscription) {
            this.servicesSubscription.unsubscribe();
        }

        this.servicesSubscription = this.servicesService.services$.subscribe(services => {
            if (!this.isPaused) {
                // Update services in place
                const currentData = this.dataSource.data;
                const newServiceIds = new Set(services.map(s => s.id));

                // Update existing services and add new ones
                services.forEach(newService => {
                    const index = currentData.findIndex(s => s.id === newService.id);
                    if (index >= 0) {
                        // Update existing service in place
                        Object.assign(currentData[index], newService);
                    } else {
                        // Add new service
                        currentData.push(newService);
                    }
                });

                // Remove services that no longer exist
                const toRemove = currentData.filter(s => !newServiceIds.has(s.id));
                toRemove.forEach(service => {
                    const index = currentData.indexOf(service);
                    if (index >= 0) {
                        currentData.splice(index, 1);
                    }
                });

                // Update filtered data
                this.latestServices = currentData;
                this.dataSource.data = this.applyFilters(currentData);
            }
        });
    }

    /**
     * Gets the time elapsed since a timestamp.
     *
     * @param timestamp - Date object
     * @returns Formatted elapsed time string
     */
    getElapsedTime(timestamp: Date): string {
        return this.timeFormatService.getElapsedTime(timestamp);
    }

    /**
     * Gets the time elapsed since a timestamp in compact format.
     *
     * @param timestamp - Date object
     * @returns Formatted elapsed time string
     */
    getCompactElapsedTime(timestamp: Date): string {
        return this.timeFormatService.getCompactElapsedTime(timestamp);
    }

    /**
     * Gets the heartbeat status class for a service.
     * Returns 'error' if the last heartbeat is more than 10 seconds old.
     *
     * @param service - Service to check
     * @returns Status class
     */
    getHeartbeatStatus(service: ServiceInfo): string {
        const now = new Date();
        const elapsed = now.getTime() - service.lastHeartbeat.getTime();
        return elapsed > 10000 ? 'error' : '';
    }

    /**
     * Gets the connection status of a service.
     * Returns 'error' if the last heartbeat is more than 10 seconds old.
     *
     * @param service - Service to check
     * @returns Connection status class
     */
    getConnectionStatus(service: ServiceInfo): string {
        return this.getHeartbeatStatus(service);
    }

    /**
     * Gets the connection status tooltip for a service.
     *
     * @param service - Service to get tooltip for
     * @returns Tooltip text
     */
    getConnectionTooltip(service: ServiceInfo): string {
        if (this.getHeartbeatStatus(service) == 'error') {
            return `No heartbeat for ${this.getElapsedTime(service.lastHeartbeat)}`;
        }
        return '';
    }

    /**
     * Gets the uptime status class for a service.
     * Returns 'error' if the last heartbeat is more than 10 seconds old.
     *
     * @param service - Service to check
     * @returns Status class
     */
    getUptimeStatus(service: ServiceInfo): string {
        return this.getHeartbeatStatus(service);
    }

    /**
     * Refreshes the services display with current filters.
     */
    refreshServices() {
        this.dataSource.data = this.applyFilters(this.latestServices);
    }

    /**
     * Toggles the pause state of service updates.
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        if (!this.isPaused) {
            this.refreshServices();
        }
    }

    /**
     * Toggles multi-expand functionality.
     * When disabled, collapses all expanded rows.
     */
    toggleMultiExpand(): void {
        this.isMultiExpandEnabled = !this.isMultiExpandEnabled;
        if (!this.isMultiExpandEnabled) {
            this.expandedRows.clear();
        }
    }

    /**
     * Toggles the expansion state of a service's metadata.
     *
     * @param service - Service to toggle
     */
    toggleMetaExpansion(service: ServiceInfo) {
        if (this.isMultiExpandEnabled) {
            if (this.expandedRows.has(service)) {
                this.expandedRows.delete(service);
            } else {
                this.expandedRows.add(service);
            }
        } else {
            if (this.expandedRows.has(service)) {
                this.expandedRows.clear();
            } else {
                this.expandedRows.clear();
                this.expandedRows.add(service);
            }
        }
    }

    /**
     * Checks if a row is expanded.
     *
     * @param row - Row to check
     * @returns Whether the row is expanded
     */
    isExpanded(row: ServiceInfo): boolean {
        return this.expandedRows.has(row);
    }

    /**
     * Gets a preview of metadata fields.
     *
     * @param meta - Metadata object
     * @returns String describing number of metadata fields
     */
    getMetaPreview(meta: any): string {
        if (!meta) return '';
        const fields = Object.keys(meta);
        return fields.length === 1
            ? `1 field`
            : `${fields.length} fields`;
    }

    /**
     * Clears all active filters.
     */
    clearFilters() {
        this.idFilter = '';
        this.nameFilter = '';
        this.descriptionFilter = '';
        this.connectedAtFilter = '';
        this.heartbeatFilter = '';
        this.metaFilter = '';
        this.statusFilter = '';
        this.applyFilter();
    }

    /**
     * Clears the ID filter.
     */
    clearIdFilter() {
        this.idFilter = '';
        this.applyFilter();
    }

    /**
     * Clears the name filter.
     */
    clearNameFilter() {
        this.nameFilter = '';
        this.applyFilter();
    }

    /**
     * Clears the connected at filter.
     */
    clearConnectedAtFilter() {
        this.connectedAtFilter = '';
        this.applyFilter();
    }

    /**
     * Clears the heartbeat filter.
     */
    clearHeartbeatFilter() {
        this.heartbeatFilter = '';
        this.applyFilter();
    }

    /**
     * Clears the description filter.
     */
    clearDescriptionFilter() {
        this.descriptionFilter = '';
        this.applyFilter();
    }

    /**
     * Clears the meta filter.
     */
    clearMetaFilter() {
        this.metaFilter = '';
        this.applyFilter();
    }

    /**
     * Clears the status filter.
     */
    clearStatusFilter() {
        this.statusFilter = '';
        this.applyFilter();
    }

    /**
     * Checks if any filters are currently active.
     *
     * @returns Whether any filters are active
     */
    hasActiveFilters(): boolean {
        return !!(this.idFilter || this.nameFilter || this.descriptionFilter ||
                 this.connectedAtFilter || this.heartbeatFilter || this.metaFilter ||
                 this.statusFilter);
    }

    /**
     * Applies current filters to the data source.
     */
    applyFilter() {
        this.dataSource.data = this.applyFilters(this.latestServices);
    }

    /**
     * Applies filters to a set of services.
     *
     * @param services - Services to filter
     * @returns Filtered services
     */
    private applyFilters(services: ServiceInfo[]): ServiceInfo[] {
        return services.filter(service => {
            const matchesId = !this.idFilter ||
                service.id.toLowerCase().includes(this.idFilter.toLowerCase());
            const matchesName = !this.nameFilter ||
                this.getDisplayName(service).toLowerCase().includes(this.nameFilter.toLowerCase());
            const matchesDescription = !this.descriptionFilter ||
                this.getDisplayDescription(service).toLowerCase().includes(this.descriptionFilter.toLowerCase());
            const matchesConnectedAt = !this.connectedAtFilter ||
                service.connectedAt.toLocaleString().toLowerCase().includes(this.connectedAtFilter.toLowerCase());
            const matchesHeartbeat = !this.heartbeatFilter ||
                service.lastHeartbeat.toLocaleString().toLowerCase().includes(this.heartbeatFilter.toLowerCase());
            const matchesMeta = !this.metaFilter ||
                (service.meta && JSON.stringify(service.meta).toLowerCase().includes(this.metaFilter.toLowerCase()));
            const matchesStatus = !this.statusFilter ||
                service.status.toLowerCase().includes(this.statusFilter.toLowerCase());

            return matchesId && matchesName && matchesDescription && matchesConnectedAt &&
                   matchesHeartbeat && matchesMeta && matchesStatus;
        });
    }

    /**
     * Gets the display name for a service.
     * Returns the name if available, otherwise returns the ID in a muted style.
     *
     * @param service - Service to get display name for
     * @returns Display name with optional styling
     */
    getDisplayName(service: ServiceInfo): string {
        if (service.name && service.name.trim()) {
            return service.name;
        }
        return service.id;
    }

    /**
     * Gets the display description for a service.
     * Returns the description if available, otherwise returns a placeholder.
     *
     * @param service - Service to get display description for
     * @returns Display description with optional styling
     */
    getDisplayDescription(service: ServiceInfo): string {
        if (service.description && service.description.trim()) {
            return service.description;
        }
        return 'No description';
    }

    /**
     * Checks if a service has a name.
     * Used for conditional styling.
     *
     * @param service - Service to check
     * @returns Whether the service has a name
     */
    hasName(service: ServiceInfo): boolean {
        return !!(service.name && service.name.trim());
    }

    /**
     * Checks if a service has a description.
     * Used for conditional styling.
     *
     * @param service - Service to check
     * @returns Whether the service has a description
     */
    hasDescription(service: ServiceInfo): boolean {
        return !!(service.description && service.description.trim());
    }

    /**
     * Checks if a service has metadata.
     * Used for conditional styling.
     *
     * @param service - Service to check
     * @returns Whether the service has metadata
     */
    hasMetaData(service: ServiceInfo): boolean {
        return !!(service.meta && Object.keys(service.meta).length > 0);
    }

    /**
     * Gets the formatted date string for display.
     *
     * @param timestamp - Date object
     * @returns Formatted date string
     */
    getFormattedDate(timestamp: Date): string {
        return timestamp.toLocaleString(undefined, {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    /**
     * Gets entries from a metrics object for display.
     *
     * @param metrics - Metrics object
     * @returns Array of metric entries with name and value
     */
    getMetricEntries(metrics: Record<string, number>): { name: string; value: number }[] {
        return Object.entries(metrics).map(([name, value]) => ({ name, value }));
    }

    /**
     * Selects a service for detailed view.
     *
     * @param service - Service to select
     */
    selectService(service: ServiceInfo): void {
        this.selectedService = this.selectedService === service ? undefined : service;
        if (this.selectedService) {
            this.fetchServiceDetails(this.selectedService.id);
        }
    }

    /**
     * Fetches additional details for a service.
     *
     * @param serviceId - ID of the service to fetch details for
     */
    private async fetchServiceDetails(serviceId: string): Promise<void> {
        const service = this.dataSource.data.find(s => s.id === serviceId);
        if (!service) return;

        // Set up polling for subscriptions
        const pollSubscriptions = async () => {
            try {
                const subsResponse = await this.servicesService.fetchServiceSubscriptions(serviceId);
                if (subsResponse && subsResponse.subscriptions) {
                    service.subscriptions = subsResponse.subscriptions;
                    // Force update
                    this.dataSource.data = [...this.dataSource.data];
                }
            } catch (error) {
                console.warn(`Failed to get subscriptions for service ${serviceId}:`, error);
            }
        };

        // Initial fetch
        await pollSubscriptions();

        // Set up polling interval
        const subscriptionsInterval = window.setInterval(pollSubscriptions, 5000);

        // Subscribe to metrics to get service-specific metrics
        const metricsSubscription = this.metricsService.metrics$.subscribe(metrics => {
            const serviceMetrics: Record<string, number> = {};
            for (const metric of metrics) {
                if (metric.name.includes(`{serviceid:${serviceId}}`)) {
                    serviceMetrics[metric.name] = metric.value;
                }
            }
            if (Object.keys(serviceMetrics).length > 0) {
                service.metrics = serviceMetrics;
                // Force update
                this.dataSource.data = [...this.dataSource.data];
            }
        });

        // Store subscriptions to clean up later
        if (this.metricsSubscription) {
            this.metricsSubscription.unsubscribe();
        }
        if (this.subscriptionsInterval) {
            clearInterval(this.subscriptionsInterval);
        }
        this.metricsSubscription = metricsSubscription;
        this.subscriptionsInterval = subscriptionsInterval;
    }

    /**
     * Checks if a service is currently selected.
     *
     * @param service - Service to check selection state for
     * @returns Whether the service is selected
     */
    isSelected(service: ServiceInfo): boolean {
        return this.selectedService === service;
    }

    /**
     * Closes the details panel.
     */
    closeDetails(): void {
        this.selectedService = undefined;
        this.metricsSubscription?.unsubscribe();
        if (this.subscriptionsInterval) {
            clearInterval(this.subscriptionsInterval);
            this.subscriptionsInterval = undefined;
        }
    }

    /**
     * Changes the selected tab in the details panel.
     *
     * @param tabIndex - Index of the tab to select
     */
    onTabChange(tabIndex: number): void {
        this.selectedTab = tabIndex;
    }

    /**
     * Gets the formatted status text.
     *
     * @param status - Status to format
     * @returns Formatted status text
     */
    getFormattedStatus(status: ServiceStatus): string {
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    /**
     * Gets the CSS class for a status.
     *
     * @param status - Status to get class for
     * @returns CSS class name
     */
    getStatusClass(status: ServiceStatus): string {
        return `status-${status}`;
    }
}