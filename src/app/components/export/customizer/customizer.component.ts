import { Component, Inject, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { CSVSerializationOptions, ExportData } from '../models/export.model';
import { exportToCsv, exportToJson } from '../utils/export.utils';

interface CustomizerData {
    exportData: ExportData;
    options?: CSVSerializationOptions;
    fields?: string[];
    format: 'csv' | 'json';
}

interface FieldSelection {
    name: string;
    path: string[];
    included: boolean;
    type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'null';
    children?: FieldSelection[];
    parent?: FieldSelection;
    level: number;
}

@Component({
    selector: 'app-export-customizer',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatButtonModule,
        MatCheckboxModule,
        MatExpansionModule,
        MatFormFieldModule,
        MatSelectModule
    ],
    templateUrl: './customizer.component.html',
    styleUrls: ['./customizer.component.scss']
})
export class ExportCustomizerComponent implements OnInit, AfterViewInit {
    selectedFields: FieldSelection[] = [];
    options: CSVSerializationOptions;
    preview: string = '';

    constructor(
        public dialogRef: MatDialogRef<ExportCustomizerComponent>,
        @Inject(MAT_DIALOG_DATA) public data: CustomizerData
    ) {
        // Initialize options with defaults or provided values
        this.options = {
            dateFormat: 'iso',
            arrayDelimiter: ',',
            maxArrayItems: 10,
            objectFormat: 'json',
            ...data.options
        };
    }

    ngOnInit(): void {
        this.initializeFieldSelection();
        this.updatePreview();
    }

    ngAfterViewInit(): void {
        // Set up ResizeObserver to update options section height
        const fieldsSection = document.querySelector('.fields-section');
        if (fieldsSection) {
            const resizeObserver = new ResizeObserver(entries => {
                for (const entry of entries) {
                    document.documentElement.style.setProperty('--fields-height', `${entry.contentRect.height}px`);
                }
            });
            resizeObserver.observe(fieldsSection);
        }
    }

    /**
     * Analyzes the data structure and creates a hierarchical field selection
     */
    private initializeFieldSelection(): void {
        console.log('initializing field selection', this.data.exportData.data);

        if (Array.isArray(this.data.exportData.data)) {
            // Sample up to 10 items, evenly distributed through the array
            const data = this.data.exportData.data;
            const sampleSize = Math.min(10000, data.length);
            const step = Math.max(1, Math.floor(data.length / sampleSize));
            const samples = Array.from({ length: sampleSize }, (_, i) => data[i * step]);

            // Merge the structures of all samples
            this.selectedFields = samples.reduce((mergedFields, sample) => {
                const sampleFields = this.analyzeStructure(sample);
                return this.mergeFieldStructures(mergedFields, sampleFields);
            }, [] as FieldSelection[]);
        } else {
            this.selectedFields = this.analyzeStructure(this.data.exportData.data);
        }
    }

