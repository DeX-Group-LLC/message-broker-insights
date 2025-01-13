import { CSVSerializationOptions, ExportData } from '../models/export.model';

/** Default CSV serialization options */
const defaultCSVOptions: CSVSerializationOptions = {
    arrayDelimiter: ',',
    maxArrayItems: 10,
    dateFormat: 'iso',
    objectFormat: 'json'
};

/**
 * Serializes a value based on its type
 */
function serializeValue(value: any, options: CSVSerializationOptions = {}): string {
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
 * Exports data as JSON
 */
export function exportToJson(exportData: ExportData): void {
    const jsonStr = JSON.stringify(exportData.data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    downloadBlob(blob, `${exportData.filename}-${new Date().toISOString()}.json`);
}

/**
 * Exports data as CSV
 */
export function exportToCsv(exportData: ExportData, options: CSVSerializationOptions = {}): void {
    if (!exportData.headers) {
        throw new Error('Headers are required for CSV export');
    }

    const opts = { ...defaultCSVOptions, ...options };
    const fields = Object.keys(exportData.headers);
    const headers = Object.values(exportData.headers);

    // Convert data to array if it's not already
    const dataArray = Array.isArray(exportData.data) ? exportData.data : [exportData.data];

    console.log(dataArray, headers, fields);

    // Create CSV rows
    const rows = [
        headers.join(','),
        ...dataArray.map(item =>
            fields
                .map(field => {
                    const value = field.split('.').reduce((obj, key) => obj?.[key], item);
                    const serialized = serializeValue(value, opts);
                    // Escape commas and quotes
                    return `"${serialized.replace(/"/g, '""')}"`;
                })
                .join(',')
        )
    ];

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${exportData.filename}-${new Date().toISOString()}.csv`);
}