import { isDarkMode, parseLightDark, cssvar, hexToRGBA, scaledLightDark, scaledMix } from './style.utils';

/**
 * Test suite for style utility functions that handle theme-based styling,
 * color manipulation, and CSS variable management
 */
describe('Style Utils', () => {
    let documentBody: HTMLElement;

    beforeEach(() => {
        documentBody = document.body;
    });

    /**
     * Tests for isDarkMode function which determines if dark theme is active
     */
    describe('isDarkMode', () => {
        /**
         * Verifies that isDarkMode returns true when dark-theme class is present on body
         */
        it('should return true when dark-theme class is present', () => {
            documentBody.classList.add('dark-theme');
            expect(isDarkMode()).toBe(true);
            documentBody.classList.remove('dark-theme');
        });

        /**
         * Verifies that isDarkMode returns false when dark-theme class is absent
         */
        it('should return false when dark-theme class is not present', () => {
            documentBody.classList.remove('dark-theme');
            expect(isDarkMode()).toBe(false);
        });
    });

    /**
     * Tests for parseLightDark function which extracts light and dark values
     * from light-dark CSS syntax
     */
    describe('parseLightDark', () => {
        /**
         * Verifies correct parsing of light-dark format strings into separate colors
         */
        it('should parse light-dark values correctly', () => {
            const result = parseLightDark('light-dark(#FFFFFF, #000000)');
            expect(result).toEqual(['#FFFFFF', '#000000']);
        });

        /**
         * Verifies handling of non-light-dark format strings
         */
        it('should return same value for both light and dark when not light-dark format', () => {
            const result = parseLightDark('#FFFFFF');
            expect(result).toEqual(['#FFFFFF', '#FFFFFF']);
        });
    });

    /**
     * Tests for cssvar function which retrieves and processes CSS variable values
     */
    describe('cssvar', () => {
        let computedStyle: CSSStyleDeclaration;

        beforeEach(() => {
            computedStyle = {
                getPropertyValue: jasmine.createSpy('getPropertyValue')
            } as any;
            spyOn(window, 'getComputedStyle').and.returnValue(computedStyle);
        });

        /**
         * Verifies that whitespace is properly trimmed from CSS variable values
         */
        it('should return trimmed CSS variable value', () => {
            (computedStyle.getPropertyValue as jasmine.Spy).and.returnValue(' #FFFFFF ');
            expect(cssvar('--test-var')).toBe('#FFFFFF');
        });

        /**
         * Verifies that light-dark values are correctly processed based on current theme
         */
        it('should handle light-dark values based on theme', () => {
            (computedStyle.getPropertyValue as jasmine.Spy).and.returnValue('light-dark(#FFFFFF, #000000)');

            documentBody.classList.remove('dark-theme');
            expect(cssvar('--test-var')).toBe('#FFFFFF');

            documentBody.classList.add('dark-theme');
            expect(cssvar('--test-var')).toBe('#000000');
        });
    });

    /**
     * Tests for hexToRGBA function which converts hex colors to RGBA format
     */
    describe('hexToRGBA', () => {
        /**
         * Verifies conversion with default alpha value (1)
         */
        it('should convert hex to rgba with default alpha', () => {
            expect(hexToRGBA('#FFFFFF')).toBe('rgba(255, 255, 255, 1)');
        });

        /**
         * Verifies conversion with custom alpha value
         */
        it('should convert hex to rgba with custom alpha', () => {
            expect(hexToRGBA('#000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
        });
    });

    /**
     * Tests for scaledLightDark function which scales colors based on theme
     */
    describe('scaledLightDark', () => {
        /**
         * Verifies color scaling behavior in both light and dark themes
         */
        it('should scale colors based on theme', () => {
            documentBody.classList.remove('dark-theme');
            expect(scaledLightDark('light-dark(#FFFFFF, #000000)', 0.5)).toBe('#808080');

            documentBody.classList.add('dark-theme');
            expect(scaledLightDark('light-dark(#FFFFFF, #000000)', 0.5)).toBe('#808080');
        });
    });

    /**
     * Tests for scaledMix function which blends two colors together
     */
    describe('scaledMix', () => {
        /**
         * Verifies color mixing with default alpha value (0.5)
         */
        it('should mix colors with default alpha', () => {
            expect(scaledMix('#FFFFFF', '#000000')).toBe('#808080');
        });

        /**
         * Verifies color mixing with custom alpha value
         */
        it('should mix colors with custom alpha', () => {
            expect(scaledMix('#FFFFFF', '#000000', 0.75)).toBe('#bfbfbf');
        });
    });
});