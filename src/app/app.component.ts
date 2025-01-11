/**
 * Root component of the application.
 * Initializes core services and provides the main layout structure.
 */
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LogService } from './services/log.service';
import { MetricsService } from './services/metrics.service';
import { LayoutComponent } from './components/layout/layout.component';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        CommonModule,
        LayoutComponent,
        RouterModule
    ],
    template: '<app-layout></app-layout>',
    styles: []
})
export class AppComponent {
    title = 'Message Broker Insights';
    /**
     * Creates an instance of AppComponent.
     * Initializes core services to ensure they are running from application startup.
     *
     * @param logService - Service for managing logs
     * @param metricsService - Service for managing metrics
     */
    constructor(
        private logService: LogService,
        private metricsService: MetricsService
    ) {}
}
