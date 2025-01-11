import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd, Route } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { animate, state, style, transition, trigger, group } from '@angular/animations';
import { Observable, filter, map } from 'rxjs';
import { ThemeService, Theme } from '../../services/theme.service';
import { routes, RouteData } from '../../app.routes';

interface NavItem {
    path: string;
    icon: string;
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
        MatMenuModule
    ],
    templateUrl: './layout.component.html',
    styleUrls: ['./layout.component.scss'],
    animations: [
        trigger('sidenavAnimation', [
            state('expanded', style({
                width: '150px'
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
    /** Observable of the current page title */
    currentPageTitle$!: Observable<string>;

    /** Navigation items derived from routes */
    navItems: NavItem[] = routes
        .filter((route: Route) => route.data)
        .map((route: Route) => ({
            path: `/${route.path}`,
            icon: (route.data as RouteData).icon,
            label: (route.data as RouteData).label,
            shortLabel: (route.data as RouteData).shortLabel
        }));

    /**
     * Creates an instance of LayoutComponent.
     *
     * @param themeService - Service for managing application theme
     * @param router - Angular router service for navigation
     */
    constructor(
        private themeService: ThemeService,
        private router: Router
    ) {}

    /**
     * Initializes the component.
     * Sets up theme and page title observables.
     */
    ngOnInit() {
        this.currentTheme$ = this.themeService.theme$;
        this.currentPageTitle$ = this.router.events.pipe(
            filter(event => event instanceof NavigationEnd),
            map(() => {
                const currentRoute = this.router.url;
                const navItem = this.navItems.find(item => item.path === currentRoute);
                return navItem?.label || 'Message Broker Monitor';
            })
        );
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
                return 'settings_suggest';
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
}
