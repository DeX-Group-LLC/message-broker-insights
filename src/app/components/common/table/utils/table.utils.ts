/**
 * Efficiently clones table data with special handling for common types
 * @param obj - Object to clone
 * @returns Deep clone of the object
 */
export function fastClone<T>(obj: T): T {
    // Handle null/undefined
    if (obj === null || obj === undefined) {
        return obj;
    }

    // Handle primitive types
    if (typeof obj !== 'object') {
        return obj;
    }

    // Handle Date objects
    if (obj instanceof Date) {
        return new Date(obj) as any;
    }

    // Handle Arrays
    if (Array.isArray(obj)) {
        return obj.map(item => fastClone(item)) as any;
    }

    // Handle Objects
    const clone = {} as T;
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            clone[key] = fastClone(obj[key]);
        }
    }
    return clone;
}