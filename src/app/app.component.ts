/**
 * Root component of the application.
 * Initializes core services and provides the main layout structure.
 */
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LayoutComponent } from './components/layout/layout.component';
import { LogService } from './services/log.service';
import { MetricsService } from './services/metrics.service';
import { ServicesService } from './services/services.service';
import { TopicsService } from './services/topics.service';
import { TrackerService } from './services/tracker.service';
import { ThemeService } from './services/theme.service';

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
     * @param topicsService - Service for managing topics
     */
    constructor(
        private logService: LogService,
        private metricsService: MetricsService,
        private servicesService: ServicesService,
        private themeService: ThemeService,
        private topicsService: TopicsService,
        private trackerService: TrackerService
    ) {}
}
