import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialogRef } from '@angular/material/dialog';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConnectionEvent, ConnectionEventType, WebsocketService } from '../../../services/websocket.service';

@Component({
    selector: 'app-connection-history',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        ReactiveFormsModule
    ],
    templateUrl: './connection-history.component.html',
    styleUrls: ['./connection-history.component.scss']
})
export class ConnectionHistoryComponent implements OnInit, OnDestroy {
    events: ConnectionEvent[] = [];

    urlForm = new FormGroup({
        url: new FormControl('', [
            Validators.required,
            Validators.pattern('^wss?:\\/\\/[\\w\\.-]+(:\\d+)?(\\/[\\w\\.-]*)*$')
        ])
    });

    constructor(
        public websocketService: WebsocketService,
        public dialogRef: MatDialogRef<ConnectionHistoryComponent>
    ) {}

    ngOnInit(): void {
        // Initialize form with current URL
        this.urlForm.patchValue({ url: this.websocketService.details.url });
        // Subscribe to connection events
        this.websocketService.connection$.on(this._handleConnectionEvent);
        this.events = this.websocketService.details.events;
    }

    ngOnDestroy(): void {
        // Unsubscribe from connection events
        this.websocketService.connection$.off(this._handleConnectionEvent);
    }

    private handleConnectionEvent(event: ConnectionEvent): void {
        this.events = this.websocketService.details.events;
    }
    private _handleConnectionEvent = this.handleConnectionEvent.bind(this);

    getEventIcon(event: ConnectionEvent): string {
        switch (event.type) {
            case ConnectionEventType.CONNECTED: return 'cloud_done';
            case ConnectionEventType.CONNECTING:
            case ConnectionEventType.RECONNECTING: return 'cloud_sync';
            case ConnectionEventType.DISCONNECTED: return 'cloud_off';
            case ConnectionEventType.ERROR: return 'error_outline';
            default: return 'warning';
        }
    }

    getEventColor(event: ConnectionEvent): string {
        switch (event.type) {
            case ConnectionEventType.CONNECTED: return '#4caf50';
            case ConnectionEventType.CONNECTING:
            case ConnectionEventType.RECONNECTING: return '#ff9800';
            case ConnectionEventType.DISCONNECTED: return '#f44336';
            case ConnectionEventType.ERROR: return '#f44336';
            default: return '#9e9e9e';
        }
    }

    formatDate(date: Date | null): string {
        if (!date) return 'Never';
        return date.toLocaleString();
    }

    formatLatency(latency: number | null): string {
        if (latency === null) return 'N/A';
        return `${latency}ms`;
    }

    /**
     * Validates and connects to the specified WebSocket URL
     */
    applyUrl(): void {
        if (this.urlForm.valid) {
            const url = this.urlForm.get('url')?.value;
            if (url) {
                this.websocketService.connect(url);
            }
        }
    }

    /**
     * Resets the URL form to the current WebSocket URL
     */
    resetUrl(): void {
        this.urlForm.patchValue({ url: this.websocketService.details.url });
    }

    /**
     * Gets error message for URL field
     */
    getUrlErrorMessage(): string {
        const control = this.urlForm.get('url');
        if (control?.hasError('required')) {
            return 'URL is required';
        }
        if (control?.hasError('pattern')) {
            return 'Invalid WebSocket URL (must start with ws:// or wss://)';
        }
        return '';
    }
}