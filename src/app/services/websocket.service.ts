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
    /** URL of the WebSocket server */
    url: string;
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

/**
 * Represents the header section of a message.
 * Contains metadata about the message including its action type, topic, and version.
 */
export type BrokerHeader = {
    /** The type of action this message represents (e.g., REQUEST, RESPONSE, PUBLISH) */
    action: ActionType;

    /** The topic this message belongs to, using dot notation (e.g., 'service.event') */
    topic: string;

    /** The version of the message format (e.g., '1.0.0') */
    version: string;

    /** Optional unique identifier for request-response message pairs */
    requestId?: string;

    /** Optional unique identifier for parent request-response message pairs */
    parentRequestId?: string;
};

export type ClientHeader = BrokerHeader & {
    /** Optional timeout for request-response message pairs */
    timeout?: number;
};

export type MessageHeader = BrokerHeader | ClientHeader;

export type MessagePayloadError = {
    /**
     * Represents an error structure within a message.
     * Used to communicate error details in a standardized format.
     */
    error: {
        /** Unique error code identifying the type of error */
        code: string;

        /** Human-readable error message describing what went wrong */
        message: string;

        /** Timestamp when the error occurred in ISO 8601 format */
        timestamp: string; // ISO 8601 format (e.g., "2023-10-27T10:30:00Z")

        /** Optional additional error details as a structured object */
        details?: object;
    };
};

export type MessagePayloadSuccess = Record<string, any>;

/**
 * Represents the payload section of a message.
 * Contains the actual data being transmitted along with optional control fields.
 */
export type MessagePayload = MessagePayloadSuccess | MessagePayloadError;

/**
 * Represents a complete message in the system.
 * Combines a header and payload to form a full message structure.
 */
