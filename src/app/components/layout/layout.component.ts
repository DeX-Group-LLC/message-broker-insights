import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd, Route } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { animate, state, style, transition, trigger, group } from '@angular/animations';
import { Observable, filter, map } from 'rxjs';
import { ThemeService, Theme, ColorPalette } from '../../services/theme.service';
import { WebsocketService, ConnectionState, ConnectionDetails } from '../../services/websocket.service';
import { ConnectionHistoryComponent } from './connection-history/connection-history.component';
import { ConnectionSettingsComponent } from './connection-settings/connection-settings.component';
import { routes, RouteData } from '../../app.routes';

interface NavItem {
    path: string;
    enabled: boolean;
    icon: string;
    iconClass?: string;
    label: string;
    shortLabel: string;
}

/**
 * Main layout component for the application.
 * Provides the navigation sidebar and theme switching functionality.
 */
@Component({
    selector: 'app-layout',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatToolbarModule,
        MatButtonModule,
        MatSidenavModule,
        MatIconModule,
        MatListModule,
        MatTooltipModule,
        MatMenuModule,
        MatDialogModule,
        MatSelectModule,
        MatFormFieldModule
    ],
    templateUrl: './layout.component.html',
    styleUrls: ['./layout.component.scss'],
    animations: [
        trigger('sidenavAnimation', [
            state('expanded', style({
                width: '170px'
            })),
            state('collapsed', style({
                width: '55px'
            })),
            transition('expanded <=> collapsed', [
                group([
                    animate('150ms ease')
                ])
            ])
        ])
    ],
})
export class LayoutComponent implements OnInit {
    /** Whether the sidebar is expanded */
    isExpanded = true;
    /** Observable of the current theme */
    currentTheme$!: Observable<Theme>;
    /** Observable of the current color palette */
    currentColorPalette$!: Observable<ColorPalette>;
    /** Observable of the current page title */
    currentPageTitle$!: Observable<string>;
    /** Observable of the current page icon */
    currentPageIcon$!: Observable<string>;
    /** Current WebSocket connection state */
    connectionState = ConnectionState;
    /** Observable of the current connection state */
    connectionState$!: Observable<ConnectionState>;
    /** Observable of the connection details */
    connectionDetails$!: Observable<ConnectionDetails>;

    /** Navigation items derived from routes */
    navItems: NavItem[] = routes
        .filter((route: Route) => route.data)
        .map((route: Route) => ({
            path: `/${route.path}`,
            enabled: (route.data as RouteData).enabled ?? true,
            icon: (route.data as RouteData).icon,
            iconClass: (route.data as RouteData).iconClass,
            label: (route.data as RouteData).label,
            shortLabel: (route.data as RouteData).shortLabel
        }));

    @ViewChild('toolbarContent') toolbarContent?: TemplateRef<any>;
    private _activeToolbarContent?: TemplateRef<any>;

    get activeToolbarContent(): TemplateRef<any> | undefined {
        return this._activeToolbarContent;
    }

    set activeToolbarContent(template: TemplateRef<any> | undefined) {
        this._activeToolbarContent = template;
    }

    /** Available color palettes */
    colorPalettes: ColorPalette[] = [
        'red', 'green', 'blue', 'yellow', 'cyan', 'magenta',
        'orange', 'chartreuse', 'spring-green', 'azure', 'violet', 'rose'
    ];

    /**
     * Creates an instance of LayoutComponent.
     *
     * @param themeService - Service for managing application theme
     * @param router - Angular router service for navigation
     */
    constructor(
        private themeService: ThemeService,
        private router: Router,
        public websocketService: WebsocketService,
        private dialog: MatDialog
    ) {}

    /**
     * Initializes the component.
     * Sets up theme and page title observables.
     */
    ngOnInit() {
        this.currentTheme$ = this.themeService.theme$;
        this.currentColorPalette$ = this.themeService.colorPalette$;
        this.currentPageTitle$ = this.router.events.pipe(
            filter(event => event instanceof NavigationEnd),
            map(() => {
                const currentRoute = this.router.url;
                const navItem = this.navItems.find(item => item.path === currentRoute);
                return navItem?.label || 'Message Broker Monitor';
            })
        );

        this.currentPageIcon$ = this.router.events.pipe(
            filter(event => event instanceof NavigationEnd),
            map(() => {
                const currentRoute = this.router.url;
                const navItem = this.navItems.find(item => item.path === currentRoute);
                return navItem?.icon || '';
            })
        );

        // Set up connection state observable
        this.connectionState$ = new Observable<ConnectionState>(observer => {
            // Initial state
            observer.next(this.websocketService.state);

            // Listen for state changes
            const handler = (state: ConnectionState) => observer.next(state);
            this.websocketService.stateChange$.on(handler);

            // Cleanup
            return () => this.websocketService.stateChange$.off(handler);
        });

        // Set up connection details observable
        this.connectionDetails$ = new Observable<ConnectionDetails>(observer => {
            // Initial details
            observer.next(this.websocketService.details);

            // Listen for state changes and latency updates
            const stateHandler = () => observer.next(this.websocketService.details);
            const latencyHandler = () => observer.next(this.websocketService.details);
            const eventHandler = () => observer.next(this.websocketService.details);

            this.websocketService.stateChange$.on(stateHandler);
            this.websocketService.latencyUpdate$.on(latencyHandler);
            this.websocketService.connection$.on(eventHandler);

            // Cleanup
            return () => {
                this.websocketService.stateChange$.off(stateHandler);
                this.websocketService.latencyUpdate$.off(latencyHandler);
                this.websocketService.connection$.off(eventHandler);
            };
        });
    }

