// Shared utilities for Form, Details, and FormField components

// Helper to split array into N columns (vertical stacks)
export function splitIntoColumns<T>(arr: T[], numCols: number): T[][] {
  const cols: T[][] = Array.from({ length: numCols }, () => []);
  arr.forEach((item, idx) => {
    cols[ idx % numCols ].push(item);
  });
  return cols;
}

// Shared column configuration logic
export function determineColumnLayout<T>(
  items: T[],
  columnsConfig?: IColumnsConfig,
  maxColumns: number = 2
): T[][] {

  if (columnsConfig?.columns?.length > 0) {
    // Get all items that should be rendered based on columnsConfig
    const sortedColumns = columnsConfig.columns
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const allConfiguredItems = sortedColumns
      .flatMap(col =>
        col.fields
          .map(fieldKey => items.find((item: any) => item.name === fieldKey || item.column === fieldKey))
          .filter(item => item) as T[]
      );

    // If numColumns is specified, redistribute items into that many columns
    if (columnsConfig.numColumns && columnsConfig.numColumns > 0) {
      return splitIntoColumns(allConfiguredItems, Math.min(columnsConfig.numColumns, maxColumns));
    }

    // Otherwise, use the explicit column structure
    return sortedColumns
      .map(col =>
        col.fields
          .map(fieldKey => items.find((item: any) => item.name === fieldKey || item.column === fieldKey))
          .filter(item => item) as T[]
      )
      .filter(col => col.length > 0); // Remove empty columns
  }

  // Fallback: intelligently split items into columns
  const numColumns = items.length >= 6 ? maxColumns : items.length >= 3 ? Math.min(2, maxColumns) : 1;
  return splitIntoColumns(items, numColumns);

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

/**
 * Field keys explicitly listed in a page layout (`columnsConfig`). When non-null, the form
 * should only register and submit these fields. This intersects with `propertiesConfig`,
 * which is often page-scoped generated config but can still list more attributes than the layout.
 */
export function collectLayoutFieldKeys(columnsConfig?: IColumnsConfig): Set<string> | null {
  if (!columnsConfig?.columns?.length) return null;
  const keys = new Set<string>();
  for (const col of columnsConfig.columns) {
    for (const f of col.fields) {
      if (typeof f === 'string' && f.trim() !== '') keys.add(f);
    }
  }
  return keys.size > 0 ? keys : null;
}

/** Keeps only property entries whose `column` / `name` / `id` appears in the layout key set. */
export function filterPropertiesConfigByLayout<T extends { name?: string; column?: string; id?: string }>(
  propertiesConfig: T[],
  layoutKeys: Set<string> | null
): T[] {
  if (!layoutKeys) return propertiesConfig;
  return propertiesConfig.filter((field) => {
    const key = field.column || field.name || field.id;
    return typeof key === 'string' && layoutKeys.has(key);
  });
} 