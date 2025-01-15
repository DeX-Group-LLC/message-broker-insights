import { Component, Input, OnChanges, SimpleChanges, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';

interface FlowNode {
    id: string;
    label: string;
    type: 'originator' | 'responder' | 'listener' | 'broker';
    x: number;
    y: number;
}

interface FlowMessage {
    from: string;
    to: string;
    label: string;
    type: 'request' | 'response' | 'publish';
    timestamp?: Date;
    status?: 'success' | 'error' | 'dropped' | 'timeout';
    isBrokerInput?: boolean;  // True if message is going to broker
}

interface FlowData {
    nodes: FlowNode[];
    messages: FlowMessage[];
}

interface RelatedMessage {
    type: 'Publish' | 'Request';
    topic: string;
    originatorServiceId: string;
    responderServiceIds?: string[];  // For Publish type
    responderServiceId?: string;     // For Request type
    status: 'success' | 'error' | 'dropped' | 'timeout';
    requestId?: string;              // For Request type
}

interface Listener {
    serviceId: string;
    topic: string;
}

@Component({
    selector: 'app-flow-diagram',
    standalone: true,
    imports: [CommonModule, MatTooltipModule],
    schemas: [NO_ERRORS_SCHEMA],
    templateUrl: './flow-diagram.component.html',
    styleUrls: ['./flow-diagram.component.scss']
})
export class FlowDiagramComponent implements OnChanges {
    @Input() messageFlow: any;

    width = 800;
    height = 400;
    flowData: FlowData | null = null;

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['messageFlow']) {
            this.buildFlowData();
        }
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
        const sideServicesX = serviceSpacing *4;

        // Track first message Y position for each service
        const serviceFirstMessageY = new Map<string, number>();

        // Add core services with top padding
        nodes.push({
            id: this.messageFlow.originatorServiceId,
            label: this.messageFlow.originatorServiceId,
            type: 'originator',
            x: horizontalPadding + boxWidth/2,
            y: topPadding
        });

        nodes.push({
            id: 'message-broker',
            label: 'Message Broker',
            type: 'broker',
            x: horizontalPadding + boxWidth/2 + serviceSpacing,
            y: topPadding
        });

        // Only add responder node if it exists and is needed
        const isInternalError = this.messageFlow.error?.code === 'INTERNAL_ERROR';
        const isNoResponders = this.messageFlow.error?.code === 'NO_RESPONDERS';
        if (this.messageFlow.responderServiceId && !isNoResponders) {
            nodes.push({
                id: this.messageFlow.responderServiceId,
                label: this.messageFlow.responderServiceId,
                type: 'responder',
                x: horizontalPadding + boxWidth/2 + serviceSpacing * 2,
                y: topPadding
            });
        }

        // Calculate base width without listeners
        let baseWidth = horizontalPadding * 2 + boxWidth + serviceSpacing * (nodes.length - 1);

        // Add listeners if they exist
        if (this.messageFlow.listeners?.length) {
            // Add extra space for listeners column
            baseWidth += serviceSpacing + horizontalPadding;
        }

        // Set final width
        this.width = baseWidth;

        let messageIndex = 0;

        // Add request messages
        messages.push({
            from: this.messageFlow.originatorServiceId,
            to: 'message-broker',
            label: this.messageFlow.topic,
            type: 'request',
            timestamp: this.messageFlow.receivedAt,
            isBrokerInput: true
        });

        // Only add message to responder if not NO_RESPONDERS and no internal error
        if (!isNoResponders && !isInternalError) {
            messages.push({
                from: 'message-broker',
                to: this.messageFlow.responderServiceId,
                label: this.messageFlow.topic,
                type: 'request',
                timestamp: new Date(this.messageFlow.receivedAt.getTime() + this.messageFlow.brokerProcessingTime),
                isBrokerInput: false
            });
            messageIndex++;
        }
        messageIndex++;

        // Add response messages if exists or timeout/dropped/internal error response
        if (this.messageFlow.status === 'timeout') {
            // For timeout, add response from broker to originator
            messages.push({
                from: 'message-broker',
                to: this.messageFlow.originatorServiceId,
                label: this.messageFlow.topic,
                type: 'response',
                timestamp: new Date(this.messageFlow.receivedAt.getTime() + this.messageFlow.timeout),
                status: 'timeout',
                isBrokerInput: false
            });
            messageIndex++;
        } else if (this.messageFlow.status === 'dropped' || isInternalError) {
            // For dropped/internal error, add response from broker to originator
            messages.push({
                from: 'message-broker',
                to: this.messageFlow.originatorServiceId,
                label: this.messageFlow.topic,
                type: 'response',
                timestamp: this.messageFlow.completedAt,
                status: isInternalError ? 'error' : 'dropped',
                isBrokerInput: false
            });
            messageIndex++;
        } else if (this.messageFlow.response) {
            messages.push({
                from: this.messageFlow.responderServiceId,
                to: 'message-broker',
                label: this.messageFlow.topic,
                type: 'response',
                timestamp: new Date(this.messageFlow.completedAt.getTime() - this.messageFlow.brokerProcessingTime),
                status: this.messageFlow.status,
                isBrokerInput: true
            });
            messages.push({
                from: 'message-broker',
                to: this.messageFlow.originatorServiceId,
                label: this.messageFlow.topic,
                type: 'response',
                timestamp: this.messageFlow.completedAt,
                status: this.messageFlow.status,
                isBrokerInput: false
            });
            messageIndex += 2;
        }

        // Add related messages
        this.messageFlow.relatedMessages?.forEach((msg: RelatedMessage) => {
            const currentY = messageStartY + messageIndex * messageSpacing;

            if (msg.type === 'Publish') {
                // Add message to broker
                messages.push({
                    from: msg.originatorServiceId,
                    to: 'message-broker',
                    label: msg.topic,
                    type: 'publish',
                    timestamp: this.messageFlow.completedAt,
                    status: msg.status,
                    isBrokerInput: true
                });
                messageIndex++;

                // Add messages from broker to each responder
                msg.responderServiceIds?.forEach((responder: string) => {
                    const msgY = messageStartY + messageIndex * messageSpacing;
                    // Track first message Y for each service
                    if (!serviceFirstMessageY.has(responder)) {
                        serviceFirstMessageY.set(responder, msgY);
                    }

                    messages.push({
                        from: 'message-broker',
                        to: responder,
                        label: msg.topic,
                        type: 'publish',
                        timestamp: this.messageFlow.completedAt,
                        status: msg.status,
                        isBrokerInput: false
                    });
                    messageIndex++;
                });
            } else {
                // For request type, track the Y position when the message is going TO the service
                const toServiceY = messageStartY + (messageIndex + 1) * messageSpacing; // +1 to get the second message Y
                if (msg.responderServiceId && !serviceFirstMessageY.has(msg.responderServiceId)) {
                    serviceFirstMessageY.set(msg.responderServiceId, toServiceY);
                }

                messages.push({
                    from: msg.originatorServiceId,
                    to: 'message-broker',
                    label: msg.topic,
                    type: 'request',
                    timestamp: this.messageFlow.completedAt,
                    status: msg.status,
                    isBrokerInput: true
                });
                messages.push({
                    from: 'message-broker',
                    to: msg.responderServiceId!,
                    label: msg.topic,
                    type: 'request',
                    timestamp: this.messageFlow.completedAt,
                    status: msg.status,
                    isBrokerInput: false
                });
                messageIndex += 2;
            }
        });

        // Add side services at their first message position
        serviceFirstMessageY.forEach((y, serviceId) => {
            nodes.push({
                id: serviceId,
                label: serviceId,
                type: 'listener',
                x: sideServicesX,
                y: y - 12 + topPadding
            });
        });

        this.flowData = { nodes, messages };

        // Calculate dimensions including padding
        const maxY = Math.max(...nodes.map(n => n.y)) + messageSpacing;
        const diagramHeight = Math.max(messageSpacing, messageStartY + messages.length * messageSpacing + topPadding);
        this.height = Math.max(diagramHeight, maxY);
    }

    getNodeX(nodeId: string): number {
        const node = this.flowData?.nodes.find(n => n.id === nodeId);
        if (!node) return 0;

        // If this is a side service and we're getting the x for an arrow endpoint,
        // adjust by half the box width
        if (node.type === 'listener') {
            return node.x - 50; // Half of boxWidth
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
            `Type: ${msg.type}`,
            `From: ${msg.from}`,
            `To: ${msg.to}`,
            `Topic: ${msg.label}`,
            `Time: ${msg.timestamp ? msg.timestamp.toLocaleTimeString() : 'N/A'}`,
        ];

        if (msg.status) {
            parts.push(`Status: ${msg.status}`);
        }

        // Add header info if available
        const header = this.getMessageHeader(msg);
        if (header) {
            parts.push('', 'Header:');
            Object.entries(header).forEach(([key, value]) => {
                parts.push(`  ${key}: ${value}`);
            });
        }

        return parts.join('\n');
    }

    private getMessageHeader(msg: FlowMessage): Record<string, any> | null {
        if (!this.messageFlow) return null;

        // For the main request/response flow
        if (msg.from === this.messageFlow.originatorServiceId && msg.to === 'message-broker') {
            return this.messageFlow.header;
        }
        if (msg.from === 'message-broker' && msg.to === this.messageFlow.responderServiceId) {
            return this.messageFlow.header;
        }
        if (msg.from === this.messageFlow.responderServiceId && msg.to === 'message-broker' && this.messageFlow.response) {
            return this.messageFlow.response.header;
        }
        if (msg.from === 'message-broker' && msg.to === this.messageFlow.originatorServiceId && this.messageFlow.response) {
            return this.messageFlow.response.header;
        }

        // For related messages
        const relatedMsg = this.messageFlow.relatedMessages?.find((rm: any) => {
            if (rm.type === 'Publish') {
                return rm.topic === msg.label &&
                    ((msg.isBrokerInput && rm.originatorServiceId === msg.from) ||
                     (!msg.isBrokerInput && rm.responderServiceIds?.includes(msg.to)));
            } else {
                return rm.topic === msg.label &&
                    ((msg.isBrokerInput && rm.originatorServiceId === msg.from) ||
                     (!msg.isBrokerInput && rm.responderServiceId === msg.to));
            }
        });

        if (relatedMsg) {
            return {
                type: relatedMsg.type,
                topic: relatedMsg.topic,
                requestId: relatedMsg.requestId,
                status: relatedMsg.status
            };
        }

        return null;
    }
}