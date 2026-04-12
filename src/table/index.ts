/**
 * Table module exports
 */

// Main Table component
export { Table } from './Table';

// Types
export type { IRecentMutationTouchConfig } from '../core/types/field-config';
export type {
  ITableConfig,
  ITablePropertiesConfig,
  ITableApiConfig,
  IDualTableApiConfig,
  ITableExpandableConfig,
  IFilterSegment,
  IFilterSegmentGroup,
  IPageAction,
  IActionIndexValue,
  IRecord,
  SortConfig,
  ITableFilters
} from './type';

// Hooks
export { useTable } from './useTable';
export { usePlaceholderContext } from './hooks/usePlaceholderContext';
export { useRecentSaveHighlight } from './hooks/useRecentSaveHighlight';

// Components
export { Search } from './Search/Search';
export { ColumnSettings } from './ColumnSettings/ColumnSettings';
export { FilterSegments } from './FilterSegments/FilterSegments';

// Renderers
export { RelationFieldRenderer, type IRelationFieldConfig } from './renderers/RelationFieldRenderer';
