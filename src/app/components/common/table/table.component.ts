import {
    Component,
    Input,
    ViewChild,
    ContentChildren,
    QueryList,
    TemplateRef,
    AfterViewInit,
    ContentChild,
    Output,
    EventEmitter,
    OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, Subscription } from 'rxjs';
import { SelectionModel } from '@angular/cdk/collections';

/**
 * Configuration for table pagination
 */
export interface TablePaginationConfig {
    /** Page size options to show in dropdown */
    pageSizeOptions?: number[];
    /** Default page size */
    defaultPageSize?: number;
    /** Whether to show first/last page buttons */
    showFirstLastButtons?: boolean;
    /** Whether to enable pagination */
    enabled?: boolean;
}

/**
 * Configuration for table columns
 */
export interface TableColumn {
    /** Column name/key */
    name: string;
    /** Display label for column header */
    label: string;
    /** Whether column is sortable */
    sortable?: boolean;
    /** Whether column supports filtering, optionally with a custom filter function */
    filterable?: boolean | ((row: any, filterValue: string) => boolean);
    /** Whether column can trigger expansion */
    expandable?: boolean;
}

/**
 * Configuration for table sorting
 */
export interface TableSortConfig {
    /** Column to sort by */
    active: string;
    /** Sort direction */
    direction: 'asc' | 'desc';
}

/**
 * Reusable table component that supports sorting, filtering, pagination, and expandable rows
 */
@Component({
    selector: 'app-table',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatTableModule,
        MatSortModule,
        MatPaginatorModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatMenuModule,
        MatFormFieldModule,
        MatInputModule,
        MatTooltipModule,
        MatCheckboxModule
    ],
    templateUrl: './table.component.html',
    styleUrls: ['./table.component.scss'],
    animations: [
        trigger('detailExpand', [
            state('collapsed', style({ height: '0px', minHeight: '0' })),
            state('expanded', style({ height: '*' })),
            transition('expanded <=> collapsed', animate('150ms ease')),
        ]),
    ],
})
export class TableComponent implements AfterViewInit, OnDestroy {
    /** Data source for the table */
    dataSource = new MatTableDataSource<any>([]);

    /** Column configurations */
    @Input() columns: TableColumn[] = [];

    /** Observable data source */
    @Input() data$?: Observable<any[]>;

    /** Subscription for data updates */
    private dataSubscription?: Subscription;

    /** Message to show when no data is available */
    @Input() noDataMessage = 'No data available';

    /** Pagination configuration */
    @Input() paginationConfig?: TablePaginationConfig;

    /** Function to determine if a row can be expanded */
    @Input() canExpand: (row: any) => boolean = () => false;

    /** Function to determine if a row can be selected */
    @Input() canSelect: (row: any) => boolean = () => true;

    /** Whether multiple rows can be expanded simultaneously */
    multiExpand = false;

    /** Whether data updates are paused */
    isPaused = false;

    /** Whether data is being loaded */
    loading = false;

    /** Cached data while paused */
    private cachedData: any[] = [];

    /** Template for expanded content */
    @ContentChild('expandedContent') expandedTemplate!: TemplateRef<any>;

    /** Cell template */
    @ContentChild('cellTemplate') cellTemplate!: TemplateRef<any>;

    /** Event emitted when a row is expanded/collapsed */
    @Output() rowExpanded = new EventEmitter<any>();

    /** Map of active filters */
    filters = new Map<string, string>();

    /** Reference to the paginator */
    @ViewChild(MatPaginator) paginator!: MatPaginator;

    /** Reference to the sort header */
    @ViewChild(MatSort) sort!: MatSort;

    /** Set of expanded rows */
    expandedRows = new Set<any>();

    /** Default sort configuration */
    @Input() defaultSort?: TableSortConfig;

    /** Optional custom refresh function */
    @Input() refreshFn?: () => Promise<any[]>;

    /** Event emitted when pause state changes */
    @Output() onPauseStateChange = new EventEmitter<boolean>();

    /** Event emitted when refresh is requested */
    @Output() onRefresh = new EventEmitter<void>();

    @Output() onDataChange = new EventEmitter<any[]>();

    /** Whether row selection is enabled */
    @Input() selectable = false;

    /** Whether multiple rows can be selected */
    @Input()
    set multiSelect(value: boolean) {
        // Create a new selection model with the updated multiple setting
        const selected = this.selection?.selected || [];
        this.selection = new SelectionModel<any>(value, selected);
        this._multiSelect = value;
    }
    get multiSelect(): boolean {
        return this._multiSelect;
    }
    private _multiSelect = false;

    /** Event emitted when selection changes */
    @Output() selectionChange = new EventEmitter<any[]>();

    /** Selection model for managing selected rows */
    selection = new SelectionModel<any>(false, []);

    /** Displayed columns including selection if enabled */
    get displayedColumns(): string[] {
        const columns = this.columns.map(col => col.name);
        return this.selectable ? ['select', ...columns] : columns;
    }

    /**
     * Updates the data source with new data
     * @param data - New data to display
     */
    @Input()
    set data(data: any[]) {
        this.cachedData = data;
        if (!this.isPaused) {
            this.dataSource.data = data;
        }
    }

    /**
     * Gets the current data
     */
    get data(): any[] {
        return this.dataSource.data;
    }

    ngAfterViewInit() {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;

        setTimeout(() => {
            // Apply default sort if specified
            if (this.defaultSort && this.sort) {
                const { active, direction } = this.defaultSort;
                this.sort.sort({
                    id: active,
                    start: direction,
                    disableClear: false
                });
            }

            this.setupFilterPredicate();
            this.setupDataSubscription();
        });
    }

