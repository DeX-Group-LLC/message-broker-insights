import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef } from '@angular/material/dialog';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { WebsocketService } from '../../../services/websocket.service';

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
            Validators.pattern('^wss?:\\/\\/[\\w\\.-]+(:\\d+)?(\\/[\\w\\.-]*)*$')
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
                this.websocketService.connect(url);
                this.dialogRef.close();
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
        return '';
    }
}