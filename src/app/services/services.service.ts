import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WebsocketService } from './websocket.service';

/** Status of a service */
export type ServiceStatus = 'connected' | 'disconnected';

/** Structure of a service entry in the application */
export interface ServiceInfo {
    /** Unique identifier for the service */
    id: string;
    /** Name of the service */
    name: string;
    /** Service description */
    description: string;
    /** Current status of the service */
    status: ServiceStatus;
    /** Timestamp when the service connected */
    connectedAt: Date;
    /** Timestamp of the last heartbeat received */
    lastHeartbeat: Date;
    /** List of topics the service is subscribed to */
    subscriptions?: string[];
    /** Service-specific metrics */
    metrics?: Record<string, number>;
    /** Additional metadata about the service */
    meta?: any;
}

/** Maximum number of disconnected services to remember */
const MAX_DISCONNECTED_SERVICES = 100;
const SERVICE_INFO_BASE_FIELDS = new Set(['id', 'name', 'description', 'connectedAt', 'lastHeartbeat', 'status', 'subscriptions', 'metrics']);

/**
 * Service responsible for managing system services information.
 * Handles service list polling and updates.
 */
@Injectable({
    providedIn: 'root'
})
export class ServicesService implements OnDestroy {
    /** Subject holding the current services */
    private servicesSubject = new BehaviorSubject<ServiceInfo[]>([]);
    /** Subject indicating whether services are currently being loaded */
    private loadingSubject = new BehaviorSubject<boolean>(false);
    /** Observable stream of services */
    services$ = this.servicesSubject.asObservable();
    /** Observable indicating whether services are currently being loaded */
    public loading$ = this.loadingSubject.asObservable();
    /** ID of the polling interval timer */
    private intervalId?: number;
    /** Map of disconnected services by ID */
    private disconnectedServices = new Map<string, ServiceInfo>();
    /** Currently selected service ID */
    private selectedServiceId?: string;

    /**
     * Creates an instance of ServicesService.
     *
     * @param websocketService - Service for WebSocket communication
     */
    constructor(private websocketService: WebsocketService) {
        this.startPolling();
    }

    /**
     * Sets the currently selected service ID.
     * This is used to determine when to fetch additional service details.
     *
     * @param serviceId - ID of the selected service
     */
    setSelectedServiceId(serviceId?: string): void {
        this.selectedServiceId = serviceId;
    }

    /**
     * Cleans up resources when the service is destroyed.
     */
    ngOnDestroy() {
        this.stopPolling();
        this.servicesSubject.complete();
    }

    /**
     * Starts polling for services at regular intervals.
     * Clears any existing polling interval before starting a new one.
     */
    private async startPolling(): Promise<void> {
        // Clear any existing interval
        this.stopPolling();

        // Set a new interval to poll for services
        this.intervalId = window.setInterval(this.pollServices.bind(this), 5000);
        await this.pollServices();
    }