    ngOnDestroy() {
        this.dataSubscription?.unsubscribe();
    }

    /**
     * Sets up subscription to data updates
     */
    private setupDataSubscription() {
        this.dataSubscription?.unsubscribe();
        if (this.data$) {
            this.dataSubscription = this.data$.subscribe(data => {
                this.cachedData = data;
                this.onDataChange.emit(data);
                if (!this.isPaused) {
                    this.dataSource.data = data;
                }
            });
        }
    }

    /**
     * Sets up the filter predicate to use column-specific filter functions
     */
    private setupFilterPredicate() {
        this.dataSource.filterPredicate = (data: any, filter: string) => {
            for (const [columnName, filterValue] of this.filters.entries()) {
                if (!filterValue) continue;

                const column = this.columns.find(col => col.name === columnName);
                if (!column) continue;

                if (column.filterable instanceof Function) {
                    if (!column.filterable(data, filterValue)) return false;
                } else {
                    // Default filter behavior: string includes
                    const value = data[columnName];
                    if (value === undefined || value === null) return false;

                    // Special handling for objects (like meta)
                    if (typeof value === 'object') {
                        const stringified = JSON.stringify(value).toLowerCase();
                        if (!stringified.includes(filterValue.toLowerCase())) return false;
                    } else {
                        // Regular string comparison for non-objects
                        if (!value.toString().toLowerCase().includes(filterValue.toLowerCase())) return false;
                    }
                }
            }
            return true;
        };
    }

    /**
     * Checks if a row is expanded
     * @param row - Row to check
     * @returns Whether the row is expanded
     */
    isExpanded(row: any): boolean {
        return this.expandedRows.has(row);
    }

    /** Predicate function for determining if a detail row should be rendered */
    isRowExpanded = (index: number, row: any): boolean => {
        return this.expandedRows.has(row);
    };

    /**
     * Toggles multi-expand functionality.
     */
    toggleMultiExpand(): void {
        this.multiExpand = !this.multiExpand;
        if (!this.multiExpand) {
            // Keep only the last expanded row when disabling multi-expand
            this.expandedRows.clear();
        }
    }

    /**
     * Handles row click events
     * @param row - Clicked row
     */
    handleRowClick(row: any): void {
        // If row is expandable, handle expansion
        if (this.canExpand(row)) {
            if (this.isExpanded(row)) {
                this.expandedRows.delete(row);
            } else {
                if (!this.multiExpand) {
                    this.expandedRows.clear();
                }
                this.expandedRows.add(row);
            }
            this.rowExpanded.emit(row);
            return;
        }

        // If row is selectable but not expandable, handle selection
        if (this.selectable && this.canSelect(row)) {
            this.toggleSelection(row);
        }
    }

    /**
     * Checks if a column has an active filter
     * @param columnName - Name of the column
     * @returns Whether the column has an active filter
     */
    hasColumnFilter(columnName: string): boolean {
        return !!this.filters.get(columnName);
    }

    /**
     * Sets a filter value for a column
     * @param columnName - Name of the column
     * @param value - Filter value
     */
    setFilter(columnName: string, value: string): void {
        if (value) {
            this.filters.set(columnName, value);
        } else {
            this.filters.delete(columnName);
        }
        this.applyFilters();
    }

    /**
     * Clears all filters
     */
    clearFilters(): void {
        this.filters.clear();
        this.applyFilters();
    }

    /**
     * Applies current filters to the data source
     */
    private applyFilters(): void {
        this.dataSource.filter = JSON.stringify(Array.from(this.filters.entries()));
    }

    /**
     * Toggles the pause state
     */
    togglePause(): void {
        this.isPaused = !this.isPaused;
        if (!this.isPaused) {
            // When unpausing, update with the latest cached data
            this.dataSource.data = this.cachedData;
        }
    }

    /**
     * Triggers a refresh of the data
     */
    async refreshData(): Promise<void> {
        if (!this.isPaused) return;

        try {
            this.loading = true;

            if (this.refreshFn) {
                // Use custom refresh function
                const newData = await this.refreshFn();
                this.cachedData = newData;
                this.dataSource.data = newData;
            } else {
                // Use default refresh behavior
                this.dataSource.data = this.cachedData;
            }
        } finally {
            this.loading = false;
        }
    }

    /**
     * Whether all rows are selected
     */
    isAllSelected(): boolean {
        const numSelected = this.selection.selected.length;
        const numSelectableRows = this.dataSource.data.filter(row => this.canSelect(row)).length;
        return numSelected === numSelectableRows && numSelectableRows > 0;
    }

    /**
     * Selects all rows if they are not all selected; otherwise clear selection
     */
    masterToggle(): void {
        if (this.isAllSelected()) {
            this.selection.clear();
        } else {
            this.dataSource.data
                .filter(row => this.canSelect(row))
                .forEach(row => this.selection.select(row));
        }
        this.selectionChange.emit(this.selection.selected);
    }

    /**
     * Toggles selection of a row
     * @param row - Row to toggle
     * @param event - Click event
     */
    toggleSelection(row: any, event?: MouseEvent): void {
        event?.stopPropagation();

        if (!this.canSelect(row)) return;

        if (!this.multiSelect) {
            // If the row is already selected, just clear selection
            if (this.selection.isSelected(row)) {
                this.selection.clear();
            } else {
                // Otherwise clear and select the new row
                this.selection.clear();
                this.selection.select(row);
            }
        } else {
            this.selection.toggle(row);
        }

        this.selectionChange.emit(this.selection.selected);
    }

    /**
     * Clears the current selection and emits the change
     */
    clearSelection(): void {
        this.selection.clear();
        this.selectionChange.emit(this.selection.selected);
    }
}