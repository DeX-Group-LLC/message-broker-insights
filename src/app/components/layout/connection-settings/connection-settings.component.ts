import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef } from '@angular/material/dialog';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { WebsocketService } from '../../../services/websocket.service';

/**
 * Validates WebSocket URL protocol based on current page protocol and hostname
 * - For HTTP: Both WS and WSS are allowed
 * - For HTTPS on localhost: Both WS and WSS are allowed
 * - For HTTPS on other domains: Only WSS is allowed
 */
function validateWebSocketProtocol(control: AbstractControl): ValidationErrors | null {
    const url = control.value;
    if (!url) return null;

    const isHttps = location.protocol.startsWith('https:');
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

    // Only enforce WSS for HTTPS on non-localhost domains
    if (isHttps && !isLocalhost && url.startsWith('ws://')) {
        return { protocol: true };
    }

    return null;
}

@Component({
    selector: 'app-connection-settings',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        ReactiveFormsModule
    ],
    templateUrl: './connection-settings.component.html',
    styleUrls: ['./connection-settings.component.scss']
})
export class ConnectionSettingsComponent {
    urlForm = new FormGroup({
        url: new FormControl('', [
            Validators.required,
            Validators.pattern('^wss?:\\/\\/[\\w\\.-]+(:\\d+)?(\\/[\\w\\.-]*)*$'),
            validateWebSocketProtocol
        ])
    });

    constructor(
        private websocketService: WebsocketService,
        public dialogRef: MatDialogRef<ConnectionSettingsComponent>
    ) {
        this.urlForm.patchValue({ url: this.websocketService.details.url });
    }

    applyUrl(): void {
        if (this.urlForm.valid) {
            const url = this.urlForm.get('url')?.value;
            if (url) {
                try {
                    this.websocketService.connect(url);
                    this.dialogRef.close();
                } catch (error) {
                    // If the service throws an error, mark the form control as invalid
                    this.urlForm.get('url')?.setErrors({ protocol: true });
                }
            }
        }
    }

    resetUrl(): void {
        this.urlForm.patchValue({ url: this.websocketService.details.url });
    }

    getUrlErrorMessage(): string {
        const control = this.urlForm.get('url');
        if (control?.hasError('required')) {
            return 'URL is required';
        }
        if (control?.hasError('pattern')) {
            return 'Invalid WebSocket URL (must start with ws:// or wss://)';
        }
        if (control?.hasError('protocol')) {
            return 'HTTPS pages must use WSS protocol except for localhost connections';
        }
        return '';
    }
}