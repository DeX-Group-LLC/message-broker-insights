import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ConnectionEvent, ConnectionEventType, WebsocketService } from '../../../services/websocket.service';

@Component({
    selector: 'app-connection-history',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatIconModule,
        MatButtonModule
    ],
    templateUrl: './connection-history.component.html',
    styleUrls: ['./connection-history.component.scss']
})
export class ConnectionHistoryComponent implements OnInit, OnDestroy {
    /** Current list of events */
    events: ConnectionEvent[];
    /** Event handler for connection events */
    private eventHandler = (event: ConnectionEvent) => {
        this.events.unshift(event);
    };

    constructor(
        @Inject(MAT_DIALOG_DATA) initialEvents: ConnectionEvent[],
        private websocketService: WebsocketService
    ) {
        this.events = [...initialEvents];
    }

    ngOnInit(): void {
        // Listen for new connection events
        this.websocketService.on('connectionEvent', this.eventHandler);
    }

    ngOnDestroy(): void {
        // Clean up event listener
        this.websocketService.off('connectionEvent', this.eventHandler);
    }

    /**
     * Gets the Material Icon name for an event type.
     *
     * @param event - Connection event
     * @returns Material Icon name
     */
    getEventIcon(event: ConnectionEvent): string {
        switch (event.type) {
            case ConnectionEventType.CONNECTED:
                return 'cloud_done';
            case ConnectionEventType.CONNECTING:
            case ConnectionEventType.RECONNECTING:
                return 'cloud_sync';
            case ConnectionEventType.DISCONNECTED:
                return 'cloud_off';
            case ConnectionEventType.ERROR:
                return 'error_outline';
            default:
                return 'cloud_off';
        }
    }

    /**
     * Gets the CSS class for an event type.
     *
     * @param event - Connection event
     * @returns CSS class name
     */
    getEventClass(event: ConnectionEvent): string {
        return event.type.toLowerCase();
    }

    /**
     * Gets a display label for an event type.
     *
     * @param event - Connection event
     * @returns Formatted event label
     */
    getEventLabel(event: ConnectionEvent): string {
        return event.type.charAt(0).toUpperCase() + event.type.slice(1).toLowerCase();
    }

    /**
     * Formats a date for display.
     *
     * @param date - Date to format
     * @returns Formatted date string
     */
    formatDate(date: Date): string {
        return date.toLocaleString();
    }
}