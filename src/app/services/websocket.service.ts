import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from '../utils/event-emitter';

/** Types of actions that can be sent over the WebSocket */
export enum ActionType {
    /** Publish a message to a topic */
    PUBLISH = 'publish',
    /** Request data from a topic */
    REQUEST = 'request',
    /** Response to a request */
    RESPONSE = 'response'
}

/** Structure of messages sent over the WebSocket */
export interface BrokerMessage {
    /** Type of action being performed */
    action: ActionType;
    /** Topic the message relates to */
    topic: string;
    /** Optional payload data */
    payload?: any;
    /** Optional request ID for request/response pairs */
    requestId?: string;
}

/** Possible states of the WebSocket connection */
export enum ConnectionState {
    /** Not connected to the server */
    DISCONNECTED = 'disconnected',
    /** Currently attempting to connect */
    CONNECTING = 'connecting',
    /** Successfully connected to the server */
    CONNECTED = 'connected'
}

/**
 * Service for managing WebSocket communication with the server.
 * Extends EventEmitter to provide event-based communication.
 */
@Injectable({
    providedIn: 'root'
})
export class WebsocketService extends EventEmitter {
    /** Active WebSocket connection */
    private socket: WebSocket | null = null;
    /** Map of pending requests awaiting responses */
    private pendingRequests = new Map<string, { resolve: (response: any) => void; reject: (error: any) => void }>();
    /** Current state of the WebSocket connection */
    private _state = ConnectionState.DISCONNECTED;

    /** Gets the current connection state */
    get state(): ConnectionState {
        return this._state;
    }

    /**
     * Creates an instance of WebsocketService.
     * Automatically connects to the WebSocket server.
     */
    constructor() {
        super();
        // Connect to the WebSocket server
        this.connect();
    }

    /**
     * Connects to the WebSocket server.
     * Handles reconnection and sets up event listeners.
     *
     * @param url - WebSocket server URL
     */
    connect(url: string = 'ws://localhost:3000'): void {
        if (this.socket) {
            this.socket.close();
        }

        this._state = ConnectionState.CONNECTING;
        this.emit('stateChange', this._state);

        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            this._state = ConnectionState.CONNECTED;
            this.emit('stateChange', this._state);
            this.emit('connected');
        };

        this.socket.onmessage = (event) => {
            try {
                const [header, payload] = event.data.split('\n');
                const [action, topic, version, requestId] = header.split(':');
                const message = JSON.parse(payload);

                if (action === ActionType.REQUEST && topic === 'system.heartbeat') {
                    this.send(ActionType.RESPONSE, 'system.heartbeat', { timestamp: new Date().toISOString() }, requestId);
                } else if (action === ActionType.RESPONSE && requestId) {
                    const request = this.pendingRequests.get(requestId);
                    if (request == null) return;

                    // Clean up the request
                    this.pendingRequests.delete(requestId);

                    // Resolve the request
                    if (message.error) {
                        request.reject(message);
                    } else {
                        request.resolve(message);
                    }
                }

                // Emit the message
                this.emit(header, message);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

        this.socket.onclose = () => {
            console.log('WebSocket connection closed');
            this._state = ConnectionState.DISCONNECTED;
            this.emit('stateChange', this._state);
            this.emit('disconnected');
            // Attempt to reconnect after 5 seconds
            setTimeout(() => this.connect(url), 5000);
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.emit('error', error);
        };
    }

    /**
     * Sends a message over the WebSocket connection.
     *
     * @param action - Type of action to perform
     * @param topic - Topic to send the message to
     * @param payload - Data to send
     * @param requestId - Optional request ID for request/response pairs
     */
    private async send(action: ActionType, topic: string, payload: Object = {}, requestId?: string): Promise<void> {
        await this.waitForReady();
        // Serialize the header:
        let header = `${action}:${topic}:1.0.0`;
        if (requestId) header += `:${requestId}`;
        // Serialize the payload:
        let payloadString = JSON.stringify(payload);
        // Serialize and send the message:
        this.socket!.send(`${header}\n${payloadString}`);
    }

    /**
     * Makes a request to the server and waits for a response.
     *
     * @param topic - Topic to request data from
     * @param payload - Data to send with the request
     * @param timeout - Optional timeout in milliseconds
     * @returns Promise that resolves with the response
     */
    async request(topic: string, payload: Object = {}, timeout?: number): Promise<any> {
        return await new Promise((resolve, reject) => {
            const requestId = uuidv4();
            if (timeout) (payload as any).timeout = timeout;
            this.send(ActionType.REQUEST, topic, payload, requestId);
            this.pendingRequests.set(requestId, { resolve, reject });
        });
    }

    /**
     * Disconnects from the WebSocket server.
     * Cleans up the connection and emits events.
     */
    disconnect(): void {
        if (this.socket) {
            // Socket closure should auto unsubscribe from all topics
            this.socket.close();
            this.socket = null;
            this._state = ConnectionState.DISCONNECTED;
            this.emit('stateChange', this._state);
            this.emit('disconnected');
        }
    }

    /**
     * Waits for the WebSocket connection to be ready.
     *
     * @returns Promise that resolves when connected
     */
    async waitForReady(): Promise<void> {
        if (this._state === ConnectionState.CONNECTED) return;

        return new Promise<void>(resolve => {
            this.once('connected', resolve);
        });
    }
}
