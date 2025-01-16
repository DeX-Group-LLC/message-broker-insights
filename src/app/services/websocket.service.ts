import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from '../utils/event-emitter';
import { SingleEmitter } from '../utils/single-emitter';
import { MultiEmitter } from '../utils/multi-emitter';

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
    CONNECTED = 'Connected',
    /** Initial connection attempt */
    CONNECTING = 'Connecting',
    /** Attempting to reconnect */
    RECONNECTING = 'Reconnecting',
    /** Connection lost */
    DISCONNECTED = 'Disconnected',
    /** Error occurred */
    ERROR = 'Error'
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
    events: ConnectionEvent[];
}

export interface MessageHeader {
    action: ActionType;
    topic: string;
    version: string;
    requestId?: string;
}

export interface MessagePayload extends Record<string, any> {
    timeout?: number;
}

export interface Message {
    header: MessageHeader;
    payload: MessagePayload;
}

/**
 * Service for managing WebSocket communication with the server.
 * Extends EventEmitter to provide event-based communication.
 */
@Injectable({
    providedIn: 'root'
})
export class WebsocketService {
    /** Active WebSocket connection */
    private socket: WebSocket | null = null;
    /** Map of pending requests awaiting responses */
    private pendingRequests = new Map<string, { resolve: (response: any) => void; reject: (error: any) => void }>();
    /** Current state of the WebSocket connection */
    private _state = ConnectionState.DISCONNECTED;
    /** Storage key for the WebSocket URL */
    private readonly WS_URL_KEY = 'websocket_url';
    /** Default WebSocket URL based on current location */
    private readonly DEFAULT_URL = location.protocol.startsWith('https:') ? `wss://${location.hostname}:3000` : `ws://${location.hostname}:3000`;
    /** URL of the WebSocket server */
    private _url: string;
    /** Time of last successful connection */
    private _lastConnected?: Date;
    /** Number of reconnection attempts */
    private _reconnectAttempts = 0;
    /** Latest connection latency */
    private _latency?: number;
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
    /** Recent connection events */
    private _events: ConnectionEvent[] = [];

    /** Events */
    /** Connection events */
    connection$ = new SingleEmitter<(event: ConnectionEvent) => void>();
    /** Connected events */
    connected$ = new SingleEmitter<() => void>();
    /** State change events */
    stateChange$ = new SingleEmitter<(state: ConnectionState) => void>();
    /** Latency update events */
    latencyUpdate$ = new SingleEmitter<(latency: number) => void>();
    /** Error events */
    error$ = new SingleEmitter<(error: Event) => void>();
    /** Message events */
    message$ = new MultiEmitter<(message: Message) => void>();

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
            events: this._events
        };
    }

    /**
     * Creates an instance of WebsocketService.
     * Automatically connects to the WebSocket server.
     */
    constructor() {
        // Initialize URL from localStorage or default
        this._url = this.getStoredUrl();
        // Connect to the WebSocket server
        this.connect();
    }

    /**
     * Gets the stored WebSocket URL from localStorage or returns the default URL
     * @returns The stored URL or default URL
     */
    private getStoredUrl(): string {
        const storedUrl = localStorage.getItem(this.WS_URL_KEY);
        return storedUrl || this.DEFAULT_URL;
    }

    /**
     * Sets the WebSocket URL in localStorage
     * @param url - The URL to store
     */
    private setStoredUrl(url: string): void {
        localStorage.setItem(this.WS_URL_KEY, url);
    }

    /**
     * Updates the WebSocket URL and reconnects
     * @param url - The new WebSocket URL
     */
    public updateUrl(url: string): void {
        this.setStoredUrl(url);
        this._url = url;
        this.disconnect();
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

        this._events.unshift(event);
        if (this._events.length > this.MAX_RECENT_EVENTS) {
            this._events.pop();
        }

        this.connection$.emit(event);
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
            this.latencyUpdate$.emit(this._latency);
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
     * @param url - Optional WebSocket server URL. If not provided, uses the stored URL.
     */
    connect(url?: string): void {
        if (url) {
            this.updateUrl(url);
        } else {
            url = this._url;
        }
        // Stop any pending reconnection
        this.stopReconnectTimeout();

        this._url = url;
        if (this.socket) {
            // Suppress reconnection when manually closing
            this.suppressReconnect = true;
            this.socket.close();
        } else {
            this.initializeConnection(this._url);
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

        this.stateChange$.emit(this._state);
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            this._state = ConnectionState.CONNECTED;
            this._lastConnected = new Date();
            this._reconnectAttempts = 0;
            this.addEvent(ConnectionEventType.CONNECTED);
            this.connected$.emit();
            this.stateChange$.emit(this._state);
            this.startHeartbeat();
            this.request('system.service.register', { name: 'Insights Client', description: 'A Message Broker Insights client' });
        };

        this.socket.onmessage = (event) => {
            try {
                const [header, payload] = event.data.split('\n');
                const [action, topic, version, requestId] = header.split(':');
                const message = JSON.parse(payload);

                if (topic === 'system.heartbeat' && action === ActionType.REQUEST) {
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
                this.message$.emit(header, message);
            } catch (error) {
                console.error('Error parsing message:', error);
                this.addEvent(ConnectionEventType.ERROR, error instanceof Error ? error.message : String(error));
            }
        };

        this.socket.onclose = () => {
            this._state = ConnectionState.DISCONNECTED;
            this.addEvent(ConnectionEventType.DISCONNECTED);
            this.stateChange$.emit(this._state);
            this.stopHeartbeat();
            this.socket = null;

            // Only attempt to reconnect if not suppressed
            if (this.suppressReconnect) {
                this.suppressReconnect = false;
                this.initializeConnection(this._url);
            } else {
                this.reconnectTimeout = window.setTimeout(() => {
                    this.suppressReconnect = false;
                    this.initializeConnection(this._url);
                }, this.RECONNECT_DELAY);
            }
        };

        this.socket.onerror = (error: Event) => {
            this.addEvent(ConnectionEventType.ERROR, error instanceof Error ? error.message : 'Unknown error');
            this.error$.emit(error);
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
            this.stateChange$.emit(this._state);
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
            this.connection$.once(event => event.type === ConnectionEventType.CONNECTED ? resolve() : undefined);
        });
    }
}
