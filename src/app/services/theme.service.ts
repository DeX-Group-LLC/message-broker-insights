import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** Available theme options for the application */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Service responsible for managing the application's theme.
 * Handles theme switching, persistence, and system theme detection.
 */
@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    /** Angular renderer for DOM manipulation */
    private renderer: Renderer2;
    /** Media query for detecting system dark theme preference */
    private darkThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    /** Subject holding the current theme selection */
    private currentTheme = new BehaviorSubject<Theme>(this.getSavedTheme());

    /** Observable stream of theme changes */
    theme$ = this.currentTheme.asObservable();

    /**
     * Creates an instance of ThemeService.
     * Sets up system theme detection and applies initial theme.
     *
     * @param rendererFactory - Factory for creating renderers
     */
    constructor(rendererFactory: RendererFactory2) {
        this.renderer = rendererFactory.createRenderer(null, null);

        // Listen for system theme changes
        this.darkThemeMediaQuery.addEventListener('change', (e) => {
            if (this.currentTheme.value === 'system') {
                this.applyTheme('system');
            }
        });

        // Apply initial theme
        this.applyTheme(this.currentTheme.value);
    }

    /**
     * Gets the saved theme from local storage.
     * Defaults to 'system' if no theme is saved.
     *
     * @returns The saved theme
     */
    private getSavedTheme(): Theme {
        return (localStorage.getItem('theme') as Theme) || 'system';
    }

    /**
     * Saves the current theme to local storage.
     *
     * @param theme - Theme to save
     */
    private saveTheme(theme: Theme): void {
        localStorage.setItem('theme', theme);
    }

    /**
     * Sets the current theme.
     * Updates the theme subject, saves the selection, and applies the theme.
     *
     * @param theme - Theme to set
     */
    setTheme(theme: Theme): void {
        this.currentTheme.next(theme);
        this.saveTheme(theme);
        this.applyTheme(theme);
    }

    /**
     * Applies the specified theme to the document.
     * Handles system theme by checking system preference.
     *
     * @param theme - Theme to apply
     */
    private applyTheme(theme: Theme): void {
        let effectiveTheme: 'light' | 'dark';

        if (theme === 'system') {
            effectiveTheme = this.darkThemeMediaQuery.matches ? 'dark' : 'light';
        } else {
            effectiveTheme = theme;
        }

        this.renderer.removeClass(document.body, 'light-theme');
        this.renderer.removeClass(document.body, 'dark-theme');
        this.renderer.addClass(document.body, `${effectiveTheme}-theme`);

        document.documentElement.setAttribute('color-scheme', effectiveTheme);
    }
}