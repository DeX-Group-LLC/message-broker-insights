import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** Available theme options for the application */
export type Theme = 'light' | 'dark' | 'system';

/** Available color palette options */
export type ColorPalette = 'red' | 'green' | 'blue' | 'yellow' | 'cyan' | 'magenta' |
    'orange' | 'chartreuse' | 'spring-green' | 'azure' | 'violet' | 'rose';

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
    /** Subject holding the current color palette selection */
    private currentColorPalette = new BehaviorSubject<ColorPalette>(this.getSavedColorPalette());

    /** Observable stream of theme changes */
    theme$ = this.currentTheme.asObservable();
    /** Observable stream of color palette changes */
    colorPalette$ = this.currentColorPalette.asObservable();

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
     * Gets the saved color palette from local storage.
     * Defaults to 'blue' if no color palette is saved.
     *
     * @returns The saved color palette
     */
    private getSavedColorPalette(): ColorPalette {
        return (localStorage.getItem('colorPalette') as ColorPalette) || 'blue';
    }

    /**
     * Saves the current color palette to local storage.
     *
     * @param colorPalette - Color palette to save
     */
    private saveColorPalette(colorPalette: ColorPalette): void {
        localStorage.setItem('colorPalette', colorPalette);
    }

    /**
     * Sets the current color palette.
     * Updates the color palette subject, saves the selection, and applies the theme.
     *
     * @param colorPalette - Color palette to set
     */
    setColorPalette(colorPalette: ColorPalette): void {
        this.currentColorPalette.next(colorPalette);
        this.saveColorPalette(colorPalette);
        this.applyTheme(this.currentTheme.value);
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

        const colorPalette = this.currentColorPalette.value;

        this.renderer.removeClass(document.body, 'light-theme');
        this.renderer.removeClass(document.body, 'dark-theme');

        // Remove all color palette classes
        document.body.classList.forEach(className => {
            if (className.endsWith('-palette')) {
                this.renderer.removeClass(document.body, className);
            }
        });

        this.renderer.addClass(document.body, `${effectiveTheme}-theme`);
        this.renderer.addClass(document.body, `${colorPalette}-palette`);

        document.documentElement.setAttribute('color-scheme', effectiveTheme);
    }
}