    /**
     * Merges two field structures, combining their children and preserving all unique fields
     */
    private mergeFieldStructures(fields1: FieldSelection[], fields2: FieldSelection[]): FieldSelection[] {
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
                    existing.children = this.mergeFieldStructures(
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
     * Recursively analyzes an object's structure to create field selections
     */
    private analyzeStructure(obj: any, parentPath: string[] = [], level: number = 0): FieldSelection[] {
        if (!obj || typeof obj !== 'object') return [];

        return Object.entries(obj).map(([key, value]): FieldSelection => {
            const path = [...parentPath, key];
            const type = this.getValueType(value);
            const field: FieldSelection = {
                name: key,
                path,
                included: true,
                type,
                level,
                children: []
            };

            if (type === 'object' && value) {
                field.children = this.analyzeStructure(value, path, level + 1);
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
                        const sampleFields = this.analyzeStructure(sample, path, level + 1);
                        return this.mergeFieldStructures(mergedFields, sampleFields);
                    }, [] as FieldSelection[]);

                    field.children?.forEach(child => child.parent = field);
                }
            }

            return field;
        });
    }

    /**
     * Determines the type of a value
     */
    private getValueType(value: any): 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'null' {
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
     * Toggles selection of a field and its children
     */
    toggleField(field: FieldSelection, event?: any): void {
        // Prevent event from reaching parent checkboxes
        if (event) {
            event.stopPropagation?.();
        }

        if (field.children) {
            this.setChildrenSelection(field.children, field.included);
        }
        this.updateParentSelection(field);
        this.updatePreview();
    }

    /**
     * Recursively sets selection state of child fields
     */
    private setChildrenSelection(children: FieldSelection[], included: boolean): void {
        for (const child of children) {
            console.log('setting child selection', child, included);
            child.included = included;
            if (child.children) {
                this.setChildrenSelection(child.children, included);
            }
        }
    }

    /**
     * Updates parent selection based on children's state
     */
    private updateParentSelection(field: FieldSelection): void {
        if (!field.parent) return;

        const siblings = field.parent.children || [];
        const allSelected = siblings.every(f => f.included);
        const noneSelected = siblings.every(f => !f.included);

        field.parent.included = allSelected;
        if (!allSelected && !noneSelected) {
            field.parent.included = true; // Indeterminate state
        }

        this.updateParentSelection(field.parent);
    }

    /**
     * Gets all selected field paths
     */
    private getSelectedPaths(): string[][] {
        const paths: string[][] = [];
        const traverse = (fields: FieldSelection[]) => {
            fields.forEach(field => {
                if (field.included) {
                    // Include the field if it's not an object/array or if it has no children
                    if (field.type !== 'object' && field.type !== 'array' || !field.children?.length) {
                        paths.push(field.path);
                    }
                    if (field.children) {
                        traverse(field.children);
                    }
                }
            });
        };
        traverse(this.selectedFields);
        return paths;
    }

    /**
     * Gets a preview value for a field
     */
    getPreviewValue(field: FieldSelection): string {
        const sampleData = Array.isArray(this.data.exportData.data)
            ? this.data.exportData.data[0]
            : this.data.exportData.data;

        const value = field.path.reduce((obj, key) => obj?.[key], sampleData);

        if (value === undefined || value === null) return 'null';
        if (value instanceof Date) return value.toISOString();
        if (typeof value === 'string') return `"${value.length > 20 ? value.slice(0, 20) + '...' : value}"`;
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'boolean') return value.toString();
        if (Array.isArray(value)) {
            const preview = value.slice(0, 2).map(item => {
                if (typeof item === 'object') return '{...}';
                return String(item);
            }).join(', ');
            return `[${preview}${value.length > 2 ? ', ...' : ''}]`;
        }
        if (typeof value === 'object') {
            const keys = Object.keys(value);
            if (keys.length === 0) return '{}';
            return `{ ${keys[0]}: ..., ${keys.length > 1 ? '...' : ''} }`;
        }
        return String(value);
    }

    /**
     * Converts a camelCase or snake_case string to Title Case
     */
    private toTitleCase(str: string): string {
        // First handle snake_case
        const spacedStr = str.replace(/_/g, ' ');

        // Then handle camelCase
        const withSpaces = spacedStr.replace(/([A-Z])/g, ' $1');

        // Convert to title case
        return withSpaces
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
            .trim();
    }

    /**
     * Gets the filtered export data based on field selection
     */
    private getExportData(): ExportData {
        const includedPaths = this.getSelectedPaths();

        // Filter the data to only include selected fields
        const filteredData = Array.isArray(this.data.exportData.data)
            ? this.data.exportData.data.map(item => this.filterObjectByPaths(item, includedPaths))
            : this.filterObjectByPaths(this.data.exportData.data, includedPaths);

        // Generate headers from the field paths
        const headers = includedPaths.reduce((acc, path) => {
            const lastPart = path[path.length - 1] || '';
            acc[path.join('.')] = lastPart;//this.toTitleCase(lastPart);
            return acc;
        }, {} as Record<string, string>);

        return {
            data: filteredData,
            filename: this.data.exportData.filename,
            headers
        };
    }

    /**
     * Filters an object to only include specified paths
     */
    private filterObjectByPaths(obj: any, paths: string[][]): any {
        if (!obj) return obj;

        const result: any = {};
        paths.forEach(path => {
            const value = path.reduce((o, key) => {
                if (o === undefined || o === null) return o;
                // Handle array indices in path
                if (Array.isArray(o) && !isNaN(Number(key))) {
                    return o[Number(key)];
                }
                return o[key];
            }, obj);

            if (value !== undefined) {
                // For objects and arrays, clone the entire structure
                const finalValue = typeof value === 'object' && value !== null
                    ? JSON.parse(JSON.stringify(value))
                    : value;

                // Build the nested structure
                let current = result;
                path.forEach((key, index) => {
                    if (index === path.length - 1) {
                        current[key] = finalValue;
                    } else {
                        if (!(key in current)) {
                            // Check if next key is a number to determine if we need an array
                            const nextKey = path[index + 1];
                            current[key] = !isNaN(Number(nextKey)) ? [] : {};
                        }
                        current = current[key];
                    }
                });
            }
        });
        return result;
    }

    /**
     * Updates the preview based on current selection and options
     */
    updatePreview(): void {
        const exportData = this.getExportData();

        try {
            if (this.data.format === 'csv' && exportData.headers) {
                // Generate CSV preview string
                const [fields, headers] = Object.entries(exportData.headers).reduce((acc, [key, value]) => {
                    acc[0].push(key);
                    acc[1].push(value);
                    return acc;
                }, [[], []] as [string[], string[]]);
                const dataArray = Array.isArray(exportData.data) ? exportData.data.slice(0, 3) : [exportData.data];

                const rows = [
                    headers.join(','),
                    ...dataArray.map(item =>
                        fields
                            .map(field => {
                                const value = field.split('.').reduce((obj, key) => obj?.[key], item);
                                // Handle undefined/null values
                                if (value === undefined || value === null) {
                                    return '""';
                                }
                                // Handle dates
                                if (value instanceof Date) {
                                    return `"${value.toISOString()}"`;
                                }
                                // Handle arrays
                                if (Array.isArray(value)) {
                                    const maxItems = this.options.maxArrayItems || 10;
                                    const items = value.slice(0, maxItems);
                                    const remaining = value.length - maxItems;
                                    const delimiter = this.options.arrayDelimiter || ',';
                                    const serialized = items.map(v => String(v || '')).join(delimiter);
                                    const result = remaining > 0
                                        ? `${serialized}${delimiter}... and ${remaining} more`
                                        : serialized;
                                    return `"${result}"`;
                                }
                                // Handle objects
                                if (typeof value === 'object') {
                                    return `"${JSON.stringify(value)}"`;
                                }
                                // Handle other values
                                return `"${String(value).replace(/"/g, '""')}"`;
                            })
                            .join(',')
                    )
                ];

                this.preview = rows.join('\n');
            } else {
                // For JSON, just stringify the first item with formatting
                const previewData = Array.isArray(exportData.data)
                    ? exportData.data.slice(0, 3)
                    : [exportData.data];
                this.preview = JSON.stringify(previewData, null, 2);
            }
        } catch (error) {
            this.preview = 'Error generating preview';
            console.error('Preview generation error:', error);
        }
    }

    /**
     * Saves the customized export configuration and closes the dialog
     */
    save(): void {
        this.dialogRef.close({
            exportData: this.getExportData(),
            options: this.options
        });
    }

    /**
     * Checks if a field should be in an indeterminate state
     */
    isFieldIndeterminate(field: FieldSelection): boolean {
        if (!field.children?.length) return false;
        const selectedCount = field.children.filter(f => f.included).length;
        return selectedCount > 0 && selectedCount < field.children.length;
    }
}