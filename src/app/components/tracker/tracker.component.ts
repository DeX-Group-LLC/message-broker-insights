import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TableComponent, TableColumn } from '../common/table/table.component';
import { FlowDiagramComponent } from './flow-diagram/flow-diagram.component';
import { BehaviorSubject } from 'rxjs';

interface ErrorDetails {
    code: string;
    message: string;
    metadata?: Record<string, any>;
}

interface Listener {
    serviceId: string;
    topic: string;
}

interface RelatedMessage {
    type: 'Publish' | 'Request';
    topic: string;
    originatorServiceId: string;
    responderServiceIds?: string[];  // For Publish type
    responderServiceId?: string;     // For Request type
    status: string;
    requestId?: string;              // For Request type
}

interface MessageFlow {
    requestId: string;
    originatorServiceId: string;
    responderServiceId: string;
    topic: string;
    version: string;
    status: 'success' | 'error' | 'dropped' | 'timeout';
    receivedAt: Date;
    completedAt: Date;
    brokerProcessingTime: number; // in milliseconds
    timeout: number;              // in milliseconds
    payload: any;
    header: {
        action: string;
        topic: string;
        version: string;
        requestId: string;
        [key: string]: any;
    };
    responderPriority: number;
    error?: ErrorDetails;
    listeners?: Listener[];
    response?: {
        header: {
            action: string;
            topic: string;
            version: string;
            requestId: string;
            [key: string]: any;
        };
        payload: any;
    };
    relatedMessages?: RelatedMessage[];
    parentRequestId?: string;
    childRequestIds?: string[];
}

@Component({
    selector: 'app-tracker',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatTabsModule,
        MatIconModule,
        MatExpansionModule,
        MatTooltipModule,
        TableComponent,
        FlowDiagramComponent
    ],
    templateUrl: './tracker.component.html',
    styleUrls: ['./tracker.component.scss']
})
export class TrackerComponent implements OnInit {
    selectedFlow: MessageFlow | null = null;
    mockData$ = new BehaviorSubject<MessageFlow[]>([]);

    columns: TableColumn[] = [
        { name: 'originatorServiceId', label: 'Originator', sortable: true, filterable: true },
        { name: 'responderServiceId', label: 'Responder', sortable: true, filterable: true },
        { name: 'topic', label: 'Topic', sortable: true, filterable: true },
        { name: 'status', label: 'Status', sortable: true, filterable: true },
        { name: 'completedAt', label: 'Completed', sortable: true, filterable: true }
    ];

