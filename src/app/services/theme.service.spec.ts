import { TestBed } from '@angular/core/testing';
import { ThemeService, Theme, ColorPalette } from './theme.service';
import { RendererFactory2 } from '@angular/core';

/**
 * Test suite for ThemeService.
 * Tests theme management, persistence, and system theme detection.
 *
 * The service is responsible for:
 * - Managing application themes (light/dark/system)
 * - Managing color palettes
 * - Persisting theme preferences
 * - Detecting and responding to system theme changes
 */
describe('ThemeService', () => {
    let service: ThemeService;

    /**
     * Mock MediaQueryList interface for testing system theme detection.
     * Includes both modern and legacy event listener methods.
     */
    let mockMediaQueryList: {
        _matches: boolean;
        readonly matches: boolean;
        addEventListener: (type: string, listener: (e: MediaQueryListEvent) => void) => void;
        removeEventListener: () => void;
        addListener: (listener: (e: MediaQueryListEvent) => void) => void;  // For backwards compatibility
        removeListener: () => void;  // For backwards compatibility
    };

    /** Stores the current media query listener for triggering theme changes */
    let mockMediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

    beforeEach(() => {
        // Mock MediaQueryList with getter for matches
        mockMediaQueryList = {
            _matches: false,
            get matches() { return this._matches; },
            addEventListener: (type: string, listener: (e: MediaQueryListEvent) => void) => {
                if (type === 'change') {
                    mockMediaQueryListener = listener;
                }
            },
            removeEventListener: () => { },
            // Add backwards compatibility methods
            addListener: (listener: (e: MediaQueryListEvent) => void) => {
                mockMediaQueryListener = listener;
            },
            removeListener: () => { }
        };

        // Mock matchMedia to return our mock MediaQueryList
        window.matchMedia = jasmine.createSpy().and.returnValue(mockMediaQueryList);

        TestBed.configureTestingModule({
            providers: [ThemeService]
        });

        service = TestBed.inject(ThemeService);
    });

    afterEach(() => {
        // Clean up localStorage and DOM state
        localStorage.clear();
        document.body.classList.remove('light-theme', 'dark-theme');
        const paletteClasses = Array.from(document.body.classList).filter(cls => cls.endsWith('-palette'));
        document.body.classList.remove(...paletteClasses);
    });

    /**
     * Tests for service initialization and setup.
     * Verifies:
     * - Service creation
     * - Default theme loading
     * - Default color palette loading
     */
    describe('initialization', () => {
        /**
         * Verifies that the service is created successfully.
         * This is a basic sanity check to ensure dependency injection works.
         */
        it('should be created', () => {
            expect(service).toBeTruthy();
        });

        /**
         * Tests default theme loading from localStorage.
         * Should use 'system' theme if no theme is saved, which defaults to light theme
         * when no system preference is set.
         */
        it('should load default theme', () => {
            expect(service.theme).toBe('system');
            expect(document.body.classList.contains('light-theme')).toBeTrue();
        });

        /**
         * Tests default color palette loading from localStorage.
         * Should use 'blue' palette if no palette is saved.
         */
        it('should load default color palette', () => {
            expect(service.colorPalette).toBe('blue');
            expect(document.body.classList.contains('blue-palette')).toBeTrue();
        });
    });

    /**
     * Tests for theme management functionality.
     * Verifies:
     * - Theme switching
     * - Theme persistence
     * - System theme detection and updates
     */
    describe('theme management', () => {
        beforeEach(() => {
            // Ensure clean theme state for each test
            document.body.classList.remove('light-theme', 'dark-theme');
        });

        /**
         * Tests theme switching functionality.
         * Verifies that:
         * - Theme is correctly updated in service
         * - Appropriate classes are added/removed from body
         */
        it('should switch themes correctly', () => {
            service.setTheme('dark');
            expect(service.theme).toBe('dark');
            expect(document.body.classList.contains('dark-theme')).toBeTrue();
            expect(document.body.classList.contains('light-theme')).toBeFalse();
        });

        /**
         * Tests theme persistence in localStorage.
         * Verifies that:
         * - Theme selection is saved to localStorage
         * - New service instances load the saved theme
         */
        it('should persist theme selection', () => {
            service.setTheme('dark');
            expect(localStorage.getItem('theme')).toBe('dark');

            // Create new service instance to test loading
            const newService = TestBed.inject(ThemeService);
            expect(newService.theme).toBe('dark');
        });

        /**
         * Tests system theme detection and updates.
         * Verifies that:
         * - Service responds to system theme changes
         * - Appropriate theme is applied when system preference changes
         */
        it('should handle system theme changes', () => {
            service.setTheme('system');
            expect(service.theme).toBe('system');

            // Simulate system dark theme
            mockMediaQueryList._matches = true;
            mockMediaQueryListener?.({
                matches: true,
                media: '(prefers-color-scheme: dark)'
            } as MediaQueryListEvent);

            expect(document.body.classList.contains('dark-theme')).toBeTrue();
            expect(document.body.classList.contains('light-theme')).toBeFalse();
        });
    });

    /**
     * Tests for color palette management functionality.
     * Verifies:
     * - Palette switching
     * - Palette persistence
     * - Class management during palette changes
     */
    describe('color palette management', () => {
        beforeEach(() => {
            // Ensure clean palette state for each test
            localStorage.clear();
            const paletteClasses = Array.from(document.body.classList).filter(cls => cls.endsWith('-palette'));
            document.body.classList.remove(...paletteClasses);

            // Initialize with default theme
            service = TestBed.inject(ThemeService);
        });

        /**
         * Tests color palette switching functionality.
         * Verifies that:
         * - Palette is correctly updated in service
         * - Old palette classes are removed
         * - New palette classes are added
         */
        it('should switch color palettes correctly', () => {
            // Apply initial palette
            service.setColorPalette('blue');
            expect(service.colorPalette).toBe('blue');
            expect(document.body.classList.contains('blue-palette')).toBeTrue();

            // Switch palette and verify changes
            service.setColorPalette('green');
            expect(service.colorPalette).toBe('green');
            expect(document.body.classList.contains('green-palette')).toBeTrue();
            expect(document.body.classList.contains('blue-palette')).toBeFalse();
        });

        /**
         * Tests color palette persistence in localStorage.
         * Verifies that:
         * - Palette selection is saved to localStorage
         * - New service instances load the saved palette
         */
        it('should persist color palette selection', () => {
            service.setColorPalette('green');
            expect(localStorage.getItem('colorPalette')).toBe('green');

            // Create new service instance to test loading
            const newService = TestBed.inject(ThemeService);
            expect(newService.colorPalette).toBe('green');
        });
    });
});