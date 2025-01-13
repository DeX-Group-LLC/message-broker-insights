import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ExportCustomizerComponent } from '../../components/export/customizer/customizer.component';
import { ExportData, SerializationOptions } from '../../components/export/models/export.model';
import { exportToCsv, exportToJson, toCsv, toJson } from '../../components/export/utils/export.utils';

/**
 * Reusable component for export functionality
 * Provides a consistent export menu across the application
 */
@Component({
    selector: 'app-export',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatTooltipModule,
        MatDialogModule,
        MatSnackBarModule
    ],
    templateUrl: './export.component.html',
    styleUrls: ['./export.component.scss']
})
export class ExportComponent {
    /** The data to export */
    @Input() data: any;
    /** The filename to use for the export */
    @Input() filename: string = 'export';
    /** Whether to show the customize button */
    @Input() customizable: boolean = false;
    /** Which export formats to show */
    @Input() formats: ('csv' | 'json')[] = ['csv', 'json'];
    /** Where to render the export trigger */
    @Input() position: 'button' | 'menu-item' = 'button';
    /** Icon to show for the export trigger */
    @Input() icon: string = 'download';
    /** Tooltip to show on hover */
    @Input() tooltip: string = 'Export';
    /** Whether the export functionality is disabled */
    @Input() disabled: boolean = false;
    /** Default CSV serialization options */
    @Input() defaultOptions?: SerializationOptions;

    constructor(
        private dialog: MatDialog,
        private snackBar: MatSnackBar
    ) {}

    /**
     * Gets the export data in the required format
     */
    private getExportData(): ExportData {
        return {
            data: this.data,
            filename: this.filename
        };
    }

    /**
     * Opens the export customizer dialog
     */
    openCustomizer(event: MouseEvent, format: 'csv' | 'json'): void {
        // Prevent the menu from closing
        event.stopPropagation();

        const exportData = this.getExportData();
        const dialogRef = this.dialog.open(ExportCustomizerComponent, {
            data: {
                exportData,
                options: this.defaultOptions,
                format
            },
            minWidth: '600px',
            maxWidth: '90vw'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                if (format === 'csv') {
                    exportToCsv(result.exportData, result.options);
                } else {
                    exportToJson(result.exportData);
                }
            }
        });
    }

    /**
     * Exports the data as CSV
     */
    exportCsv(): void {
        const exportData = this.getExportData();
        exportToCsv(exportData, this.defaultOptions);
    }

    /**
     * Exports the data as JSON
     */
    exportJson(): void {
        const exportData = this.getExportData();
        exportToJson(exportData);
    }

    /**
     * Copies the data as CSV to clipboard
     */
    copyCsv(): void {
        const exportData = this.getExportData();
        const csv = toCsv(exportData, this.defaultOptions);
        navigator.clipboard.writeText(csv).then(() => {
            this.snackBar.open('CSV copied to clipboard', 'Close', {
                duration: 2000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom'
            });
        });
    }

    /**
     * Copies the data as JSON to clipboard
     */
    copyJson(): void {
        const exportData = this.getExportData();
        const json = toJson(exportData.data);
        navigator.clipboard.writeText(json).then(() => {
            this.snackBar.open('JSON copied to clipboard', 'Close', {
                duration: 2000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom'
            });
        });
    }
}