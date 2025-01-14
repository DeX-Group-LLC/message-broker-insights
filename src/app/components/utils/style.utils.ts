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
        const [light, dark] = value.match(/light-dark\((#[0-9a-fA-F]*),\s*(#[0-9a-fA-F]*)\)/)?.slice(1) || [];
        // Check if in light or dark mode
        const isDarkMode = document.body.classList.contains('dark-theme');
        return isDarkMode ? dark : light;
    }
    return value.trim();
}