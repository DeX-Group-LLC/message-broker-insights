/**
 * Main entry point for the Angular application.
 * Bootstraps the application with the AppComponent and necessary providers.
 */

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Bootstrap the Angular application with the root component and configuration
bootstrapApplication(AppComponent, appConfig)
    .catch(err => console.error('Error bootstrapping application:', err));