    /**
     * Toggles the navigation sidebar between expanded and collapsed states.
     */
    toggleNavbar(): void {
        this.isExpanded = !this.isExpanded;
    }

    /**
     * Sets the application theme.
     *
     * @param theme - Theme to apply
     */
    setTheme(theme: Theme): void {
        this.themeService.setTheme(theme);
    }

    /**
     * Gets the Material Icon name for a theme.
     *
     * @param theme - Theme to get icon for
     * @returns Material Icon name
     */
    getThemeIcon(theme: Theme): string {
        switch (theme) {
            case 'light':
                return 'light_mode';
            case 'dark':
                return 'dark_mode';
            case 'system':
                return 'brightness_auto';
            default:
                return 'light_mode';
        }
    }

    /**
     * Gets a display label for a theme.
     * Capitalizes the first letter.
     *
     * @param theme - Theme to get label for
     * @returns Formatted theme label
     */
    getThemeLabel(theme: Theme): string {
        return theme.charAt(0).toUpperCase() + theme.slice(1);
    }

    /**
     * Gets the Material Icon name for the connection state.
     *
     * @param state - Connection state to get icon for
     * @returns Material Icon name
     */
    getConnectionIcon(state: ConnectionState): string {
        switch (state) {
            case ConnectionState.CONNECTING:
            case ConnectionState.RECONNECTING:
                return 'cloud_sync';
            case ConnectionState.CONNECTED:
                return 'cloud_done';
            case ConnectionState.DISCONNECTED:
                return 'cloud_off';
            default:
                return 'warning';
        }
    }

    /**
     * Gets a display label for the connection state.
     *
     * @param state - Connection state to get label for
     * @returns Formatted connection state label
     */
    getConnectionLabel(state: ConnectionState): string {
        return state.charAt(0).toUpperCase() + state.slice(1);
    }

    /**
     * Formats a date for display.
     *
     * @param date - Date to format
     * @returns Formatted date string
     */
    formatDate(date?: Date): string {
        if (!date) return 'Never';
        return date.toLocaleString();
    }

    /**
     * Formats latency for display.
     *
     * @param latency - Latency in milliseconds
     * @returns Formatted latency string
     */
    formatLatency(latency?: number): string {
        if (latency == null) return 'Unknown';
        return `${latency}ms`;
    }

    /**
     * Gets the tooltip text for the connection status.
     *
     * @param details - Connection details
     * @returns Tooltip text
     */
    getConnectionTooltip(details: ConnectionDetails): string {
        const lines = [
            `Server: \t\t\t\t${details.url}`,
            `Status: \t\t\t\t${this.getConnectionLabel(details.state)}`,
            `Last Connected: \t${this.formatDate(details.lastConnected)}`,
            `Latency: \t\t\t${this.formatLatency(details.latency)}`
        ];

        if (details.reconnectAttempts > 0) {
            lines.push(`Reconnection Attempts: ${details.reconnectAttempts}`);
        }

        return lines.join('\n');
    }

    /**
     * Shows the connection events dialog.
     */
    showConnectionEvents(): void {
        this.dialog.open(ConnectionHistoryComponent, {
            width: '600px',
            height: '80vh',
            maxHeight: '80vh',
            autoFocus: false
        });
    }

    /**
     * Shows the connection history dialog.
     */
    showConnectionHistory(): void {
        this.dialog.open(ConnectionHistoryComponent, {
            width: '600px',
            height: '80vh',
            maxHeight: '80vh',
            autoFocus: false
        });
    }

    /**
     * Shows the connection settings dialog.
     */
    showConnectionSettings(): void {
        this.dialog.open(ConnectionSettingsComponent, {
            width: '600px',
            autoFocus: false
        });
    }

    /**
     * Manually triggers a reconnection attempt.
     */
    reconnect(): void {
        this.websocketService.connect();
    }

    /**
     * Sets the color palette
     * @param event The MatSelectChange event containing the selected palette
     */
    setColorPalette(palette: ColorPalette): void {
        this.themeService.setColorPalette(palette);
    }

    /**
     * Gets a formatted label for a color palette
     * @param palette The color palette
     * @returns The formatted label
     */
    getColorPaletteLabel(palette: ColorPalette): string {
        return palette.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }
}
