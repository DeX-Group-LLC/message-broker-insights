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
import { Message, WebsocketService } from '../../services/websocket.service';
//import { MOCK_DATA } from './mock';
import { ExportComponent } from '../common/export/export.component';
import { MatButtonModule } from '@angular/material/button';
import { MessageFlow, RelatedMessage, TrackerService } from '../../services/tracker.service';
import { ServicesService } from '../../services/services.service';

/*interface RelatedMessage {
    serviceId: string;
    header: ClientHeader;
    targetServiceIds?: string[];
}

export interface MessageFlow {
    auditors?: string[];  // Array of service IDs that receive a copy of the message
    request: {
        serviceId: string;
        message: Message;
        timeout: number;     // in milliseconds
        receivedAt: Date;    // when the broker received the request
        respondedAt: Date;   // when the response was sent back to the originator
    };
    response?: {
        target?: {
            serviceId: string;
            priority: number;
        };
        fromBroker: boolean;
        message?: Message;
    };
    parentMessage?: RelatedMessage;
    childMessages?: RelatedMessage[];
}*/

@Component({
    selector: 'app-tracker',
    standalone: true,
    imports: [
        CommonModule,
        ExportComponent,
        MatCardModule,
        MatButtonModule,
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

    columns: TableColumn[] = [
        { name: 'request.message.header.requestId', label: 'Request ID', sortable: true, filterable: true },
        { name: 'request.serviceId', label: 'Originator', sortable: true, filterable: true },
        { name: 'response.target.serviceId', label: 'Responder', sortable: true, filterable: true },
        { name: 'request.message.header.topic', label: 'Topic', sortable: true, filterable: true },
        { name: 'response.message.payload.error.code', label: 'Status', sortable: true, filterable: true },
        { name: 'response.sentAt', label: 'Completed', sortable: true, filterable: true },
        { name: 'meta', label: 'Meta', sortable: false, filterable: (data: any, filter: string) => {
            return this.getMetaSearchContent(data).includes(filter);
        } }
    ];

    constructor(private websocketService: WebsocketService, private servicesService: ServicesService, public trackerService: TrackerService) {}

    ngOnInit(): void {
        this.trackerService.data$.on(this._handleDataChange);
    }

    ngOnDestroy(): void {
        this.trackerService.data$.off(this._handleDataChange);
    }

    handleDataChange(data: MessageFlow): void {
        // If the selected flow is no longer in the data, clear the selection
        if (this.selectedFlow && !this.trackerService.flows.includes(this.selectedFlow)) {
            this.selectedFlow = null;
        }
    }
    private _handleDataChange = this.handleDataChange.bind(this);

    onSelectionChange(selected: MessageFlow[]): void {
        this.selectedFlow = selected[0];
    }

    getStatusColor(messageFlow: MessageFlow): string {
        switch (messageFlow.response?.message?.payload?.['error']?.code) {
            case undefined: return '#4caf50'; // success
            case 'NO_RESPONDERS':
            case 'SERVICE_UNAVAILABLE':
            case 'REQUEST_TIMEOUT': return '#ff9800';
            default:return '#f44336';
        }
    }

    getHeaderItems(header: any): Array<{key: string, value: any}> {
        if (!header) return [];
        return Object.entries(header).map(([key, value]) => ({ key, value }));
    }

    getProcessingDuration(flow: MessageFlow): string {
        if (!flow.response?.sentAt) return 'N/A';
        return (flow.response.sentAt.getTime() - flow.request.receivedAt.getTime()).toLocaleString(undefined, { maximumFractionDigits: 0 }) + 'ms';
    }

    getMessageSize(message: Message): number {
        return this.websocketService.getMessageSize(message.header, message.payload);
    }

    getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }

    /**
     * Generates the meta text displayed in the column
     */
    getMetaText(flow: MessageFlow): string {
        const parts = ['Request', 'Response'];

        if (flow.auditors?.length) {
            parts.push(`${flow.auditors.length} Auditor${flow.auditors.length > 1 ? 's' : ''}`);
        }

        if (flow.parentMessage) {
            parts.push(`Parent Message`);
        }

        if (flow.childMessages?.length) {
            parts.push(`${flow.childMessages.length} Child Message${flow.childMessages.length > 1 ? 's' : ''}`);
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

        // Auditors
        if (flow.auditors?.length) {
            searchParts.push(flow.auditors.join(' '));
        }

        // Related messages
        if (flow.parentMessage) {
            searchParts.push(`${flow.parentMessage.serviceId} ${JSON.stringify(flow.parentMessage.header)}`);
        }

        if (flow.childMessages?.length) {
            const relatedContent = flow.childMessages.map((msg: RelatedMessage) =>
                `${msg.serviceId} ${JSON.stringify(msg.header)}`
            ).join(' ');
            searchParts.push(relatedContent);
        }

        return searchParts.join(' ');
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
     * Gets the service name for a given service ID.
     *
     * @param serviceId - Service ID to get the name for
     * @returns Service name
     */
    getServiceName(serviceId: string): string {
        return this.servicesService.getService(serviceId)?.name || serviceId;
    }

    /**
     * Closes the service details panel.
     */
    closeDetails(): void {
        this.selectedFlow = null;
    }
}
