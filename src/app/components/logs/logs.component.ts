import { Component, OnInit, ViewChild, OnDestroy, AfterViewInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule, MatMenu } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { Subject, Subscription, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { LogService, LogEntry, LogLevel } from '../../services/log.service';
import { TimeFormatService } from '../../services/time-format.service';
import { LayoutComponent } from '../layout/layout.component';
import { ExportComponent } from '../export/export.component';
import { TableComponent, TableColumn } from '../common/table/table.component';

/**
 * Component for displaying and managing log entries.
 * Provides filtering, sorting, and expansion functionality for log entries.
 */
@Component({
    selector: 'app-logs',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatMenuModule,
        MatFormFieldModule,
        MatInputModule,
        MatTooltipModule,
        MatSelectModule,
        ExportComponent,
        TableComponent
    ],
    templateUrl: './logs.component.html',
    styleUrls: ['./logs.component.scss']
})
export class LogsComponent implements AfterViewInit, OnDestroy {
    /** Column configurations */
    columns: TableColumn[] = [
        { name: 'timestamp', label: 'Timestamp', sortable: true, filterable: true },
        { name: 'level', label: 'Level', sortable: true, filterable: true },
        { name: 'module', label: 'Module', sortable: true, filterable: true },
        { name: 'message', label: 'Message', sortable: true, filterable: true },
        { name: 'meta', label: 'Meta', sortable: false, filterable: true }
    ];

    @ViewChild('toolbarContent') toolbarContent?: TemplateRef<any>;
    @ViewChild(TableComponent) table!: TableComponent;

    /** Available log levels for the selector */
    logLevels = Object.values(LogLevel);

    /** Current minimum log level */
    currentLogLevel = LogLevel.INFO;

    constructor(
        public logService: LogService,
        private timeFormatService: TimeFormatService,
        private layout: LayoutComponent
    ) {
        this.logService.minLogLevel$.subscribe(level => {
            this.currentLogLevel = level;
        });
    }

    ngAfterViewInit() {
        setTimeout(() => {
            if (this.toolbarContent) {
                this.layout.activeToolbarContent = this.toolbarContent;
            }
        });
    }

    ngOnDestroy() {
        this.layout.activeToolbarContent = undefined;
    }

    /**
     * Gets a preview of metadata content
     * @param meta - Metadata object
     * @returns String preview of metadata
     */
    getMetaPreview(meta: any): string {
        const stringifiedMeta = JSON.stringify(meta);
        return stringifiedMeta.length > 50 ? stringifiedMeta.slice(0, 50) + '...' : stringifiedMeta;
    }

    /**
     * Checks if a row has metadata
     * @param row - Row to check
     * @returns Whether the row has metadata
     */
    hasMetaData = (row: LogEntry): boolean => {
        return !!row.meta;
    };

    /**
     * Gets formatted date string
     * @param timestamp - Date to format
     * @returns Formatted date string
     */
    getFormattedDate(timestamp: Date): string {
        return timestamp.toLocaleString();
    }

    /**
     * Gets elapsed time string
     * @param timestamp - Date to get elapsed time from
     * @returns Elapsed time string
     */
    getElapsedTime(timestamp: Date): string {
        return this.timeFormatService.getElapsedTime(timestamp);
    }

    /**
     * Clears log history
     */
    clearHistory(): void {
        this.logService.clearLogs();
    }

    /**
     * Updates the minimum log level
     * @param level - New minimum log level
     */
    onLogLevelChange(level: LogLevel): void {
        this.logService.setMinLogLevel(level);
    }

    /**
     * Checks if a row is expanded
     * @param row - Row to check
     * @returns Whether the row is expanded
     */
    isExpanded(row: LogEntry): boolean {
        return this.table.isExpanded(row);
    }
}
