import { Injectable, OnDestroy } from '@angular/core';
import { ActionType, BrokerHeader, ClientHeader, Message, MessageHeader, MessagePayload, WebsocketService } from './websocket.service';
import { SingleEmitter } from '../utils/single-emitter';
import { BehaviorSubject } from 'rxjs';

/** Structure of a related message in a flow */
export interface RelatedMessage {
    /** The service ID that sent/received the message */
    serviceId: string;
    /** The message header */
    header: ClientHeader;
    /** The maskedId of the message */
    maskedId?: string;
    /** Target service IDs */
    //targetServiceIds?: string[];
}

/** Structure of a message flow in the system */
export interface MessageFlow {
    /** Optional list of service IDs that receive a copy of the message */
    auditors?: string[];
    /** The request part of the flow */
    request: {
        /** The service ID that sent the request */
        serviceId: string;
        /** The message */
        message: Message;
        /** The timeout in milliseconds */
        timeout: number;
        /** When the broker received the request */
        receivedAt: Date;
    };
    /** The response part of the flow */
    response?: {
        /** When the response was sent back to the originator */
        sentAt?: Date,
        /** The target service that should respond */
        target?: {
            /** The service ID that should respond */
            serviceId: string;
            /** The priority of the service */
            priority: number;
        };
        /** Whether the response came from the broker */
        fromBroker?: boolean;
        /** The response message */
        message?: Message;
    };
    /** The parent message in the flow */
    parentMessage?: RelatedMessage;
    /** Child messages in the flow */
    childMessages?: RelatedMessage[];
}

/**
 * Service responsible for tracking message flows in the system.
 * Subscribes to system.message and builds traceable message flows.
 */
@Injectable({
    providedIn: 'root'
})
export class TrackerService implements OnDestroy {
    /** Maximum number of requests to store */
    readonly MAX_REQUESTS = 10000;

    /** Map of requestId to message flow */
    private flowMap = new Map<string, MessageFlow>();

    /** Map of maskedId to requestId */
    private flowMapMasked = new Map<string, string>();

    /** Queue of MessageFlows for maintaining size limit */
    private flowQueue: MessageFlow[] = [];

    /** Subject holding the current services */
    private flowsSubject = new BehaviorSubject<MessageFlow[]>([]);
    /** Observable of all message flows */
    public flows$ = this.flowsSubject.asObservable();

    /** Single emitter for new message flows */
    public data$ = new SingleEmitter<(message: MessageFlow) => void>(1000);

    constructor(private websocketService: WebsocketService) {
        this.websocketService.waitForReady().then(this._initialize);
    }

    ngOnDestroy() {
        this.cleanup();
    }

    get flows(): MessageFlow[] {
        return this.flowQueue;
    }

    /**
     * Initializes the tracker service by subscribing to system.message
     */
    private async initialize(): Promise<void> {
        await this.websocketService.waitForReady();
        this.websocketService.connected$.on(this._initialize);
        try {
            // Subscribe to all message types for system.message topic
            this.websocketService.subscribe(ActionType.PUBLISH, 'system.message', 0, this._handleMessage);
        } catch (error) {
            console.error('Failed to initialize tracker:', error);
        }
    }
    private _initialize = this.initialize.bind(this);

