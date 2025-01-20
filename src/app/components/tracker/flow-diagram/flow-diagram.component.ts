import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MessageHeader } from '../../../services/websocket.service';
import { MessageFlow } from '../../../services/tracker.service';
import { ServicesService } from '../../../services/services.service';

interface FlowNode {
    id: string;
    label: string;
    type: 'parent' | 'originator' | 'broker' | 'responder' | 'auditor' | 'child';
    x: number;
    y: number;
}

interface FlowMessage {
    from: string;
    to: string;
    header: MessageHeader;
    timestamp?: Date;
    status?: string;  // error code or 'SUCCESS'
    isBrokerInput?: boolean;  // True if message is going to broker
}

interface FlowData {
    nodes: FlowNode[];
    messages: FlowMessage[];
}

@Component({
    selector: 'app-flow-diagram',
    standalone: true,
    imports: [CommonModule, MatTooltipModule, MatIconModule],
    schemas: [NO_ERRORS_SCHEMA],
    templateUrl: './flow-diagram.component.html',
    styleUrls: ['./flow-diagram.component.scss']
})
export class FlowDiagramComponent implements OnChanges {
    @Input() messageFlow!: MessageFlow;
    @Output() messageSelect = new EventEmitter<string>();

    width = 800;
    height = 400;
    flowData: FlowData | null = null;

