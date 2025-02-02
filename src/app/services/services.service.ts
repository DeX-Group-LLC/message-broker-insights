import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Metric, MetricInfo, MetricsService } from './metrics.service';
import { ActionType, WebsocketService } from './websocket.service';

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
    /** List of topics the service is subscribed to with priority */
    subscriptions?: { action: ActionType; topic: string; priority?: number }[];
    /** Service-specific metrics */
    metrics?: Metric[];
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
    /** Observable indicating whether services are currently being loading */
    public loading$ = this.loadingSubject.asObservable();
    /** ID of the polling interval timer */
    private intervalId?: number;
    /** Map of disconnected services by ID */
    private disconnectedServices = new Map<string, ServiceInfo>();

    /**
     * Creates an instance of ServicesService.
     *
     * @param websocketService - Service for WebSocket communication
     */
    constructor(private websocketService: WebsocketService, private metricsService: MetricsService) {
        this.startPolling();
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
     */
    private async pollServices(): Promise<void> {
        try {
            this.loadingSubject.next(true);
            const response = (await this.websocketService.request('system.service.list', {})).payload as any;
            if (response && response.services && Array.isArray(response.services)) {
                const currentServiceIds = new Set<string>();
                const currentServices = this.servicesSubject.value;
                const servicesMap = new Map(currentServices.map(s => [s.id, s]));

                const services = response.services.map((service: any) => {
                    currentServiceIds.add(service.id);
                    let serviceInfo = servicesMap.get(service.id);

                    if (serviceInfo) {
                        // Update existing service in place
                        serviceInfo.name = service.name;
                        serviceInfo.description = service.description || '';
                        serviceInfo.status = 'connected';
                        serviceInfo.connectedAt = new Date(service.connectedAt);
                        serviceInfo.lastHeartbeat = new Date(service.lastHeartbeat);

                        const meta = this.extractMeta(service);
                        if (meta) {
                            serviceInfo.meta = meta;
                        } else {
                            //delete serviceInfo.meta;
                        }
                    } else {
                        // Create new service
                        serviceInfo = {
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
                    }

                    return serviceInfo;
                });

                // Handle disconnected services
                const disconnectedServices = currentServices.filter(s => !currentServiceIds.has(s.id));

                disconnectedServices.forEach(service => {
                    // Update existing service in place if it exists in disconnectedServices
                    let disconnectedService = this.disconnectedServices.get(service.id);
                    if (!disconnectedService) {
                        disconnectedService = { ...service };
                        this.disconnectedServices.set(service.id, disconnectedService);
                    }
                    disconnectedService.status = 'disconnected';

                    // Keep only the last MAX_DISCONNECTED_SERVICES
                    if (this.disconnectedServices.size >= MAX_DISCONNECTED_SERVICES) {
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
     * Gets the service info for a given service ID.
     *
     * @param serviceId - Service ID to get the info for
     * @returns Service info
     */
    public getService(serviceId: string): ServiceInfo | undefined {
        const service = this.servicesSubject.value.find(service => service.id === serviceId);
        if (service) return service;
        return this.disconnectedServices.get(serviceId);
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
    async fetchServiceSubscriptions(serviceId: string): Promise<{ subscriptions: { action: ActionType; topic: string; priority?: number }[] }> {
        const response = await this.websocketService.request('system.service.subscriptions', { serviceId });
        return response.payload as any;
    }

    /**
     * Fetches metrics for services.
     *
     * @returns Promise resolving to the metrics response
     */
    /*async fetchServiceMetrics(serviceId: string): Promise<Metric[]> {
        const response: { metrics: Record<string, MetricInfo> } = await this.websocketService.request('system.metrics', { showAll: true, paramFilter: { serviceId } });
        return Object.values(response.metrics).map((metric) => ({ ...metric, timestamp: new Date(metric.timestamp) }));
    }*/
    async fetchServiceMetrics(serviceId: string): Promise<Metric[]> {
        const metrics = [];
        const serviceParam = `{serviceid:${serviceId}}`;
        for (const metric of this.metricsService.getCurrentMetrics()) {
            if (metric.name.includes(serviceParam)) {
                metrics.push(metric);
            }
        }
        return metrics;
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