// Shared utilities for Form, Details, and FormField components

// Helper to split array into N columns (vertical stacks)
export function splitIntoColumns<T>(arr: T[], numCols: number): T[][] {
  const cols: T[][] = Array.from({ length: numCols }, () => []);
  arr.forEach((item, idx) => {
    cols[idx % numCols].push(item);
  });
  return cols;
}

// Shared column configuration logic
export function determineColumnLayout<T>(
  items: T[], 
  columnsConfig?: { columns: Array<{ sortOrder: number; fields: string[] }> },
  maxColumns: number = 2
): T[][] {
  if (columnsConfig && columnsConfig.columns && columnsConfig.columns.length > 0) {
    // Sort columns by sortOrder
    return columnsConfig.columns
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(col =>
        col.fields
          .map(fieldKey => items.find((item: any) => item.name === fieldKey || item.column === fieldKey))
          .filter(item => item) as T[]
      )
      .filter(col => col.length > 0); // Remove empty columns
  } else {
    // Fallback: intelligently split items into columns
    const numColumns = items.length >= 6 ? maxColumns : items.length >= 3 ? Math.min(2, maxColumns) : 1;
    return splitIntoColumns(items, numColumns);
  }
}

// Shared types for column configuration
export interface IColumnLayoutConfig {
  sortOrder: number;
  fields: string[];
}

export interface IColumnsConfig {
  numColumns?: number;
  columns: IColumnLayoutConfig[];
} 