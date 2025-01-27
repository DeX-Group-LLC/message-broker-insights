/**
 * Test suite for TableComponent.
 * Tests the reusable table functionality including:
 * - Column configuration
 * - Sorting
 * - Filtering
 * - Pagination
 * - Row selection
 * - Row expansion
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TableComponent, TableColumn } from './table.component';

interface TestData {
    id: number;
    name: string;
    value: number;
    nested: {
        field: string;
    };
}

describe('TableComponent', () => {
    let component: TableComponent;
    let fixture: ComponentFixture<TableComponent>;

    const testData: TestData[] = [
        { id: 1, name: 'Test 1', value: 100, nested: { field: 'A' } },
        { id: 2, name: 'Test 2', value: 200, nested: { field: 'B' } },
        { id: 3, name: 'Test 3', value: 300, nested: { field: 'C' } }
    ];

    const testColumns: TableColumn[] = [
        { name: 'id', label: 'ID', sortable: true },
        { name: 'name', label: 'Name', sortable: true, filterable: (data: TestData, filter: string) =>
            data.name.toLowerCase().includes(filter.toLowerCase()) },
        { name: 'value', label: 'Value', sortable: true },
        { name: 'nested.field', label: 'Nested Field', sortable: true }
    ];

    /**
     * Test setup before each test case.
     * Configures TestBed with required imports.
     */
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                NoopAnimationsModule,
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
                MatCheckboxModule,
                MatRadioModule,
                TableComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(TableComponent);
        component = fixture.componentInstance;
        component.columns = testColumns;
        component.data = testData;
        component.selectable = true; // Enable selection
        fixture.detectChanges();
        await fixture.whenStable(); // Wait for async operations
    });

    /**
     * Test case: Component Creation
     * Verifies that the TableComponent can be created successfully.
     */
    it('should create', () => {
        expect(component).toBeTruthy();
    });

    /**
     * Test case: Data Display
     * Verifies that data is properly displayed in the table.
     */
    it('should display data correctly', async () => {
        // Set debounce delay to 0 for testing
        component.debounceDelay = 0;
        fixture.detectChanges();
        await fixture.whenStable(); // Wait for async operations

        expect(component.dataSource.data).toEqual(testData);
        const rows = fixture.nativeElement.querySelectorAll('tr[mat-row]:not(.sub-row)');
        expect(rows.length).toBe(testData.length);
    });

    /**
     * Test case: Column Configuration
     * Verifies that columns are properly configured and displayed.
     */
    it('should configure columns correctly', () => {
        const displayedColumns = component.displayedColumns;
        // Add 1 for selection column
        expect(displayedColumns.length).toBe(testColumns.length + 1);
        testColumns.forEach(col => {
            expect(displayedColumns).toContain(col.name);
        });
    });

    /**
     * Test case: Sorting
     * Verifies that table data can be sorted by sortable columns.
     */
    it('should sort data correctly', () => {
        // Sort by name ascending
        component.sort.sort({ id: 'name', start: 'asc', disableClear: false });
        fixture.detectChanges();

        const sortedData = component.dataSource.sortData(testData.slice(), component.sort);
        expect(sortedData[0].name).toBe('Test 1');
        expect(sortedData[2].name).toBe('Test 3');
    });

    /**
     * Test case: Filtering
     * Verifies that table data can be filtered using column filters.
     */
    it('should filter data correctly', async () => {
        // Set debounce delay to 0 for testing
        component.debounceDelay = 0;
        fixture.detectChanges();

        // Filter by name
        component.setFilter('name', 'Test 2');
        fixture.detectChanges();
        await fixture.whenStable(); // Wait for async operations

        expect(component.dataSource.filteredData.length).toBe(1);
        expect(component.dataSource.filteredData[0].name).toBe('Test 2');
    });

    /**
     * Test case: Row Selection
     * Verifies that rows can be selected and selection events are emitted.
     */
    it('should handle row selection', async () => {
        const selectionSpy = spyOn(component.selectionChange, 'emit');

        // Select first row
        component.toggleSelection(testData[0]);
        fixture.detectChanges();
        await fixture.whenStable(); // Wait for async operations

        expect(component.selection.selected.length).toBe(1);
        expect(component.selection.isSelected(testData[0])).toBeTrue();
        expect(selectionSpy).toHaveBeenCalledWith([testData[0]]);
    });

    /**
     * Test case: Nested Property Access
     * Verifies that nested object properties can be accessed and displayed.
     */
    it('should handle nested properties', () => {
        const nestedValue = component.getCellValue(testData[0], testColumns[3]);
        expect(nestedValue).toBe('A');
    });

    /**
     * Test case: Selection Clear
     * Verifies that selection can be cleared.
     */
    it('should clear selection', () => {
        // Select first row
        component.selection.select(testData[0]);
        expect(component.selection.selected.length).toBe(1);

        component.clearSelection();
        expect(component.selection.selected.length).toBe(0);
    });
});