export type Message<T extends MessageHeader = MessageHeader, U extends MessagePayload = MessagePayload> = {
    /** Message metadata and routing information */
    header: T;

    /** Message content and data */
    payload: U;
};

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
    private pendingRequests = new Map<string, { resolve: (message: Message<BrokerHeader, MessagePayloadSuccess>) => void; reject: (message: Message<BrokerHeader, MessagePayloadError>) => void }>();
    /** Current state of the WebSocket connection */
    private _state = ConnectionState.DISCONNECTED;
    /** Storage key for the WebSocket URL */
    private readonly WS_URL_KEY = 'websocket_url';
    /** Default WebSocket URL based on current location */
    private readonly DEFAULT_URL = (() => {
        // Otherwise, use the current location
        const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        // Force WSS only for HTTPS on non-localhost domains
        const forceWSS = location.protocol.startsWith('https:') && !isLocalhost;
        // Default to matching the page protocol, but allow both for HTTP or localhost
        const protocol = forceWSS ? 'wss:' : (location.protocol.startsWith('https:') ? 'wss:' : 'ws:');
        return `${protocol}//${location.hostname}:3000`;
    })();
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
    message$ = new MultiEmitter<(header: MessageHeader, payload: MessagePayload) => void>();

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
     * @throws Error if trying to use WS protocol on HTTPS for non-localhost domains
     */
    public updateUrl(url: string): void {
        const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        const isHttps = location.protocol.startsWith('https:');

        // Only enforce WSS for HTTPS on non-localhost domains
        if (isHttps && !isLocalhost && url.startsWith('ws://')) {
            throw new Error('Cannot use WS protocol on HTTPS for non-localhost domains. Use WSS instead.');
        }

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
            url: this._url,
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
            return this.updateUrl(url);
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
        try {
            this.socket = new WebSocket(url);
        } catch (error: any) {
            console.error('Error connecting to WebSocket:', error);
            this.addEvent(ConnectionEventType.ERROR, error instanceof Error ? error.message : 'Unknown error');
            this.error$.emit(error);
            return;
        }

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
                const [headerStr, payloadStr] = event.data.split('\n');
                const [action, topic, version, requestId, parentRequestId, timeout] = headerStr.split(':');
                const header: MessageHeader = { action, topic, version, requestId, parentRequestId, timeout };
                const payload: MessagePayload = JSON.parse(payloadStr);

                // Parse the error timestamp
                if (payload.error) {
                    payload.error.timestamp = new Date(payload.error.timestamp);
                }

                // Emit the message
                this.message$.emit(`${action}:${topic}`, header, payload);
                this.message$.emit(`${action}:${topic}:${version}`, header, payload);
                this.message$.emit(`${action}:${topic}:${version}:${requestId}`, header, payload);

                // Handle the message
                if (topic === 'system.heartbeat' && action === ActionType.REQUEST) {
                    this.send(ActionType.RESPONSE, 'system.heartbeat', { timestamp: new Date().toISOString() }, requestId);
                } else if (action === ActionType.RESPONSE && requestId) {
                    const request = this.pendingRequests.get(requestId);
                    if (request == null) return;

                    // Clean up the request
                    this.pendingRequests.delete(requestId);

                    // Resolve the request
                    if (payload.error) {
                        request.reject({ header, payload: payload as MessagePayloadError });
                    } else {
                        request.resolve({ header, payload: payload as MessagePayloadSuccess });
                    }
                }
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
        // Serialize the message:
        const message = this.serializeMessage({ action, topic, version: '1.0.0', requestId }, payload);
        // Serialize and send the message:
        this.socket!.send(message);
    }

    /**
     * Makes a request to the server and waits for a response.
     *
     * @param topic - Topic to request data from
     * @param payload - Data to send with the request
     * @param timeout - Optional timeout in milliseconds
     * @returns Promise that resolves with the response
     */
    async request(topic: string, payload: Object = {}, timeout?: number): Promise<Message<BrokerHeader, MessagePayloadSuccess>> {
        return await new Promise((resolve, reject) => {
            const requestId = uuidv4();
            if (timeout) (payload as any).timeout = timeout;
            this.send(ActionType.REQUEST, topic, payload, requestId);
            this.pendingRequests.set(requestId, { resolve, reject });
        });
    }

    /**
     * Subscribes to a topic.
     * @param action - The action type
     * @param topic - The topic to subscribe to
     * @param priority - The priority of the subscription
     * @param callback - The callback function to handle incoming messages
     * @returns Promise that resolves with the subscription response
     */
    async subscribe(action: ActionType.PUBLISH | ActionType.REQUEST, topic: string, priority: number = 0, callback: (header: MessageHeader, payload: MessagePayload) => void): Promise<Message<BrokerHeader, MessagePayloadSuccess>> {
        // Clear all existing subscriptions
        this.message$.clear(`${action}:${topic}`);
        // Subscribe to the topic
        this.message$.on(`${action}:${topic}`, callback);
        // Request to subscribe to the topic
        return await this.request('system.topic.subscribe', { topic, priority });
    }

    /**
     * Unsubscribes from a topic.
     * @param action - The action type
     * @param topic - The topic to unsubscribe from
     */
    unsubscribe(action: ActionType.PUBLISH | ActionType.REQUEST, topic: string): void {
        this.message$.clear(`${action}:${topic}`);
        // Request to unsubscribe from the topic
        this.request('system.topic.unsubscribe', { topic });
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

    /**
     * Serializes a message into a string.
     * @param header - The header of the message
     * @param payload - The payload of the message
     * @returns The serialized message
     */
    serializeMessage(header: MessageHeader, payload: MessagePayload): string {
        // Create the header line
        let headerLine = `${header.action}:${header.topic}:${header.version}`;

        if ((header as ClientHeader).timeout) headerLine += `:${header.requestId ?? ''}:${header.parentRequestId ?? ''}:${(header as ClientHeader).timeout}`;
        else if (header.parentRequestId) headerLine += `:${header.requestId ?? ''}:${header.parentRequestId}`;
        else if (header.requestId) headerLine += `:${header.requestId}`;

        // Create the payload line
        const payloadLine = JSON.stringify(payload);
        return `${headerLine}\n${payloadLine}`;
    }

    /**
     * Gets the size of a message in bytes.
     * @param header - The header of the message
     * @param payload - The payload of the message
     * @returns The size of the message in bytes
     */
    getMessageSize(header: MessageHeader, payload: MessagePayload): number {
        return new TextEncoder().encode(this.serializeMessage(header, payload)).length;
    }
}