    /**
     * Handles incoming system.message messages
     * @param message - The received message
     */
    private handleMessage(_: MessageHeader, payload: MessagePayload): void {
        const message = payload as MessageAudit;
        const requestId = message.message.header.requestId;
        if (!requestId) return;

        // How to determine what type of message it is?
        // If it has a from, it is a client message
        // If it has a to, it is a broker message
        // If it isn't a RESPONSE and it has a from, it is the initial request, use it to create a new flow
        // If it is a RESPONSE and it has a from, it is the initial response, use it to update the flow's response for target and message. Lookup the maskedId to find the original requestId.
        // If it is a RESPONSE and it has a to, it is the final response, use it to update the flow's response for just the message. If no response yet, then mark `fromBroker` to true.
        // All other cases are ignored.
        let flow: MessageFlow | undefined;
        if ('from' in message) {
            const clientMessage = message as ClientMessageAudit;
            if (clientMessage.message.header.action !== ActionType.RESPONSE) {
                // Initial request
                flow = this.flowMap.get(requestId);
                if (!flow) {
                    flow = {
                        request: {
                            receivedAt: new Date(clientMessage.timestamp),
                            serviceId: clientMessage.from,
                            timeout: clientMessage.timeout,
                            message: clientMessage.message
                        }
                    };
                    this.flowMap.set(requestId, flow);
                    this.flowQueue.push(flow);

                    // Check if too many flows
                    if (this.flowQueue.length > this.MAX_REQUESTS) {
                        const oldestFlow = this.flowQueue.shift()!;
                        this.flowMap.delete(oldestFlow.request.message.header.requestId!);
                        this.flowMapMasked.delete(oldestFlow.request.message.header.requestId!);
                    }

                    // Check if the flow has a parent
                    const parentRequestId = clientMessage.message.header.parentRequestId;
                    if (parentRequestId) {
                        /*console.log('parentRequestId', parentRequestId);
                        const parentFlow = this.flowMap.get(parentRequestId);
                        if (parentFlow) {
                            parentFlow.childMessages ??= [];
                            parentFlow.childMessages.push({
                                serviceId: flow.request.serviceId,
                                header: flow.request.message.header
                            });
                        }*/

                        // Add to childMessages if requestId matches a maskedId
                        const maskedFlow = this.flowMapMasked.get(parentRequestId);
                        if (maskedFlow) {
                            const parentFlow = this.flowMap.get(maskedFlow);
                            if (parentFlow) {
                                parentFlow.childMessages ??= [];
                                parentFlow.childMessages.push({
                                    serviceId: clientMessage.from,
                                    header: flow.request.message.header
                                });

                                // Add parent to this flow
                                flow.parentMessage = {
                                    serviceId: parentFlow.request.serviceId,
                                    header: parentFlow.request.message.header
                                };
                            }
                        }
                    }
                }
            } else {
                // Lookup the original requestId from the maskedId
                const originalRequestId = this.flowMapMasked.get(requestId);
                if (!originalRequestId) return; // TODO: Should we handle this case?
                // Initial request
                flow = this.flowMap.get(originalRequestId);
                if (!flow) return; // TODO: Should we handle this case?
                // Response
                flow.response = {
                    sentAt: new Date(clientMessage.timestamp),
                    fromBroker: false,
                    target: {
                        serviceId: clientMessage.from,
                        priority: 0
                    },
                    message: clientMessage.message
                };
            }
        } else {
            // Broker message
            const brokerMessage = message as BrokerMessageAudit;

            if (brokerMessage.message.header.action !== ActionType.RESPONSE) {
                if (brokerMessage.maskedId) {
                    // Add the maskedId to the flowMapMasked
                    this.flowMapMasked.set(requestId, brokerMessage.maskedId);
                }
            } else {
                // Lookup the original requestId from the maskedId
                const originalRequestId = this.flowMapMasked.get(requestId) ?? requestId;
                //if (!originalRequestId) return; // TODO: Should we handle this case?
                // Initial request
                flow = this.flowMap.get(originalRequestId);
                if (flow) {
                    // Flow exists, update the response
                    if (!flow.response) flow.response = { fromBroker: true, target: { serviceId: 'message-broker', priority: Number.MAX_VALUE }, message: brokerMessage.message };
                    flow.response.sentAt = new Date(brokerMessage.timestamp);
                    //flow.response.message = brokerMessage.message;
                }
            }
        }

        // Emit the flow
        if (flow) {
            this.data$.emit(flow);
            this.flowsSubject.next(this.flows);
        }
    }
    private _handleMessage = this.handleMessage.bind(this);

    /**
     * Gets all message flows
     * @returns All message flows
     */
    public getFlows(): MessageFlow[] {
        return Array.from(this.flows.values());
    }

    /**
     * Gets a message flow by its request ID
     * @param requestId - The request ID to look up
     * @returns The message flow or undefined if not found
     */
    public getFlow(requestId: string): MessageFlow | undefined {
        return this.flowMap.get(requestId);
    }

    /**
     * Cleans up resources
     */
    private cleanup(): void {
        this.data$.clear();
        this.websocketService.connected$.off(this._initialize);
        this.websocketService.unsubscribe(ActionType.PUBLISH, 'system.message');
        this.flowMap.clear();
        this.flowMapMasked.clear();
        this.flowQueue = [];
    }
}

/**
 * The header for a message audit when the broker sends a message to a client.
 */
interface BrokerMessageAudit {
    /** The timestamp of when the message was sent */
    timestamp: string;
    /** The service id of the client */
    to: string;
    /** The original header of the message */
    message: Message;
    /** The response id that the broker overwrote */
    maskedId?: string;
}

/**
 * The header for a message audit when the broker receives a message from a client.
 */
interface ClientMessageAudit {
    /** The timestamp of when the message was received */
    timestamp: string;
    /** The service id of the client */
    from: string;
    /** The original message */
    message: Message;
    /** The timeout for the request */
    timeout: number;
}

type MessageAudit = BrokerMessageAudit | ClientMessageAudit;