import { FieldSelection } from '../models/export.model';

/**
 * Determines the type of a value
 */
export function getValueType(value: any): 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'null' {
    if (value === undefined || value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'string';
}

/**
 * Recursively analyzes an object's structure to create field selections
 */
export function analyzeStructure(obj: any, parentPath: string[] = [], level: number = 0): FieldSelection[] {
    if (!obj || typeof obj !== 'object') return [];

    return Object.entries(obj).map(([key, value]): FieldSelection => {
        const path = [...parentPath, key];
        const type = getValueType(value);
        const field: FieldSelection = {
            name: key,
            path,
            included: true,
            type,
            level,
            children: []
        };

        if (type === 'object' && value) {
            field.children = analyzeStructure(value, path, level + 1);
            field.children.forEach(child => child.parent = field);
        } else if (type === 'array' && Array.isArray(value) && value.length > 0) {
            // For arrays, analyze multiple items if they're objects
            if (value.some(item => item && typeof item === 'object')) {
                // Sample up to 3 items from the array
                const sampleSize = Math.min(3, value.length);
                const step = Math.max(1, Math.floor(value.length / sampleSize));
                const samples = Array.from({ length: sampleSize }, (_, i) => value[i * step])
                    .filter(item => item && typeof item === 'object');

                field.children = samples.reduce((mergedFields, sample) => {
                    const sampleFields = analyzeStructure(sample, path, level + 1);
                    return mergeFieldStructures(mergedFields, sampleFields);
                }, [] as FieldSelection[]);

                field.children?.forEach(child => child.parent = field);
            }
        }

        return field;
    });
}

/**
 * Merges two field structures, combining their children and preserving all unique fields
 */
export function mergeFieldStructures(fields1: FieldSelection[], fields2: FieldSelection[]): FieldSelection[] {
    const merged = new Map<string, FieldSelection>();

    // Helper to add fields to the map
    const addFields = (fields: FieldSelection[]) => {
        fields.forEach(field => {
            const key = field.path.join('.');
            if (!merged.has(key)) {
                merged.set(key, { ...field, children: [] });
            }
            const existing = merged.get(key)!;

            // Merge children if both have them
            if (field.children?.length || existing.children?.length) {
                existing.children = mergeFieldStructures(
                    existing.children || [],
                    field.children || []
                );
                // Update parent references
                existing.children.forEach(child => child.parent = existing);
            }

            // Update type if the existing field is null and the new one isn't
            if (existing.type === 'null' && field.type !== 'null') {
                existing.type = field.type;
            }
        });
    };

    addFields(fields1);
    addFields(fields2);

    // Convert map back to array, preserving order from fields1
    const result: FieldSelection[] = [];
    const seen = new Set<string>();

    // First add all fields from fields1 in their original order
    fields1.forEach(field => {
        const key = field.path.join('.');
        if (merged.has(key) && !seen.has(key)) {
            result.push(merged.get(key)!);
            seen.add(key);
        }
    });

    // Then add any new fields from fields2
    fields2.forEach(field => {
        const key = field.path.join('.');
        if (merged.has(key) && !seen.has(key)) {
            result.push(merged.get(key)!);
            seen.add(key);
        }
    });

    return result;
}

/**
 * Analyzes the data structure and creates a hierarchical field selection
 */
export function initializeFieldSelection(data: any): FieldSelection[] {
    if (Array.isArray(data)) {
        // Sample up to 10 items, evenly distributed through the array
        const sampleSize = Math.min(10000, data.length);
        const step = Math.max(1, Math.floor(data.length / sampleSize));
        const samples = Array.from({ length: sampleSize }, (_, i) => data[i * step]);

        // Merge the structures of all samples
        return samples.reduce((mergedFields, sample) => {
            const sampleFields = analyzeStructure(sample);
            return mergeFieldStructures(mergedFields, sampleFields);
        }, [] as FieldSelection[]);
    } else {
        return analyzeStructure(data);
    }
}