/**
 * Configuration options for CSV serialization
 */
export interface SerializationOptions {
    /** Delimiter for array values. Defaults to ',' */
    arrayDelimiter?: string;
    /** Maximum number of array items before truncating. Defaults to 10 */
    maxArrayItems?: number;
    /** Date format for serialization. Defaults to 'iso' */
    dateFormat?: 'iso' | 'local' | 'unix';
    /** How to format array values. Defaults to 'json' */
    arrayFormat?: 'json' | 'comma-list';
    /** How to format object values. Defaults to 'json' */
    objectFormat?: 'json' | 'flatten';
    /** Field delimiter for CSV export. Defaults to ',' */
    fieldDelimiter?: ',' | ';' | '\t' | ' ' | '|';
}

/**
 * Field selection for export customization
 */
export interface FieldSelection {
    name: string;
    path: string[];
    included: boolean;
    type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'null';
    children?: FieldSelection[];
    parent?: FieldSelection;
    level: number;
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
    headers?: string[][];
    /** Available fields for customization */
    fields?: FieldSelection[];
}

/**
 * Data passed to the export customizer dialog
 */
export interface ExportCustomizerData {
    /** The data to be exported */
    exportData: ExportData;
    /** Current serialization options */
    options?: SerializationOptions;
    /** Available fields for customization */
    fields?: string[];
}