    mockData: MessageFlow[] = [
        {
            requestId: 'req-001',
            originatorServiceId: 'frontend-service',
            responderServiceId: 'auth-service',
            topic: 'system.auth.request',
            version: '1.0.0',
            status: 'success',
            receivedAt: new Date('2024-01-20T10:00:00'),
            completedAt: new Date('2024-01-20T10:00:01'),
            brokerProcessingTime: 50,
            timeout: 30000,
            payload: { username: 'john.doe', action: 'login' },
            header: {
                action: 'request',
                topic: 'system.auth.request',
                version: '1.0.0',
                requestId: 'req-001'
            },
            responderPriority: 1,
            listeners: [
                { serviceId: 'logging-service', topic: 'system.auth.request' },
                { serviceId: 'audit-service', topic: 'system.auth.request' }
            ],
            response: {
                header: {
                    action: 'response',
                    topic: 'system.auth.request',
                    version: '1.0.0',
                    requestId: 'req-001'
                },
                payload: { token: 'xyz123', expiresIn: 3600 }
            },
            relatedMessages: [
                {
                    type: 'Publish',
                    topic: 'system.audit.log',
                    originatorServiceId: 'auth-service',
                    responderServiceIds: ['audit-service', 'logging-service'],
                    status: 'success'
                },
                {
                    type: 'Request',
                    topic: 'system.user.validate',
                    originatorServiceId: 'auth-service',
                    responderServiceId: 'user-service',
                    status: 'success',
                    requestId: 'req-001-1'
                }
            ]
        },
        {
            requestId: 'req-002',
            originatorServiceId: 'user-service',
            responderServiceId: 'email-service',
            topic: 'system.email.request',
            version: '1.0.0',
            status: 'timeout',
            receivedAt: new Date('2024-01-20T10:05:00'),
            completedAt: new Date('2024-01-20T10:05:02'),
            brokerProcessingTime: 45,
            timeout: 2000,
            payload: { to: 'user@example.com', template: 'welcome' },
            header: {
                action: 'request',
                topic: 'system.email.request',
                version: '1.0.0',
                requestId: 'req-002'
            },
            responderPriority: 2,
            error: {
                code: 'REQUEST_TIMEOUT',
                message: 'Request timed out after 2000ms',
                metadata: {
                    timeout: 2000,
                    responderServiceId: 'email-service'
                }
            }
        },
        {
            requestId: 'req-003',
            originatorServiceId: 'order-service',
            responderServiceId: 'inventory-service',
            topic: 'system.inventory.request',
            version: '1.0.0',
            status: 'error',
            receivedAt: new Date('2024-01-20T10:10:00'),
            completedAt: new Date('2024-01-20T10:10:01'),
            brokerProcessingTime: 30,
            timeout: 30000,
            payload: { productId: '123', quantity: 5 },
            header: {
                action: 'request',
                topic: 'system.inventory.request',
                version: '1.0.0',
                requestId: 'req-003'
            },
            responderPriority: 1,
            error: {
                code: 'INSUFFICIENT_STOCK',
                message: 'Not enough stock available',
                metadata: {
                    productId: '123',
                    requestedQuantity: 5,
                    availableQuantity: 3
                }
            },
            response: {
                header: {
                    action: 'response',
                    topic: 'system.inventory.request',
                    version: '1.0.0',
                    requestId: 'req-003'
                },
                payload: {
                    error: {
                        code: 'INSUFFICIENT_STOCK',
                        message: 'Not enough stock available',
                        requestedQuantity: 5,
                        availableQuantity: 3
                    }
                }
            }
        },
        {
            requestId: 'req-004',
            originatorServiceId: 'catalog-service',
            responderServiceId: '',
            topic: 'system.pricing.request',
            version: '1.0.0',
            status: 'dropped',
            receivedAt: new Date('2024-01-20T10:15:00'),
            completedAt: new Date('2024-01-20T10:15:00'),
            brokerProcessingTime: 5,
            timeout: 30000,
            payload: { productId: '123', quantity: 1 },
            header: {
                action: 'request',
                topic: 'system.pricing.request',
                version: '1.0.0',
                requestId: 'req-004'
            },
            responderPriority: 0,
            error: {
                code: 'NO_RESPONDERS',
                message: 'No responders available for topic',
                metadata: {
                    topic: 'system.pricing.request'
                }
            },
            response: {
                header: {
                    action: 'response',
                    topic: 'system.pricing.request',
                    version: '1.0.0',
                    requestId: 'req-004'
                },
                payload: {
                    error: {
                        code: 'NO_RESPONDERS',
                        message: 'No responders available for topic',
                        topic: 'system.pricing.request'
                    }
                }
            }
        },
        {
            requestId: 'req-005',
            originatorServiceId: 'payment-service',
            responderServiceId: 'transaction-service',
            topic: 'system.transaction.request',
            version: '1.0.0',
            status: 'error',
            receivedAt: new Date('2024-01-20T10:20:00'),
            completedAt: new Date('2024-01-20T10:20:00'),
            brokerProcessingTime: 2,
            timeout: 30000,
            payload: {
                accountId: 'acc123',
                amount: 100.00,
                currency: 'USD'
            },
            header: {
                action: 'request',
                topic: 'system.transaction.request',
                version: '1.0.0',
                requestId: 'req-005'
            },
            responderPriority: 1,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Message broker internal error',
                metadata: {
                    errorId: 'mb-err-123',
                    component: 'message-router',
                    details: 'Failed to route message due to internal error'
                }
            }
        },
        {
            requestId: 'req-006',
            originatorServiceId: 'order-service',
            responderServiceId: 'shipping-service',
            topic: 'system.shipping.calculate',
            version: '1.0.0',
            status: 'dropped',
            receivedAt: new Date('2024-01-20T10:25:00'),
            completedAt: new Date('2024-01-20T10:25:02'),
            brokerProcessingTime: 2000,
            timeout: 30000,
            payload: {
                orderId: 'ord123',
                items: [
                    { productId: 'p1', quantity: 2, weight: 1.5 },
                    { productId: 'p2', quantity: 1, weight: 0.5 }
                ],
                destination: {
                    country: 'US',
                    zipCode: '94105'
                }
            },
            header: {
                action: 'request',
                topic: 'system.shipping.calculate',
                version: '1.0.0',
                requestId: 'req-006'
            },
            responderPriority: 1,
            error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Message broker is busy',
                metadata: {
                    errorId: 'mb-err-456',
                    component: 'message-queue',
                    details: 'Request dropped due to broker capacity limit'
                }
            },
            response: {
                header: {
                    action: 'response',
                    topic: 'system.shipping.calculate',
                    version: '1.0.0',
                    requestId: 'req-006'
                },
                payload: {
                    error: {
                        code: 'SERVICE_UNAVAILABLE',
                        message: 'Message broker is busy',
                        details: 'Request dropped due to broker capacity limit'
                    }
                }
            }
        }
    ];

    constructor() {}

    ngOnInit(): void {
        // Initialize the data
        this.mockData$.next(this.mockData);
    }

    onSelectionChange(selected: MessageFlow[]): void {
        this.selectedFlow = selected[0];
    }

    getStatusColor(status: string): string {
        switch (status) {
            case 'success': return '#4caf50';
            case 'error': return '#f44336';
            case 'dropped':// return '#9e9e9e';
            case 'timeout': return '#ff9800';
            default: return '#9e9e9e';
        }
    }

    getHeaderItems(header: any): Array<{key: string, value: any}> {
        if (!header) return [];
        return Object.entries(header).map(([key, value]) => ({ key, value }));
    }

    getProcessingDuration(flow: MessageFlow): number {
        return flow.completedAt.getTime() - flow.receivedAt.getTime();
    }

    getMessageSize(obj: any): number {
        return new TextEncoder().encode(JSON.stringify(obj)).length;
    }

    getTotalRequestSize(flow: MessageFlow): number {
        return this.getMessageSize(flow.header) + this.getMessageSize(flow.payload);
    }

    getTotalResponseSize(flow: MessageFlow): number {
        if (!flow.response) return 0;
        return this.getMessageSize(flow.response.header) + this.getMessageSize(flow.response.payload);
    }
}