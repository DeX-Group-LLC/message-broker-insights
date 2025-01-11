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
    /** Successfully connected to the server */
    CONNECTED = 'connected',
    /** Currently attempting to connect (first time) */
    CONNECTING = 'connecting',
    /** Attempting to reconnect after disconnection */
    RECONNECTING = 'reconnecting',
    /** Not connected to the server */
    DISCONNECTED = 'disconnected'
}

/** Connection event types */
export enum ConnectionEventType {
    /** Connection established successfully */
    CONNECTED = 'connected',
    /** Initial connection attempt */
    CONNECTING = 'connecting',
    /** Attempting to reconnect */
    RECONNECTING = 'reconnecting',
    /** Connection lost */
    DISCONNECTED = 'disconnected',
    /** Error occurred */
    ERROR = 'error'
}

/** Structure of connection events */
export interface ConnectionEvent {
    /** Type of event */
    type: ConnectionEventType;
    /** Timestamp of the event */
    timestamp: Date;
    /** Optional error message */
    error?: string;
    /** Optional attempt number for reconnection events */
    attempt?: number;
}

/** Connection details */
export interface ConnectionDetails {
    /** Current connection state */
    state: ConnectionState;
    /** URL of the WebSocket server */
    url: string;
    /** Time of last successful connection */
    lastConnected?: Date;
    /** Number of reconnection attempts */
    reconnectAttempts: number;
    /** Latest connection latency in ms */
    latency?: number;
    /** Recent connection events */
    recentEvents: ConnectionEvent[];
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
    /** URL of the WebSocket server */
    private _url = 'ws://localhost:3000';
    /** Time of last successful connection */
    private _lastConnected?: Date;
    /** Number of reconnection attempts */
    private _reconnectAttempts = 0;
    /** Latest connection latency */
    private _latency?: number;
    /** Recent connection events */
    private _recentEvents: ConnectionEvent[] = [];
    /** Maximum number of recent events to keep */
    private readonly MAX_RECENT_EVENTS = 50;
    /** Heartbeat interval timer */
    private heartbeatInterval?: number;
    /** Heartbeat interval in milliseconds */
    private readonly HEARTBEAT_INTERVAL = 10000;
    /** Whether this is the first connection attempt */
    private isFirstConnection = true;
    /** Timeout for auto-reconnection */
    private reconnectTimeout?: number;
    /** Reconnection delay in milliseconds */
    private readonly RECONNECT_DELAY = 5000;
    /** Whether to suppress automatic reconnection */
    private suppressReconnect = false;

    /** Gets the current connection state */
    get state(): ConnectionState {
        return this._state;
    }

    /** Gets the current connection details */
    get details(): ConnectionDetails {
        return {
            state: this._state,
            url: this._url,
            lastConnected: this._lastConnected,
            reconnectAttempts: this._reconnectAttempts,
            latency: this._latency,
            recentEvents: [...this._recentEvents]
        };
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
     * Adds a connection event to the recent events list.
     *
     * @param type - Type of event
     * @param error - Optional error message
     */
    private addEvent(type: ConnectionEventType, error?: string): void {
        const event: ConnectionEvent = {
            type,
            timestamp: new Date(),
            error,
            attempt: type === ConnectionEventType.RECONNECTING ? this._reconnectAttempts : undefined
        };

        this._recentEvents.unshift(event);
        if (this._recentEvents.length > this.MAX_RECENT_EVENTS) {
            this._recentEvents.pop();
        }

        this.emit('connectionEvent', event);
    }

    /**
     * Starts the heartbeat interval.
     */
    private startHeartbeat(): void {
        this.stopHeartbeat();

        // Send immediate heartbeat to get early latency info
        this.sendHeartbeat();

        this.heartbeatInterval = window.setInterval(() => this.sendHeartbeat(), this.HEARTBEAT_INTERVAL);
    }

    /**
     * Sends a single heartbeat and updates latency.
     */
    private async sendHeartbeat(): Promise<void> {
        try {
            const start = new Date().getTime();
            await this.request('system.heartbeat');
            this._latency = new Date().getTime() - start;
            this.emit('latencyUpdate', this._latency);
        } catch (error) {
            console.error('Heartbeat failed:', error);
        }
    }

    /**
     * Stops the heartbeat interval.
     */
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = undefined;
        }
    }

    /**
     * Stops any pending reconnection attempt.
     */
    private stopReconnectTimeout(): void {
        if (this.reconnectTimeout) {
            window.clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = undefined;
        }
    }

    /**
     * Connects to the WebSocket server.
     * Handles reconnection and sets up event listeners.
     *
     * @param url - WebSocket server URL
     */
    connect(url: string = this._url): void {
        // Stop any pending reconnection
        this.stopReconnectTimeout();

        if (this.socket) {
            // Suppress reconnection when manually closing
            this.suppressReconnect = true;
            this.socket.close();
            // Wait for the close event to complete before continuing
            setTimeout(() => {
                this.suppressReconnect = false;
                this.initializeConnection(url);
            }, 0);
        } else {
            this.initializeConnection(url);
        }
    }

    /**
     * Initializes a new WebSocket connection.
     *
     * @param url - WebSocket server URL
     */
    private initializeConnection(url: string): void {
        this._url = url;
        this._state = ConnectionState.CONNECTING;

        if (this.isFirstConnection) {
            // This is the first connection attempt
            this.isFirstConnection = false;
            this.addEvent(ConnectionEventType.CONNECTING);
        } else {
            // Only increment reconnection attempts if this isn't the first connection
            this._reconnectAttempts++;
            this._state = ConnectionState.RECONNECTING;
            this.addEvent(ConnectionEventType.RECONNECTING);
        }

        this.emit('stateChange', this._state);
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            this._state = ConnectionState.CONNECTED;
            this._lastConnected = new Date();
            this._reconnectAttempts = 0;
            this.addEvent(ConnectionEventType.CONNECTED);
            this.emit('stateChange', this._state);
            this.emit('connected');
            this.startHeartbeat();
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
                this.addEvent(ConnectionEventType.ERROR, error instanceof Error ? error.message : String(error));
            }
        };

        this.socket.onclose = () => {
            console.log('WebSocket connection closed');
            this._state = ConnectionState.DISCONNECTED;
            this.addEvent(ConnectionEventType.DISCONNECTED);
            this.emit('stateChange', this._state);
            this.emit('disconnected');
            this.stopHeartbeat();

            // Only attempt to reconnect if not suppressed
            if (!this.suppressReconnect) {
                this.reconnectTimeout = window.setTimeout(() => this.connect(url), this.RECONNECT_DELAY);
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.addEvent(ConnectionEventType.ERROR, error instanceof Error ? error.message : 'Unknown error');
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
