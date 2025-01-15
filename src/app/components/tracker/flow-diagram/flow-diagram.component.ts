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
    timestamp: Date;
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
    template: `
        <div class="diagram-container">
            <svg #svgContainer [attr.width]="width" [attr.height]="height" class="flow-diagram"
                [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="xMidYMid meet">
                <!-- Definitions for symbols -->
                <defs>
                    <!-- Error symbol (X) -->
                    <symbol id="error-symbol" viewBox="-6 -6 12 12">
                        <path d="M-4,-4 L4,4 M-4,4 L4,-4"
                            stroke="currentColor"
                            stroke-width="2"
                            fill="none"/>
                    </symbol>
                    <!-- Timeout symbol (clock) -->
                    <symbol id="timeout-symbol" viewBox="-6 -6 12 12">
                        <circle r="5"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"/>
                        <path d="M0,-3 L0,0 L2,2"
                            stroke="currentColor"
                            stroke-width="1.5"
                            fill="none"/>
                    </symbol>
                    <!-- Dropped symbol (stop) -->
                    <symbol id="dropped-symbol" viewBox="-6 -6 12 12">
                        <rect x="-4" y="-4" width="8" height="8"
                            stroke="currentColor"
                            stroke-width="1.5"
                            fill="none"/>
                        <line x1="-2" y1="-2" x2="2" y2="2"
                            stroke="currentColor"
                            stroke-width="1.5"/>
                        <line x1="-2" y1="2" x2="2" y2="-2"
                            stroke="currentColor"
                            stroke-width="1.5"/>
                    </symbol>
                </defs>

                <!-- Lifelines first (bottom layer) -->
                <ng-container *ngFor="let node of flowData?.nodes">
                    <line *ngIf="node.type !== 'listener'"
                        [attr.x1]="node.x" [attr.y1]="node.y + 24" [attr.x2]="node.x" [attr.y2]="height - 10"
                        class="lifeline" />
                </ng-container>

                <!-- Messages next (middle layer) -->
                <ng-container *ngFor="let msg of flowData?.messages; let i = index">
                    <g [attr.transform]="'translate(0,' + (60 + i * 30 + 16) + ')'"
                       [matTooltip]="getMessageTooltip(msg)"
                       [matTooltipClass]="'pre-line-tooltip'">
                        <!-- Arrow Line -->
                        <line [attr.x1]="getNodeX(msg.from)" [attr.x2]="getNodeX(msg.to)" y1="0" y2="0"
                            [class]="'message-line ' + msg.type + ' ' + (msg.status || '') + (msg.isBrokerInput ? ' isBrokerInput' : '')" />

                        <!-- Arrow Head -->
                        <path [attr.d]="getArrowPath(getNodeX(msg.from), getNodeX(msg.to), 0)"
                            [class]="'message-arrow ' + msg.type + ' ' + (msg.status || '')" />

                        <!-- Status Symbol -->
                        <g *ngIf="msg.status && msg.status !== 'success'"
                           [attr.transform]="'translate(' + getNodeX(msg.from) + ',0)'"
                           [class]="'status-symbol ' + msg.status">
                            <use [attr.href]="'#' + msg.status + '-symbol'" width="12" height="12" x="-6" y="-6"/>
                        </g>

                        <!-- Message Label -->
                        <text [attr.x]="(getNodeX(msg.from) + getNodeX(msg.to)) / 2" y="-5"
                            class="message-label">
                            {{msg.label}}
                        </text>

                        <!-- Timestamp -->
                        <text [attr.x]="(getNodeX(msg.from) + getNodeX(msg.to)) / 2" y="12"
                            class="timestamp">
                            {{msg.timestamp | date:'HH:mm:ss.SSS'}}
                        </text>
                    </g>
                </ng-container>

                <!-- Service boxes last (top layer) -->
                <ng-container *ngFor="let node of flowData?.nodes">
                    <g [class]="'service-group ' + node.type">
                        <rect [attr.x]="node.x - 50" [attr.y]="node.y" width="100" height="24" rx="4"
                            class="service-box" />
                        <text [attr.x]="node.x" [attr.y]="node.y + 12"
                            class="service-label"
                            dominant-baseline="middle"
                            text-anchor="middle">{{node.label}}</text>
                    </g>
                </ng-container>
            </svg>
        </div>
    `,
    styles: [`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            min-height: 100%;
            overflow: hidden;
        }

        .diagram-container {
            width: 100%;
            height: 100%;
            min-height: 100%;
            overflow: auto;
            padding: 20px;
            box-sizing: border-box;
        }

        .flow-diagram {
            display: block;
            width: 100%;
            height: 100%;
            min-height: 100%;
            background: var(--mat-sys-surface-container-lowest);
            border-radius: 8px;
        }

        .tab-content {
            height: 100%;
            min-height: 600px;
            display: flex;
            flex-direction: column;
        }

        .section {
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
        }

        app-flow-diagram {
            flex: 1;
            min-height: 0;
        }

        .service-group {
            .service-box {
                fill: var(--mat-sys-surface-container-high);
                stroke: var(--mat-sys-outline);
                stroke-width: 1;
            }

            .service-label {
                fill: var(--mat-sys-on-surface);
                font-size: 11px;
                font-weight: 500;
            }

            &.originator {
                .service-box {
                    stroke: var(--mat-sys-primary);
                    fill: color-mix(in srgb, var(--mat-sys-primary) 15%, var(--mat-sys-surface-container-high));
                }
            }

            &.responder {
                .service-box {
                    stroke: var(--mat-sys-secondary);
                    fill: color-mix(in srgb, var(--mat-sys-secondary) 15%, var(--mat-sys-surface-container-high));
                }
            }

            &.listener {
                .service-box {
                    stroke: var(--mat-sys-tertiary);
                    fill: color-mix(in srgb, var(--mat-sys-tertiary) 15%, var(--mat-sys-surface-container-high));
                }
            }

            &.broker {
                .service-box {
                    stroke: var(--mat-sys-outline);
                    fill: color-mix(in srgb, var(--mat-sys-outline) 15%, var(--mat-sys-surface-container-high));
                    stroke-width: 2;
                    stroke-dasharray: 2 2;
                }
            }
        }

        .lifeline {
            stroke: var(--mat-sys-outline-variant);
            stroke-width: 1;
            stroke-dasharray: 4 4;
        }

        .message-line {
            stroke-width: 2;

            &.request {
                stroke: var(--mat-sys-primary);
                &:not(.isBrokerInput) {
                    stroke-dasharray: 2 2;
                }
            }

            &.response {
                stroke: var(--mat-sys-secondary);
                &:not(.isBrokerInput) {
                    stroke-dasharray: 2 2;
                }
            }

            &.publish {
                stroke: var(--mat-sys-tertiary);
                &:not(.isBrokerInput) {
                    stroke-dasharray: 2 2;
                }
            }
        }

        .message-arrow {
            &.request {
                fill: var(--mat-sys-primary);
            }

            &.response {
                fill: var(--mat-sys-secondary);
            }

            &.publish {
                fill: var(--mat-sys-tertiary);
            }
        }

        .message-label {
            fill: var(--mat-sys-on-surface);
            text-anchor: middle;
            font-size: 11px;
            font-weight: 500;
        }

        .timestamp {
            fill: var(--mat-sys-on-surface-variant);
            text-anchor: middle;
            font-size: 10px;
        }

        .status-symbol {
            &.error {
                color: #f44336;  // error red
            }

            &.timeout, &.dropped {
                color: #ff9800;  // warning orange
            }
        }

        ::ng-deep .pre-line-tooltip {
            white-space: pre-wrap;

            > div {
                text-align: left;
                max-width: unset;
            }
        }
    `]
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
        const serviceSpacing = 200;
        const messageSpacing = 30;
        const messageStartY = 60;
        const boxWidth = 100;
        const topPadding = 16;  // 1em = 16px
        const sideServicesX = serviceSpacing * 4;

        // Track first message Y position for each service
        const serviceFirstMessageY = new Map<string, number>();

        // Add core services with top padding
        nodes.push({
            id: this.messageFlow.originatorServiceId,
            label: this.messageFlow.originatorServiceId,
            type: 'originator',
            x: serviceSpacing,
            y: topPadding
        });

        nodes.push({
            id: 'message-broker',
            label: 'Message Broker',
            type: 'broker',
            x: serviceSpacing * 2,
            y: topPadding
        });

        nodes.push({
            id: this.messageFlow.responderServiceId,
            label: this.messageFlow.responderServiceId,
            type: 'responder',
            x: serviceSpacing * 3,
            y: topPadding
        });

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
        const isInternalError = this.messageFlow.error?.code === 'INTERNAL_ERROR';
        const isNoResponders = this.messageFlow.error?.code === 'NO_RESPONDERS';
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
                y: y - 12 + topPadding  // Add padding to side services too
            });
        });

        this.flowData = { nodes, messages };

        // Calculate dimensions including padding
        const maxY = Math.max(...nodes.map(n => n.y)) + 100;
        const diagramHeight = Math.max(400, messageStartY + messages.length * messageSpacing + topPadding);
        this.height = Math.max(diagramHeight, maxY);
        this.width = serviceSpacing * 5;
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
            `Time: ${msg.timestamp.toLocaleTimeString()}`,
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