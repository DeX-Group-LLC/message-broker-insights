import { SerializationOptions, ExportData, FieldSelection } from '../models/export.model';
import { initializeFieldSelection } from './field-analysis.utils';

/** Default CSV serialization options */
const defaultCSVOptions: SerializationOptions = {
    arrayDelimiter: ',',
    maxArrayItems: 10,
    dateFormat: 'iso',
    objectFormat: 'json'
};

/**
 * Serializes a value based on its type
 */
function serializeValue(value: any, options: SerializationOptions = {}): string {
    const opts = { ...defaultCSVOptions, ...options };

    if (value === null || value === undefined) {
        return '';
    }

    if (value instanceof Date) {
        switch (opts.dateFormat) {
            case 'local':
                return value.toLocaleString();
            case 'unix':
                return Math.floor(value.getTime() / 1000).toString();
            case 'iso':
            default:
                return value.toISOString();
        }
    }

    if (Array.isArray(value)) {
        const maxItems = opts.maxArrayItems ?? defaultCSVOptions.maxArrayItems!;
        const items = value.slice(0, maxItems);
        const remaining = value.length - maxItems;
        const delimiter = opts.arrayDelimiter ?? defaultCSVOptions.arrayDelimiter!;
        const serialized = items
            .map(item => serializeValue(item, opts))
            .join(delimiter);
        return remaining > 0
            ? `${serialized}${delimiter}... and ${remaining} more`
            : serialized;
    }

    if (typeof value === 'object') {
        return JSON.stringify(value);
    }

    return String(value);
}

/**
 * Creates a Blob from data and triggers a download
 */
function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Converts data to JSON string
 */
export function toJson(data: any): string {
    return JSON.stringify(data, null, 2);
}

/**
 * Exports data as JSON
 */
export function exportToJson(exportData: ExportData): void {
    const jsonStr = toJson(exportData.data);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    downloadBlob(blob, `${exportData.filename}-${new Date().toISOString()}.json`);
}

/**
 * Converts data to CSV string
 */
export function toCsv(exportData: ExportData, options?: SerializationOptions): string {
    const { data } = exportData;
    let { fields } = exportData;

    // If no fields provided, analyze the data structure
    if (!fields) {
        fields = initializeFieldSelection(data);
    }

    const opts = { ...defaultCSVOptions, ...options };
    const delimiter = opts.fieldDelimiter || ',';

    // Helper to get value by path array
    const getValueByPath = (obj: any, path: string[]): any => {
        return path.reduce((o, key) => o?.[key], obj);
    };

    // Helper to process a value based on its type and format options
    const processValue = (value: any): string => {
        if (value === null || value === undefined) return '';

        // Handle dates
        if (value instanceof Date) {
            switch (opts.dateFormat) {
                case 'local':
                    return value.toLocaleString();
                case 'unix':
                    return Math.floor(value.getTime() / 1000).toString();
                case 'iso':
                default:
                    return value.toISOString();
            }
        }

        // Handle arrays
        if (Array.isArray(value)) {
            const maxItems = opts.maxArrayItems ?? defaultCSVOptions.maxArrayItems!;
            const items = value.slice(0, maxItems);
            const remaining = value.length - maxItems;

            switch (opts.arrayFormat) {
                case 'comma-list':
                    const processed = items.map(item => {
                        if (item === null || item === undefined) return '';
                        if (item instanceof Date) return processValue(item);
                        if (Array.isArray(item)) {
                            // Handle nested arrays recursively
                            return processValue(item);
                        }
                        if (typeof item === 'object' && item !== null) {
                            // If we're flattening objects, handle nested objects in arrays differently
                            if (opts.objectFormat === 'flatten') {
                                const flattenedObj = Object.entries(item)
                                    .map(([key, val]) => `${key}:${processValue(val)}`)
                                    .join(';');
                                return `{${flattenedObj}}`;
                            }
                            return JSON.stringify(item);
                        }
                        return String(item);
                    }).join(',');
                    return remaining > 0 ? `${processed},... and ${remaining} more` : processed;

                case 'json':
                default:
                    // For json format, stringify the entire array but respect maxItems
                    const truncatedArray = items;
                    if (remaining > 0) {
                        truncatedArray.push(`... and ${remaining} more`);
                    }
                    return JSON.stringify(truncatedArray);
            }
        }

        // Handle objects (that aren't dates)
        if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
            return JSON.stringify(value);
        }

        // Handle primitives
        return String(value);
    };

    // Get included leaf fields and their full paths
    const getIncludedFields = (fieldList: FieldSelection[], parentPath: string[] = []): { field: FieldSelection; fullPath: string[] }[] => {
        return fieldList.filter(f => f.included).flatMap(field => {
            const currentPath = [...parentPath, ...field.path];

            // If it's an object field and we're flattening objects
            if (field.type === 'object' && opts.objectFormat === 'flatten') {
                const sampleValue = Array.isArray(data) ? data[0] : data;
                const value = getValueByPath(sampleValue, currentPath);

                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    // Return flattened object fields
                    return Object.keys(value).flatMap(key => {
                        const nestedValue = value[key];
                        const fieldType = typeof nestedValue === 'object' ?
                            (Array.isArray(nestedValue) ? 'array' : 'object') :
                            typeof nestedValue as any;

                        // If this is also an object and we're flattening, recurse
                        if (fieldType === 'object' && opts.objectFormat === 'flatten' &&
                            nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
                            // Create a synthetic field for recursion
                            const syntheticField: FieldSelection = {
                                name: `${field.name}['${key}']`,
                                path: [...currentPath, key],
                                type: 'object',
                                included: true,
                                level: field.level + 1
                            };
                            return getIncludedFields([syntheticField], []);
                        }

                        return [{
                            field: {
                                name: `${field.name}['${key}']`,
                                path: [...currentPath, key],
                                type: fieldType,
                                included: true,
                                level: field.level + 1
                            } as FieldSelection,
                            fullPath: [...currentPath, key]
                        }];
                    });
                }
            }

            // For non-object fields or when not flattening
            return [{
                field,
                fullPath: currentPath
            }];
        });
    };

    // Get all fields we need to include
    const includedFields = getIncludedFields(fields);

    // Generate header row
    const headerRow = includedFields
        .map(({ field }) => formatValueForCSV(field.name, delimiter))
        .join(delimiter);

    // Convert data to CSV rows
    const dataRows = Array.isArray(data) ? data : [data];
    const rows = dataRows.map(item =>
        includedFields
            .map(({ fullPath }) => {
                const value = getValueByPath(item, fullPath);
                return formatValueForCSV(processValue(value), delimiter);
            })
            .join(delimiter)
    );

    // Combine all rows
    return [headerRow, ...rows].join('\n');
}

/**
 * Exports data as CSV
 */
export function exportToCsv(exportData: ExportData, options?: SerializationOptions): void {
    const { filename } = exportData;

    const csv = toCsv(exportData, options);

    // Create and trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function formatValueForCSV(value: any, delimiter: string = ','): string {
    if (value === null || value === undefined) return '';

    const str = String(value);
    // Escape quotes and wrap in quotes if contains delimiter or quotes
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}