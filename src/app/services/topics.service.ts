import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WebsocketService } from './websocket.service';

/** Structure of a subscriber to a topic */
export interface Subscriber {
    /** ID of the service subscribed to the topic */
    serviceId: string;
    /** Priority of the subscription */
    priority: number;
}

/** Structure of a topic in the application */
export interface Topic {
    /** Name of the topic */
    name: string;
    /** Number of subscribers to this topic */
    subscriberCount: number;
    /** List of subscribers with their priorities */
    subscribers: Subscriber[];
    /** Last time the topic was updated */
    lastUpdated: Date;
}

/** Response structure from system.topic.subscribers */
interface TopicSubscribersResponse {
    [topicName: string]: Subscriber[];
}

/**
 * Service responsible for managing topics information.
 * Handles topic list polling and updates.
 */
@Injectable({
    providedIn: 'root'
})
export class TopicsService implements OnDestroy {
    /** Subject holding the current topics */
    private topicsSubject = new BehaviorSubject<Topic[]>([]);
    /** Subject indicating whether topics are currently being loaded */
    private loadingSubject = new BehaviorSubject<boolean>(false);
    /** Observable stream of topics */
    topics$ = this.topicsSubject.asObservable();
    /** Observable indicating whether topics are currently being loading */
    loading$ = this.loadingSubject.asObservable();
    /** ID of the polling interval timer */
    private intervalId?: number;
    /** Map of topic names to their current objects */
    private topicMap = new Map<string, Topic>();
    /** Current topics array */
    private currentTopics: Topic[] = [];

    /**
     * Creates an instance of TopicsService.
     *
     * @param websocketService - Service for WebSocket communication
     */
    constructor(private websocketService: WebsocketService) {
        this.startPolling();
    }

    /**
     * Cleans up resources when the service is destroyed.
     */
    ngOnDestroy(): void {
        this.stopPolling();
        this.topicsSubject.complete();
        this.loadingSubject.complete();
    }

    /**
     * Starts polling for topics at regular intervals.
     * Clears any existing polling interval before starting a new one.
     */
    private async startPolling(): Promise<void> {
        // Clear any existing interval
        this.stopPolling();

        // Set a new interval to poll for topics
        this.intervalId = window.setInterval(this.pollTopics.bind(this), 5000);
        await this.pollTopics();
    }

    /**
     * Stops the topics polling interval.
     */
    private stopPolling(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }

    /**
     * Polls the server for current topics.
     * Transforms the received topics and emits them to subscribers.
     */
    private async pollTopics(): Promise<void> {
        try {
            this.loadingSubject.next(true);
            const response = (await this.websocketService.request('system.topic.subscribers', {})).payload as any;

            if (response && typeof response.subscribers === 'object') {
                const topicSubscribers = response.subscribers as TopicSubscribersResponse;
                const topicNames = new Set(Object.keys(topicSubscribers));
                const currentTopicNames = new Set(this.currentTopics.map(t => t.name));

                // Add new topics
                for (const name of topicNames) {
                    if (!currentTopicNames.has(name)) {
                        const subscribers = topicSubscribers[name];
                        const topic: Topic = {
                            name,
                            subscriberCount: subscribers.length,
                            subscribers: subscribers,
                            lastUpdated: new Date()
                        };
                        this.currentTopics.push(topic);
                        this.topicMap.set(name, topic);
                    }
                }

                // Update existing topics
                for (const topic of this.currentTopics) {
                    if (topicNames.has(topic.name)) {
                        const subscribers = topicSubscribers[topic.name];
                        topic.subscriberCount = subscribers.length;
                        topic.subscribers = subscribers;
                        topic.lastUpdated = new Date();
                    }
                }

                // Remove topics that no longer exist
                this.currentTopics = this.currentTopics.filter(topic => {
                    const exists = topicNames.has(topic.name);
                    if (!exists) {
                        this.topicMap.delete(topic.name);
                    }
                    return exists;
                });

                this.topicsSubject.next(this.currentTopics);
            } else {
                console.error('Invalid topics response:', response);
            }
        } catch (error) {
            console.error('Error polling topics:', error);
        } finally {
            this.loadingSubject.next(false);
        }
    }

    /**
     * Forces an immediate refresh of the topics list.
     */
    async refresh(): Promise<void> {
        await this.pollTopics();
    }

    /**
     * Gets the current topics.
     * @returns Current topics
     */
    getTopics(): Topic[] {
        return this.currentTopics;
    }
}