    constructor(private servicesService: ServicesService) {}

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['messageFlow']) {
            this.buildFlowData();
        }
    }

    updateFlow(messageFlow: MessageFlow): void {
        this.messageFlow = messageFlow;
        this.buildFlowData();
    }

    private buildFlowData(): void {
        if (!this.messageFlow) {
            this.flowData = null;
            return;
        }

        const nodes: FlowNode[] = [];
        const messages: FlowMessage[] = [];
        const serviceSpacing = 150;
        const messageSpacing = 30;
        const messageStartY = 60;
        const boxWidth = 100;
        const topPadding = 16;
        const horizontalPadding = 50;
        let sideServicesX = serviceSpacing * 3;
        const leftServicesX = horizontalPadding;
        const timeoutTargetId = this.messageFlow.response?.message?.payload?.error?.details?.targetServiceId;
        const targetId = this.messageFlow.response?.target?.serviceId;
        let addedRightWidth = false;
        let addedResponderWidth = false;

        // Track all Y positions for each service
        const serviceMessageYPositions = new Map<string, number[]>();

        // Calculate initial x position based on whether there's a parent message
        const initialX = this.messageFlow.parentMessage ?
            leftServicesX + boxWidth + boxWidth/2 :
            leftServicesX + boxWidth/2;

        // Add core services with top padding
        nodes.push({
            id: this.messageFlow.request.serviceId,
            label: this.messageFlow.request.serviceId,
            type: 'originator',
            x: initialX,
            y: topPadding
        });

        nodes.push({
            id: 'message-broker',
            label: 'Message Broker',
            type: 'broker',
            x: initialX + serviceSpacing,
            y: topPadding
        });

        // Only add responder node if it exists and is needed
        const errorCode = this.messageFlow.response?.message?.payload?.['error']?.code;
        const isInternalError = errorCode === 'INTERNAL_ERROR';
        const isNoResponders = errorCode === 'NO_RESPONDERS';
        if (targetId && targetId !== 'message-broker' && !isNoResponders) {
            nodes.push({
                id: targetId,
                label: targetId,
                type: 'responder',
                x: initialX + serviceSpacing * 2,
                y: topPadding
            });
            sideServicesX += serviceSpacing;
            addedResponderWidth = true;
        } else if (timeoutTargetId && timeoutTargetId !== targetId) {
            nodes.push({
                id: timeoutTargetId,
                label: timeoutTargetId,
                type: 'responder',
                x: initialX + serviceSpacing * 2,
                y: topPadding
            });
            sideServicesX += serviceSpacing;
            addedResponderWidth = true;
        }
        // Calculate base width without auditors
        let baseWidth = horizontalPadding * 2 + boxWidth * nodes.length + (serviceSpacing - boxWidth) * (nodes.length - 1);

        // Add extra space for parent message if it exists
        if (this.messageFlow.parentMessage) {
            baseWidth += boxWidth;
        }
        // Add extra space for auditors if they exist
        if (this.messageFlow.auditors?.length) {
            baseWidth += boxWidth;
            addedRightWidth = true;
        }

        let messageIndex = 0;

        // Add parent message if it exists
        if (this.messageFlow.parentMessage) {
            messages.push({
                from: this.messageFlow.parentMessage.serviceId,
                to: 'message-broker',
                header: this.messageFlow.parentMessage.header,
                isBrokerInput: true
            });
            messageIndex++;
            // Add the message broker to originator
            const message = {
                from: 'message-broker',
                to: this.messageFlow.request.serviceId,
                header: {
                    ...this.messageFlow.parentMessage.header,
                    requestId: this.messageFlow.request.message.header.parentRequestId
                },
                isBrokerInput: false
            };
            delete message.header.parentRequestId;
            messages.push(message);
            messageIndex++;
        }

        // Add request messages
        messages.push({
            from: this.messageFlow.request.serviceId,
            to: 'message-broker',
            header: this.messageFlow.request.message.header,
            timestamp: this.messageFlow.request.receivedAt,
            isBrokerInput: true
        });
        messageIndex++;

        // Only add message to responder if not NO_RESPONDERS and no internal error
        if (this.messageFlow.response?.fromBroker === false) {//!isNoResponders && !isInternalError) {
            const message = {
                from: 'message-broker',
                to: this.messageFlow.response!.target!.serviceId!,
                header: {
                    ...this.messageFlow.request.message.header,
                    requestId: this.messageFlow.response?.message?.header?.requestId
                },
                isBrokerInput: false
            };
            delete message.header.parentRequestId;
            messages.push(message);
            messageIndex++;

            // Add messages to auditors after forwarding to responder
            for (const serviceId of this.messageFlow.auditors || []) {
                const msgY = messageStartY + messageIndex * messageSpacing;

                // Track Y position for this service
                if (!serviceMessageYPositions.has(serviceId)) {
                    serviceMessageYPositions.set(serviceId, []);
                }
                serviceMessageYPositions.get(serviceId)?.push(msgY);

                messages.push({
                    from: 'message-broker',
                    to: serviceId,
                    header: this.messageFlow.request.message.header,
                    isBrokerInput: false
                });
                messageIndex++;
            }
        }

        // Add response messages if exists
        if (this.messageFlow.response?.message) {
            const status = this.messageFlow.response.message.payload?.['error']?.code ?? 'SUCCESS';
            const isFromBroker = this.messageFlow.response.fromBroker;

            if (!isFromBroker) {
                // Add response from target to broker
                messages.push({
                    from: this.messageFlow.response.target!.serviceId!,
                    to: 'message-broker',
                    header: this.messageFlow.response.message.header,
                    status,
                    isBrokerInput: true
                });
            }

            // Add response from broker to originator
            messages.push({
                from: 'message-broker',
                to: this.messageFlow.request.serviceId,
                header: {
                    ...this.messageFlow.response!.message.header,
                    requestId: this.messageFlow.request.message.header.requestId
                },
                timestamp: this.messageFlow.response?.sentAt,
                status,
                isBrokerInput: false
            });
            messageIndex += isFromBroker ? 1 : 2;
        }

        // Add related messages
        for (const msg of this.messageFlow.childMessages || []) {
            // If targetId is set, we need to add the node to the left side of the diagram:
            if (msg.serviceId !== targetId && msg.serviceId !== timeoutTargetId) {
                const msgY = messageStartY + messageIndex * messageSpacing;

                // Track Y position for this service
                if (!serviceMessageYPositions.has(msg.serviceId)) {
                    serviceMessageYPositions.set(msg.serviceId, []);
                }
                serviceMessageYPositions.get(msg.serviceId)?.push(msgY);
            }
            messages.push({
                from: msg.serviceId,
                to: 'message-broker',
                header: msg.header,
                isBrokerInput: true
            });
            messageIndex++;

            // Add messages from broker to each target
            /*for (const targetId of msg.targetServiceIds || []) {
                const msgY = messageStartY + messageIndex * messageSpacing;

                // Track Y position for this service
                if (!serviceMessageYPositions.has(targetId)) {
                    serviceMessageYPositions.set(targetId, []);
                }
                serviceMessageYPositions.get(targetId)?.push(msgY);

                messages.push({
                    from: 'message-broker',
                    to: targetId,
                    header: msg.header,
                    isBrokerInput: false
                });
                messageIndex++;
            }*/
        }

        // Add parent message Y position if it exists
        if (this.messageFlow.parentMessage) {
            const msgY = messageStartY + 0 * messageSpacing; // First message
            nodes.push({
                id: `${this.messageFlow.parentMessage.serviceId}-${msgY}`,
                label: this.messageFlow.parentMessage.serviceId,
                type: 'parent',
                x: leftServicesX + boxWidth/2,
                y: msgY - 12 + topPadding
            });
        }

        if (serviceMessageYPositions.size) {
            if (!addedResponderWidth) {
                baseWidth += serviceSpacing + boxWidth / 2;
            } else if (!addedRightWidth) {
                baseWidth += boxWidth;
            }
        }

        // Add side services for each message position
        for (const [serviceId, yPositions] of serviceMessageYPositions.entries()) {
            for (const y of yPositions) {
                nodes.push({
                    id: `${serviceId}-${y}`, // Make ID unique for each instance
                    label: serviceId,
                    type: 'auditor',
                    x: sideServicesX,
                    y: y - 12 + topPadding
                });
            }
        }

        this.flowData = { nodes, messages };

        // Calculate dimensions including padding
        const maxY = Math.max(...nodes.map(n => n.y)) + messageSpacing;
        const diagramHeight = Math.max(messageSpacing, messageStartY + messages.length * messageSpacing + topPadding);

        // Set final width and height
        this.width = baseWidth;
        this.height = Math.max(diagramHeight, maxY);
    }

    getNodeX(nodeId: string): number {
        // Strip the Y position suffix for side services when looking up nodes
        const baseNodeId = nodeId.split('-')[0];
        const node = this.flowData?.nodes.find(n => n.id.startsWith(nodeId));
        if (!node) return 0;

        // If this is a side service and we're getting the x for an arrow endpoint,
        // adjust by half the box width
        if (node.type === 'auditor' || node.type === 'child') {
            return node.x - 50; // Half of boxWidth
        } else if (node.type === 'parent') {
            return node.x + 50; // Half of boxWidth
        }
        return node.x;
    }

    getArrowPath(fromX: number, toX: number, y: number): string {
        const direction = fromX < toX ? 1 : -1;
        const arrowSize = 6;
        const tipX = toX - (10 * direction);

        return `M ${tipX},${y - arrowSize}
                L ${toX},${y}
                L ${tipX},${y + arrowSize}
                Z`;
    }

    getMessageTooltip(msg: FlowMessage): string {
        const parts = [
            `From: ${this.getServiceName(msg.from)}`,
            `To: ${this.getServiceName(msg.to)}`,
        ];

        if (msg.timestamp) {
            parts.push(`Time: ${msg.timestamp.toLocaleTimeString()}`);
        }

        if (msg.status) {
            parts.push(`Status: ${msg.status}`);
        }

        // Add header info if available
        const header = msg.header;
        if (header) {
            parts.push('', 'Header:');
            Object.entries(header).forEach(([key, value]) => {
                parts.push(`  ${key}: ${value}`);
            });
        }

        if (this.isMessageClickable(msg)) {
            parts.push('', 'Click to view details.');
        }

        return parts.join('\n');
    }

    isMessageClickable(msg: FlowMessage): boolean {
        const header = msg.header;
        return !!header?.requestId && msg.from !== 'message-broker' && header.requestId !== this.messageFlow.request.message.header.requestId;
    }

    onMessageClick(msg: FlowMessage): void {
        const header = msg.header;
        if (header?.requestId && header.requestId !== this.messageFlow.request.message.header.requestId) {
            this.messageSelect.emit(header.requestId);
        }
    }

    getStatusIcon(status: string): string {
        switch (status) {
            case 'SUCCESS': return 'check_circle';
            case 'NO_RESPONDERS':
            case 'SERVICE_UNAVAILABLE': return 'unpublished';
            case 'REQUEST_TIMEOUT': return 'timer_off';
            default: return 'cancel';
        }
    }

    getStatusColor(code: string): string {
        switch (code) {
            case 'SUCCESS': return 'success';
            case 'NO_RESPONDERS':
            case 'SERVICE_UNAVAILABLE': return 'dropped';
            case 'REQUEST_TIMEOUT': return 'timeout';
            default: return 'error';
        }
    }

    getStatusText(code: string): string {
        switch (code) {
            case 'SUCCESS': return 'Success';
            case 'NO_RESPONDERS':
            case 'SERVICE_UNAVAILABLE': return 'Dropped';
            case 'REQUEST_TIMEOUT': return 'Timeout';
            default: return 'Error';
        }
    }

    getServiceName(serviceId: string): string {
        if (serviceId === 'message-broker') {
            return 'Message Broker';
        }
        return this.servicesService.getService(serviceId)?.name || serviceId;
    }
}