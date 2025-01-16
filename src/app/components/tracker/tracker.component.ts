import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TableComponent, TableColumn } from '../common/table/table.component';
import { FlowDiagramComponent } from './flow-diagram/flow-diagram.component';
import { BehaviorSubject, map } from 'rxjs';
import { ActionType, Message, MessageHeader } from '../../services/websocket.service';
import { MOCK_DATA } from './mock';

interface ErrorDetails {
    code: string;
    message: string;
    metadata?: Record<string, any>;
}

interface Listener {
    serviceId: string;
    topic: string;
}

interface RelatedMessage extends MessageHeader {
    originatorServiceId: string;
    responderServiceIds?: string[];  // For Publish type
    responderServiceId?: string;     // For Request type
    status: string;
}

export interface MessageFlow {
    status: 'success' | 'error' | 'dropped' | 'timeout';
    receivedAt: Date;
    completedAt: Date;
    brokerProcessingTime: number; // in milliseconds
    timeout: number;              // in milliseconds
    error?: ErrorDetails;
    listeners?: Listener[];
    request: {
        serviceId: string;
        message: Message;
    };
    response?: {
        target?: {
            serviceId: string;
            priority: number;
        };
        fromBroker: boolean;
        message?: Message;
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
    data$ = new BehaviorSubject<MessageFlow[]>([]);

    columns: TableColumn[] = [
        { name: 'request.serviceId', label: 'Originator', sortable: true, filterable: true },
        { name: 'response.serviceId', label: 'Responder', sortable: true, filterable: true },
        { name: 'request.topic', label: 'Topic', sortable: true, filterable: true },
        { name: 'status', label: 'Status', sortable: true, filterable: true },
        { name: 'completedAt', label: 'Completed', sortable: true, filterable: true },
        { name: 'meta', label: 'Meta', sortable: false, filterable: (data: any, filter: string) => {
            return this.getMetaSearchContent(data).includes(filter);
        } }
    ];

    constructor() {}

    ngOnInit(): void {
        // Initialize the data
        this.data$.next(MOCK_DATA);
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

    getMessageSize(message: Message): number {
        const headerObj = message.header;
        const headerStr = `${headerObj.action}:${headerObj.topic}:${headerObj.version}${headerObj.requestId ? `:${headerObj.requestId}` : ''}`;
        const payloadStr = JSON.stringify(message.payload);
        const buffer = new TextEncoder().encode(`${headerStr}\n${payloadStr}`);
        return buffer.length;
    }

    getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }

    /**
     * Generates the meta text displayed in the column
     */
    getMetaText(flow: MessageFlow): string {
        const parts = ['Request', 'Response'];

        if (flow.listeners?.length) {
            parts.push(`${flow.listeners.length} Listener${flow.listeners.length > 1 ? 's' : ''}`);
        }

        if (flow.relatedMessages?.length) {
            parts.push(`${flow.relatedMessages.length} Related Message${flow.relatedMessages.length > 1 ? 's' : ''}`);
        }

        return parts.join(', ');
    }

    /**
     * Generates the searchable content for the meta column
     */
    getMetaSearchContent(flow: MessageFlow): string {
        const searchParts = [];

        // Request content
        if (flow.request) {
            searchParts.push(JSON.stringify(flow.request.message.header));
            if (flow.request.message.payload) {
                searchParts.push(JSON.stringify(flow.request.message.payload));
            }
        }

        // Response content
        if (flow.response?.message) {
            searchParts.push(JSON.stringify(flow.response.message.header));
            if (flow.response.message.payload) {
                searchParts.push(JSON.stringify(flow.response.message.payload));
            }
        }

        // Listeners
        if (flow.listeners?.length) {
            searchParts.push(flow.listeners.map((l: Listener) => l.serviceId).join(' '));
        }

        // Related messages
        if (flow.relatedMessages?.length) {
            const relatedContent = flow.relatedMessages.map((msg: RelatedMessage) =>
                `${msg.originatorServiceId} ${msg.topic}`
            ).join(' ');
            searchParts.push(relatedContent);
        }

        return searchParts.join(' ');
    }
}
