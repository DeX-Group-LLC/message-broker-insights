
/**
 * Checks if the current theme is dark
 * @returns True if the theme is dark, false otherwise
 */
export function isDarkMode(): boolean {
    return document.body.classList.contains('dark-theme');
}

/**
 * Parses a light-dark value into its light and dark components
 * @param value - The light-dark value (e.g. 'light-dark(#FFFFFF, #000000)')
 * @returns The light and dark components
 */
export function parseLightDark(value: string): [string, string] {
    if (value.includes('light-dark')) {
        const [light, dark] = value.match(/light-dark\((#[0-9a-fA-F]*),\s*(#[0-9a-fA-F]*)\)/)?.slice(1) || [];
        return [light, dark];
    }
    return [value, value];
}

/**
 * Gets the computed value of a CSS variable
 * @param name - The name of the CSS variable (e.g. '--mat-sys-on-surface')
 * @returns The computed value of the CSS variable
 */
export function cssvar(name: string): string {
    const style = getComputedStyle(document.body);
    const value = style.getPropertyValue(name);
    // If light-dark(x, y), calculate the color
    if (value.includes('light-dark')) {
        const [light, dark] = parseLightDark(value);
        return isDarkMode() ? dark : light;
    }
    return value.trim();
}

function parseHex(color: string): { r: number; g: number; b: number } {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b };
}

/**
 * Converts a hex color to an RGBA color
 * @param hex - The hex color (e.g. '#FFFFFF')
 * @param alpha - The alpha value (0-1)
 * @returns The RGBA color
 */
export function hexToRGBA(hex: string, alpha: number = 1): string {
    // Parse the hex color (#FFFFFF)
    const { r, g, b } = parseHex(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function scaledLightDark(color: string, alpha: number = 0.5): string {
    const [light, dark] = parseLightDark(color);
    return isDarkMode() ? scaledMix(dark, light, alpha) : scaledMix(light, dark, alpha);
}

/**
 * Scales a primary and secondary color based on the current theme
 * @param primary - The primary color (e.g. '#FFFFFF')
 * @param secondary - The secondary color (e.g. '#000000')
 * @param alpha - The alpha value (0-1)
 * @returns The scaled color
 */
export function scaledMix(primary: string, secondary: string, alpha: number = 0.5): string {
    // Parse the colors:
    const primaryColor = parseHex(primary);
    const secondaryColor = parseHex(secondary);
    // Mix the colors based on the alpha value, where higher alpha values favor the theme color
    const mixedColor = {
        r: Math.round(primaryColor.r * alpha + secondaryColor.r * (1 - alpha)),
        g: Math.round(primaryColor.g * alpha + secondaryColor.g * (1 - alpha)),
        b: Math.round(primaryColor.b * alpha + secondaryColor.b * (1 - alpha)),
    };
    // Return the mixed color as a hex string
    return `#${mixedColor.r.toString(16).padStart(2, '0')}${mixedColor.g.toString(16).padStart(2, '0')}${mixedColor.b.toString(16).padStart(2, '0')}`;
}
