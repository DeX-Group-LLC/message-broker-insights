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
    OnDestroy,
    ViewChildren
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
import { fastClone } from './utils/table.utils';

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
    @Input() canExpand?: (row: any) => boolean;

    /** Function to determine if a row can be selected */
    @Input() canSelect: (row: any) => boolean = () => true;

    /** Function to get the group name for a row. If not provided, no grouping is used */
    @Input() getGroupName?: (row: any) => string | undefined;

    /** Column to display group names in. Defaults to first column if not specified */
    @Input() groupDisplayColumn?: string;

    /** Map of group names to their rows */
    private groupedData = new Map<string, any[]>();

    /** Map of group names to their group row objects */
    private groupRows = new Map<string, any>();

    /** List of group names in current sort order */
    private groupNames: (string | any)[] = [];

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

    /** References to all menu triggers */
    @ViewChildren('filterMenuTrigger') filterMenuTriggers!: QueryList<any>;

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
        const prefixColumns = [];
        if (this.selectable) prefixColumns.push('select');
        if (this.getGroupName) prefixColumns.push('expand');
        return [...prefixColumns, ...columns];
    }

    /**
     * Updates the data source with new data
     * @param data - New data to display
     */
    @Input()
    set data(data: any[]) {
        this.cachedData = data;
        if (!this.isPaused) {
            this.updateDataSource(data);
        }
    }

    /**
     * Gets the current data, excluding group rows and respecting filters and sorting
     */
    get data(): any[] {
        // Start with cached data (unfiltered, unsorted)
        let result = this.processData(fastClone(this.cachedData), false);
        // Sort:
        if (this.sort?.active && this.sort.direction !== '') {
            result.sort((a, b) => {
                return this.compareValues(a[this.sort.active], b[this.sort.active])
                    * (this.sort.direction === 'asc' ? 1 : -1);
            });
        }
        return result;
    }

    private processData(data: any[], shouldGroup: boolean = true): any[] {
        // First apply any active filters
        let filteredData = data;
        if (this.filters.size > 0) {
            const filterString = JSON.stringify(Array.from(this.filters.entries()));
            filteredData = data.filter(row =>
                !this.isGroupRow(row) && this.dataSource.filterPredicate(row, filterString)
            );
        }

        if (!this.getGroupName || !shouldGroup) {
            // No grouping, use filtered data as is
            return filteredData;
        }

        // Clear existing groups but preserve group row objects
        this.groupedData.clear();
        this.groupNames = [];

        // Group the filtered data
        filteredData.forEach(row => {
            if (this.isGroupRow(row)) return; // Skip group rows in input data

            const groupName = this.getGroupName!(row);

            if (!groupName) {
                // No group, add directly to data
                this.groupNames.push(row);
                return;
            }

            if (!this.groupedData.has(groupName)) {
                this.groupedData.set(groupName, []);
                this.groupNames.push(groupName);

                // Create or reuse group row object
                if (!this.groupRows.has(groupName)) {
                    this.groupRows.set(groupName, {
                        __isGroup: true,
                        name: groupName,
                        count: 0
                    });
                }
            }
            this.groupedData.get(groupName)!.push(row);
        });

        // Create the flattened data array with group rows
        const flattenedData: any[] = [];
        this.groupNames.forEach(nameOrRow => {
            if (typeof nameOrRow === 'string') {
                // Add group row
                const groupRows = this.groupedData.get(nameOrRow)!;
                const groupRow = this.groupRows.get(nameOrRow)!;
                groupRow.count = groupRows.length;
                flattenedData.push(groupRow);

                // Add child rows if group is expanded
                if (this.expandedRows.has(groupRow)) {
                    flattenedData.push(...groupRows);
                }
            } else {
                // Add ungrouped row
                flattenedData.push(nameOrRow);
            }
        });

        // Clean up any old group rows
        for (const [groupName] of this.groupRows) {
            if (!this.groupedData.has(groupName)) {
                this.groupRows.delete(groupName);
            }
        }

        return flattenedData;
    }

    /**
     * Updates the data source with new data, handling grouping if enabled
     * @param data - The data to update with
     */
    private updateDataSource(data: any[], shouldGroup: boolean = true): void {
        this.dataSource.data = this.processData(data, shouldGroup);;
    }

    ngAfterViewInit() {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;

        // Set up custom sort function
        this.dataSource.sortData = (data: any[], sort: MatSort) => {
            const active = sort.active;
            const direction = sort.direction;

            if (!active || direction === '') {
                return data;
            }

            return data.sort((a, b) => {
                // If we have grouping enabled
                if (this.getGroupName) {
                    const aIsGroup = this.isGroupRow(a);
                    const bIsGroup = this.isGroupRow(b);

                    // Get group names (for both group rows and regular rows)
                    const aGroupName = aIsGroup ? a.name : this.getGroupName(a) || '';
                    const bGroupName = bIsGroup ? b.name : this.getGroupName(b) || '';

                    // 1. First sort by group name
                    if (aGroupName !== bGroupName) {
                        return (aGroupName < bGroupName ? -1 : 1) * (direction === 'asc' ? 1 : -1);
                    }

                    // 2. Within same group, group rows come before non-group rows
                    if (aIsGroup !== bIsGroup) {
                        return aIsGroup ? -1 : 1;
                    }

                    // 3. For non-group rows within same group, sort by column
                    if (!aIsGroup) {
                        return this.compareValues(this.getNestedValue(a, active), this.getNestedValue(b, active)) * (direction === 'asc' ? 1 : -1);
                    }

                    // Group rows with same name maintain their order
                    return 0;
                }

                // If no grouping, just sort by the column
                return this.compareValues(this.getNestedValue(a, active), this.getNestedValue(b, active)) * (direction === 'asc' ? 1 : -1);
            });
        };

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

    /**
     * Compares two values for sorting
     */
    private compareValues(a: any, b: any): number {
        // Handle undefined/null values
        if (a === undefined || a === null) return -1;
        if (b === undefined || b === null) return 1;
        if (a === undefined || a === null || b === undefined || b === null) {
            return 0;
        }

        // Handle dates
        if (a instanceof Date && b instanceof Date) {
            return a.getTime() - b.getTime();
        }

        // Handle numbers
        if (typeof a === 'number' && typeof b === 'number') {
            return a < b ? -1 : (a > b ? 1 : 0);
        }

        // Handle strings
        const aStr = String(a).toLowerCase();
        const bStr = String(b).toLowerCase();
        return aStr < bStr ? -1 : (aStr > bStr ? 1 : 0);
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
                    this.updateDataSource(data);
                }
            });
        }
    }

    /**
     * Sets up the filter predicate to use column-specific filter functions
     */
    private setupFilterPredicate() {
        this.dataSource.filterPredicate = (data: any, filter: string) => {
            // Don't filter group rows - they will be handled in applyFilters
            if (this.isGroupRow(data)) {
                return true;
            }

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
            // When disabling multi-expand, collapse all expanded rows
            this.expandedRows.clear();
            this.updateDataSource(this.cachedData);
        }
    }

    /**
     * Handles row click events
     * @param row - Clicked row
     */
    handleRowClick(row: any): void {
        // If row is a group row, handle expansion
        if (this.isGroupRow(row)) {
            if (this.isExpanded(row)) {
                this.expandedRows.delete(row);
            } else {
                if (!this.multiExpand) {
                    // When multiExpand is off, collapse all other expanded groups
                    const expandedGroups = Array.from(this.expandedRows).filter(r => this.isGroupRow(r));
                    expandedGroups.forEach(group => this.expandedRows.delete(group));
                }
                this.expandedRows.add(row);
            }
            this.updateDataSource(this.cachedData);
            return;
        }

        // If row is expandable, handle expansion
        if (this.canExpand?.(row)) {
            if (this.isExpanded(row)) {
                this.expandedRows.delete(row);
            } else {
                if (!this.multiExpand) {
                    // When multiExpand is off, collapse all other expanded rows
                    const expandedNonGroups = Array.from(this.expandedRows).filter(r => !this.isGroupRow(r));
                    expandedNonGroups.forEach(expandedRow => this.expandedRows.delete(expandedRow));
                }
                this.expandedRows.add(row);
            }
            this.updateDataSource(this.cachedData);
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
        // Simply update the data source with the cached data
        // Filtering will be handled in updateDataSource
        this.updateDataSource(this.cachedData);
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
     * Whether all selectable rows are selected
     */
    isAllSelected(): boolean {
        if (!this.multiSelect) return false;

        // Get all selectable rows from groups and ungrouped data
        const allRows: any[] = [];

        // Add rows from groups
        this.groupedData.forEach(rows => {
            allRows.push(...rows.filter(row => this.canSelect(row)));
        });

        // Add ungrouped rows
        this.dataSource.data
            .filter(row => !this.isGroupRow(row) && this.canSelect(row))
            .forEach(row => {
                if (!allRows.includes(row)) {
                    allRows.push(row);
                }
            });

        return allRows.length > 0 && allRows.every(row => this.selection.isSelected(row));
    }

    /** Whether some but not all rows are selected */
    isMasterPartiallySelected(): boolean {
        if (!this.multiSelect) return false;

        // Get all selectable rows from groups and ungrouped data
        const allRows: any[] = [];

        // Add rows from groups
        this.groupedData.forEach(rows => {
            allRows.push(...rows.filter(row => this.canSelect(row)));
        });

        // Add ungrouped rows
        this.dataSource.data
            .filter(row => !this.isGroupRow(row) && this.canSelect(row))
            .forEach(row => {
                if (!allRows.includes(row)) {
                    allRows.push(row);
                }
            });

        const selectedCount = allRows.filter(row => this.selection.isSelected(row)).length;
        return selectedCount > 0 && selectedCount < allRows.length;
    }

    /**
     * Selects all rows if they are not all selected; otherwise clear selection
     */
    masterToggle(): void {
        if (!this.multiSelect) return;

        if (this.isAllSelected()) {
            this.selection.clear();
        } else {
            // Get all rows from all groups
            const allRows: any[] = [];

            // Add rows from groups
            this.groupedData.forEach(rows => {
                allRows.push(...rows.filter(row => this.canSelect(row)));
            });

            // Add ungrouped rows
            this.dataSource.data
                .filter(row => !this.isGroupRow(row) && this.canSelect(row))
                .forEach(row => {
                    if (!allRows.includes(row)) {
                        allRows.push(row);
                    }
                });

            // Select all rows
            allRows.forEach(row => this.selection.select(row));
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

    /** Whether a row is a group row */
    isGroupRow(row: any): boolean {
        return row?.__isGroup === true;
    }

    /** Gets the rows for a group */
    getGroupRows(groupName: string): any[] {
        return this.groupedData.get(groupName) || [];
    }

    /** Gets the cell display value */
    getCellValue(row: any, column: TableColumn): any {
        if (!row || !column.name) return '';
        return this.getNestedValue(row, column.name);
    }

    /** Gets the colspan for a cell */
    getColspan(row: any): number {
        return this.isGroupRow(row) ? this.displayedColumns.length : 1;
    }

    /** Whether to hide a cell in a group row */
    shouldHideGroupCell(row: any, columnIndex: number): boolean {
        return this.isGroupRow(row) && columnIndex > 0;
    }

    /** Whether all rows in a group are selected */
    isGroupSelected(groupRow: any): boolean {
        if (!this.isGroupRow(groupRow)) return false;
        const groupRows = this.getGroupRows(groupRow.name);
        return groupRows.length > 0 && groupRows.every(row => this.selection.isSelected(row));
    }

    /** Whether some but not all rows in a group are selected */
    isGroupPartiallySelected(groupRow: any): boolean {
        if (!this.isGroupRow(groupRow)) return false;
        const groupRows = this.getGroupRows(groupRow.name);
        const selectedCount = groupRows.filter(row => this.selection.isSelected(row)).length;
        return selectedCount > 0 && selectedCount < groupRows.length;
    }

    /** Toggles selection of all rows in a group */
    toggleGroupSelection(groupRow: any): void {
        if (!this.isGroupRow(groupRow)) return;

        const groupRows = this.getGroupRows(groupRow.name);
        const allSelected = this.isGroupSelected(groupRow);

        if (allSelected) {
            // Deselect all rows in the group
            groupRows.forEach(row => this.selection.deselect(row));
        } else {
            // Select all rows in the group
            groupRows.forEach(row => this.selection.select(row));
        }

        this.selectionChange.emit(this.selection.selected);
    }

    /** Whether a column's filter menu is open */
    isFilterMenuOpen(columnName: string): boolean {
        const trigger = this.filterMenuTriggers?.find((t, index) => this.columns[index].name === columnName);
        return trigger?.menuOpen || false;
    }

    private getNestedValue(obj: any, path: string): any {
        if (!obj) return null;
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
}