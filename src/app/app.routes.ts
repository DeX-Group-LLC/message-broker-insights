import { Routes } from '@angular/router';
import { LogsComponent } from './components/logs/logs.component';
import { MetricsComponent } from './components/metrics/metrics.component';
import { ServicesComponent } from './components/services/services.component';

/**
 * Interface defining the data structure for route metadata.
 * Used to configure navigation items in the layout.
 */
export interface RouteData {
    /** Icon name from Material Icons library */
    icon: string;
    /** Full label for the route in navigation */
    label: string;
    /** Short label for collapsed navigation state */
    shortLabel: string;
}

/**
 * Application route configuration.
 * Defines the available routes and their components:
 * - /logs: Displays system logs with filtering and sorting
 * - /metrics: Shows system metrics with real-time updates
 * - /services: Shows system services with status and details
 */
export const routes: Routes = [
    {
        path: 'logs',
        component: LogsComponent,
        data: {
            icon: 'article',
            label: 'System Logs',
            shortLabel: 'Logs'
        }
    },
    {
        path: 'metrics',
        component: MetricsComponent,
        data: {
            icon: 'monitoring',
            label: 'System Metrics',
            shortLabel: 'Metrics'
        }
    },
    {
        path: 'services',
        component: ServicesComponent,
        data: {
            icon: 'settings_applications',
            label: 'System Services',
            shortLabel: 'Services'
        }
    },
    {
        path: '',
        redirectTo: 'logs',
        pathMatch: 'full'
    }
];