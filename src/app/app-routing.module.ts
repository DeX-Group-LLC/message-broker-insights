import { Routes } from '@angular/router';

/**
 * Interface defining the data structure for route metadata.
 */
export interface RouteData {
    /** Icon name from Material Icons */
    icon: string;
    /** Full label for the route */
    label: string;
    /** Short label for collapsed navigation */
    shortLabel: string;
}

/**
 * Application route configuration.
 * Defines the available routes and their components.
 */
export const routes: Routes = [];