    /**
     * Polls the server for current services.
     * Only fetches metrics and subscriptions for the selected service.
     */
    private async pollServices(): Promise<void> {
        try {
            this.loadingSubject.next(true);
            const response = await this.websocketService.request('system.service.list', {});
            if (response && response.services && Array.isArray(response.services)) {
                const currentServiceIds = new Set<string>();
                const services = await Promise.all(response.services.map(async (service: any) => {
                    currentServiceIds.add(service.id);
                    const serviceInfo: ServiceInfo = {
                        id: service.id,
                        name: service.name,
                        description: service.description || '',
                        status: 'connected',
                        connectedAt: new Date(service.connectedAt),
                        lastHeartbeat: new Date(service.lastHeartbeat)
                    };
                    const meta = this.extractMeta(service);
                    if (meta) {
                        serviceInfo.meta = meta;
                    }

                    // Only fetch additional details for the selected service
                    if (service.id === this.selectedServiceId) {
                        // Try to get subscriptions
                        try {
                            const subsResponse = await this.websocketService.request('system.service.subscriptions', { serviceId: service.id });
                            if (subsResponse && subsResponse.subscriptions) {
                                serviceInfo.subscriptions = subsResponse.subscriptions;
                            }
                        } catch (error) {
                            console.warn(`Failed to get subscriptions for service ${service.id}:`, error);
                        }

                        // Get metrics for this service
                        try {
                            const metricsResponse = await this.websocketService.request('system.metrics', { showAll: true });
                            if (metricsResponse && metricsResponse.metrics) {
                                const serviceMetrics: Record<string, number> = {};
                                for (const [name, info] of Object.entries<any>(metricsResponse.metrics)) {
                                    if (name.startsWith('se.')) {
                                        serviceMetrics[name] = info.value;
                                    }
                                }
                                if (Object.keys(serviceMetrics).length > 0) {
                                    serviceInfo.metrics = serviceMetrics;
                                }
                            }
                        } catch (error) {
                            console.warn(`Failed to get metrics for service ${service.id}:`, error);
                        }
                    }

                    return serviceInfo;
                }));

                // Handle disconnected services
                const currentServices = this.servicesSubject.value;
                const disconnectedServices = currentServices.filter(s => !currentServiceIds.has(s.id));

                disconnectedServices.forEach(service => {
                    const disconnectedService = { ...service };
                    disconnectedService.status = 'disconnected';
                    this.disconnectedServices.set(service.id, disconnectedService);

                    // Keep only the last MAX_DISCONNECTED_SERVICES
                    if (this.disconnectedServices.size > MAX_DISCONNECTED_SERVICES) {
                        let oldestHeartbeat = new Date();
                        let oldestService: ServiceInfo | undefined;
                        for (const service of this.disconnectedServices.values()) {
                            if (service.lastHeartbeat < oldestHeartbeat) {
                                oldestHeartbeat = service.lastHeartbeat;
                                oldestService = service;
                            }
                        }
                        if (oldestService) {
                            this.disconnectedServices.delete(oldestService.id);
                        }
                    }
                });

                // Combine current and disconnected services
                const allServices = [
                    ...services,
                    ...Array.from(this.disconnectedServices.values())
                ];

                this.servicesSubject.next(allServices);
            } else {
                console.error('Invalid services response:', response);
            }
        } catch (error) {
            console.error('Error polling services:', error);
        } finally {
            this.loadingSubject.next(false);
        }
    }

    /**
     * Extracts metadata from a service object.
     * Excludes standard fields and returns the rest as metadata.
     *
     * @param service - Service object from the server
     * @returns Metadata object
     */
    private extractMeta(service: any): any {
        const meta: any = {};
        let hasMetadata = false;

        for (const key in service) {
            if (!SERVICE_INFO_BASE_FIELDS.has(key)) {
                meta[key] = service[key];
                hasMetadata = true;
            }
        }

        return hasMetadata ? meta : undefined;
    }

    /**
     * Stops the services polling interval.
     * Cleans up the interval timer.
     */
    private stopPolling(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }

    /**
     * Fetches subscriptions for a service.
     *
     * @param serviceId - ID of the service to fetch subscriptions for
     * @returns Promise resolving to the subscriptions response
     */
    async fetchServiceSubscriptions(serviceId: string): Promise<any> {
        return this.websocketService.request('system.service.subscriptions', { serviceId });
    }

    /**
     * Fetches metrics for services.
     *
     * @returns Promise resolving to the metrics response
     */
    async fetchServiceMetrics(): Promise<any> {
        return this.websocketService.request('system.metrics', { showAll: true });
    }

    /**
     * Clears the list of disconnected services
     */
    clearDisconnected(): void {
        this.disconnectedServices.clear();
        // Update the services list to remove disconnected services
        const currentServices = this.servicesSubject.value;
        this.servicesSubject.next(currentServices.filter(service => service.status === 'connected'));
    }

    /**
     * Manually triggers a services refresh.
     * Returns a promise that resolves when the refresh is complete.
     *
     * @returns Promise that resolves when the refresh is complete
     */
    public async refresh(): Promise<void> {
        return this.pollServices();
    }
}