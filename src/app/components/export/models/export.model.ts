/**
 * Configuration options for CSV serialization
 */
export interface CSVSerializationOptions {
    /** Delimiter for array values. Defaults to ',' */
    arrayDelimiter?: string;
    /** Maximum number of array items before truncating. Defaults to 10 */
    maxArrayItems?: number;
    /** Date format for serialization. Defaults to 'iso' */
    dateFormat?: 'iso' | 'local' | 'unix';
    /** How to format object values. Defaults to 'json' */
    objectFormat?: 'json' | 'flatten' | 'keyValue';
}

/**
 * Data structure for export operations
 */
export interface ExportData {
    /** The data to be exported */
    data: any;
    /** Base filename for the export (without extension) */
    filename: string;
    /** Column headers for CSV export (key: display name, value: data field) */
    headers?: Record<string, string>;
}

/**
 * Data passed to the export customizer dialog
 */
export interface ExportCustomizerData {
    /** The data to be exported */
    exportData: ExportData;
    /** Current serialization options */
    options?: CSVSerializationOptions;
    /** Available fields for customization */
    fields?: string[];
}