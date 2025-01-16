import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LogsComponent } from './components/logs/logs.component';
import { MetricsComponent } from './components/metrics/metrics.component';
import { ServicesComponent } from './components/services/services.component';
import { SubscriptionsComponent } from './components/subscriptions/subscriptions.component';
import { TrackerComponent } from './components/tracker/tracker.component';
import { Component } from '@angular/core';

/**
 * Interface defining the data structure for route metadata.
 * Used to configure navigation items in the layout.
 */
export interface RouteData {
    /** Whether the route is enabled */
    enabled: boolean;
    /** Icon name from Material Icons library */
    icon: string;
    /** Icon class for custom icons */
    iconClass?: string;
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
 * - /subscriptions: Shows message topics and their subscribers
 */
export const routes: Routes = [
    {
        path: 'dashboard',
        component: DashboardComponent,
        data: {
            icon: 'dashboard',
            label: 'Dashboard',
            shortLabel: 'Dashboard'
        }
    },
    {
        path: 'database',
        component: Component,
        data: {
            enabled: false,
            icon: 'database_search',
            iconClass: 'material-symbols-filled',
            label: 'Database Viewer',
            shortLabel: 'Database'
        }
    },
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
            iconClass: 'material-symbols-outlined',
            label: 'System Metrics',
            shortLabel: 'Metrics'
        }
    },
    {
        path: 'security',
        component: Component,
        data: {
            enabled: false,
            icon: 'security',
            iconClass: 'material-symbols-filled',
            label: 'Security',
            shortLabel: 'Security'
        }
    },
    {
        path: 'services',
        component: ServicesComponent,
        data: {
            icon: 'lan',
            label: 'System Services',
            shortLabel: 'Services'
        }
    },
    {
        path: 'subscriptions',
        component: SubscriptionsComponent,
        data: {
            icon: 'bookmarks',
            label: 'Topic Subscriptions',
            shortLabel: 'Subscriptions'
        }
    },
    {
        path: 'tracker',
        component: TrackerComponent,
        data: {
            icon: 'mediation',
            label: 'Message Tracker',
            shortLabel: 'Tracker'
        }
    }
];