/**
 * @fileoverview Table Component for FW24 Framework
 * 
 * This is the main table component that provides enterprise-grade table functionality
 * including pagination, sorting, filtering, searching, row selection, bulk actions,
 * expandable rows, and filter segments.
 * 
 * ## Key Features
 * 
 * - **Pagination**: Cursor-based pagination with configurable page size
 * - **Sorting**: Multi-column sorting with visual indicators
 * - **Filtering**: Column-level filters with multiple operators (eq, contains, in, etc.)
 * - **Search**: Full-text search toggle between database and search modes
 * - **Row Selection**: Multi-row selection with bulk actions
 * - **Bulk Actions**: Actions that operate on multiple selected rows
 * - **Expandable Rows**: Nested tables or detail views within expandable rows
 * - **Filter Segments**: Quick filter tabs for common filter presets
 * - **Column Settings**: Show/hide columns, adjust widths, reorder columns
 * - **Placeholder Resolution**: Automatic resolution of placeholders in filters (`:actor.actorId`, `:startOfMonth`, etc.)
 * - **Relation Rendering**: Automatic rendering of relation fields with links and modals
 * - **Rich Field Types**: Specialized renderers for images, files, colors, JSON, rich text, ratings, and more
 * 
 * ## Architecture
 * 
 * The Table component follows a layered architecture:
 * 1. **Table.tsx** (this file): UI rendering and user interactions
 * 2. **useTable.tsx**: Data fetching, state management, and business logic
 * 3. **useTableData.tsx**: API calls and data transformation
 * 4. **FilterSegments**: Quick filter tabs with placeholder resolution
 * 5. **ColumnSettings**: Column visibility and configuration
 * 
 * ## Field Type Rendering
 * 
 * The table automatically applies specialized renderers based on field type:
 * 
 * **Simple Inline Renderers:**
 * - **image**: Thumbnail preview (40x40) with click-to-expand
 * - **file**: Download link
 * - **color**: Color swatch with hex value
 * - **number**: Formatted with thousand separators
 * - **range**: Value with percentage
 * - **rating**: Star display with numeric value
 * - **relation**: Link/modal with template-based display
 * 
 * **Modal-Based Renderers (for complex content):**
 * - **json/map**: "View JSON" button → Opens formatted JSON in modal
 * - **list**: "View (count)" button → Opens array items in modal (simple arrays shown inline if ≤3 items)
 * - **rich-text/wysiwyg**: "View Content" button → Opens BlockNote editor in modal
 * - **textarea/code/markdown**: Shows inline if <100 chars, otherwise "View Content" button → Opens in modal
 * 
 * ## Placeholder Resolution
 * 
 * The table automatically resolves placeholders in:
 * - Default filters (from backend config)
 * - Segment filters (from filter segments)
 * - Expandable row API URLs
 * - Relation field identifiers
 * 
 * Supported placeholders:
 * - `:actor.actorId` - Current user ID
 * - `:startOfMonth`, `:endOfMonth` - Date expressions
 * - `:teamId`, `:gameId` - Route parameters
 * 
 * ## Usage
 * 
 * @example
 * ```tsx
 * <Table
 *   propertiesConfig={[
 *     { name: 'Team', dataIndex: 'teamName', fieldType: 'text', isFilterable: true },
 *     { name: 'City', dataIndex: 'city', fieldType: 'text', isFilterable: true }
 *   ]}
 *   apiConfig={{
 *     apiMethod: 'GET',
 *     apiUrl: '/api/team',
 *     responseKey: 'data',
 *     useSearch: true
 *   }}
 *   defaultFilters={{ status: { eq: 'active' } }}
 *   segments={[
 *     { id: 'all', label: 'All Teams', filters: {} },
 *     { id: 'active', label: 'Active', filters: { status: { eq: 'active' } } }
 *   ]}
 *   bulkActions={[
 *     { label: 'Delete Selected', url: '/api/team/bulk-delete', openInModal: true }
 *   ]}
 * />
 * ```
 * 
 * @see {@link useTable} for data fetching and state management
 * @see {@link useTableData} for API integration
 * @see {@link FilterSegments} for quick filter tabs
 */

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Table as AntTable, Spin, Button, Dropdown, Tooltip, Badge, Space } from "antd";
import { DragSortWrapper, DragHandleCell, SortableRow } from './DragSortTable';
import { ReloadOutlined, NodeExpandOutlined, ClearOutlined, SettingOutlined, SearchOutlined, DatabaseOutlined, ExpandAltOutlined, ShrinkOutlined, ColumnHeightOutlined, UnorderedListOutlined, AppstoreOutlined } from '@ant-design/icons';
import { Resizable } from 'react-resizable';
import { useTable } from "./useTable";
import { ITableConfig, IRecord, ITableSummaryConfig, ITableApiConfig } from "./type";
import { Search } from './Search/Search';
import { ColumnSettings } from './ColumnSettings/ColumnSettings';
import { AppliedFiltersDisplay } from './AppliedFilters/AppliedFiltersDisplay';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback, QueryErrorState } from '../core/common/ErrorFallback';
import { renderSingleAction } from '../core/utils/actionRenderer';
import { conditionEvaluator } from '../core/utils/ConditionEvaluator';
import { useNewEvaluationContext } from '../core/context/NewEvaluationContext';
import { useApi } from '../core/context/ApiContext';
import { useEvaluatedItems } from '../core/hooks/useEvaluatedItems';
import { substituteUrlParams } from '../core/utils';
import { TableContextMenu, useTableContextMenu } from './ContextMenu/ContextMenu';
import { RenderFromPageType } from '../pages/PostAuth/PostAuthPage';
import { resolveFilterPlaceholders } from '../core/utils/placeholderResolver';
import { FilterSegments } from './FilterSegments/FilterSegments';
import { useAutoRefresh } from '../core/hooks/useAutoRefresh';
import { RefreshControl } from '../core/common/RefreshControl';
import { EmptyState } from '../core/common/EmptyState';
import { DataLoadingState } from '../core/common/DataLoadingState';
import { useCoreNavigator } from '../routes/Navigation';
import './Table.css';
import { usePlaceholderContext } from "./hooks/usePlaceholderContext";
import { JsonViewer } from '../core/common/JsonViewer/JsonViewer';
import { CardView } from './CardView/CardView';
import { ViewSwitcher, ViewContainer, useViewState, KanbanLayout, CalendarLayout, TreeLayout, MapLayout } from '../core/common/ViewSwitcher';
import { useDeepLink } from './hooks/useDeepLink';
import { DataQualityIndicator } from '../core/common/DataQualityIndicator';
import { useTableViews, type TableViewState } from './hooks/useTableViews';
import { ViewSelector } from './components/ViewSelector';

// ============================================================================
// RESIZABLE TABLE HEADER (#113)
// ============================================================================

/**
 * ResizableTitle — wraps a table header cell to make it resizable by dragging.
 * Uses react-resizable's Resizable component.
 */
interface ResizableTitleProps extends React.HTMLAttributes<HTMLTableCellElement> {
  onResize?: (e: React.SyntheticEvent, data: { size: { width: number } }) => void;
  width?: number;
}

const ResizableTitle: React.FC<ResizableTitleProps> = (props) => {
  const { onResize, width, ...restProps } = props;

  if (!width) {
    return <th {...restProps} />;
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: -5,
            bottom: 0,
            top: 0,
            width: 10,
            cursor: 'col-resize',
            zIndex: 1,
          }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  );
};

/**
 * Compute aggregate display value for a summary column (#27).
 */
function computeSummaryCell(
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count',
  dataIndex: string,
  data: readonly Record<string, unknown>[],
  precision?: number,
  label?: string,
): string {
  if (aggregation === 'count') return label ?? String(data.length);

  const nums = data.map(row => Number(row[ dataIndex ])).filter(n => !isNaN(n));
  let result: number;
  switch (aggregation) {
    case 'sum': result = nums.reduce((a, b) => a + b, 0); break;
    case 'avg': result = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0; break;
    case 'min': result = nums.length ? Math.min(...nums) : 0; break;
    case 'max': result = nums.length ? Math.max(...nums) : 0; break;
    default: result = 0;
  }
  const dp = precision ?? (aggregation === 'avg' ? 2 : 0);
  return result.toFixed(dp);
}

/**
 * Main Table component for rendering data tables with advanced features.
 * 
 * Consumes backend-generated table configurations and renders a fully-featured
 * data table with pagination, sorting, filtering, searching, and more.
 * 
 * @param props - Table configuration props
 * @param props.propertiesConfig - Column configurations from backend
 * @param props.apiConfig - API configuration for data fetching
 * @param props.routeParams - Route parameters for placeholder resolution
 * @param props.defaultFilters - Pre-applied filters (can use placeholders)
 * @param props.entityName - Entity name for context
 * @param props.bulkActions - Actions to show when rows are selected
 * @param props.rowSelection - Row selection configuration
 * @param props.expandableConfig - Expandable row configuration
 * @param props.segments - Filter segment configurations
 * @param props.onDataChange - Callback to lift table state to parent
 * 
 * @returns Rendered table component
 */
export const Table = ({
  propertiesConfig,
  apiConfig,
  routeParams,
  defaultFilters,
  entityName,  // From backend config generation
  bulkActions,  // Actions shown when multiple rows selected
  rowSelection: rowSelectionConfig,  // Row selection configuration
  expandableConfig,  // Expandable row configuration
  segments,  // Filter segments for quick filtering
  fetchStrategy,  // Fetch strategy from backend config
  pageSize: initialPageSize,  // Default page size from backend config
  onDataChange,  // Callback to lift state to wrapper
  showToolbar = true,
  showPagination = true,
  emptyState,
  rowFormatting,
  pagination: paginationConfig,
  density: densityConfig,
  columnResizing: columnResizingConfig,
  pinnedColumns: pinnedColumnsConfig,
  contextMenu: contextMenuConfig,
  displayMode: displayModeConfig,
  viewSwitcher: viewSwitcherConfig,
  loading: loadingConfig,
  errorHandling: errorHandlingConfig,
  retry: retryConfig,
  deepLink: deepLinkConfig,
  dataSource: preloadedRecords,
  views: viewsConfig,
  dataQuality: dataQualityConfig,
  virtualScroll: virtualScrollConfig,
  summary: summaryConfig,
  rowDrag: rowDragConfig,
}: ITableConfig) => {
  const coreNavigate = useCoreNavigator();
  // Build placeholder context for segments and filters
  const placeholderContext = usePlaceholderContext(routeParams);

  // Track resolved defaultFilters for segment merging
  const resolvedDefaultFilters = useMemo(() => {
    if (!defaultFilters) return {};
    return resolveFilterPlaceholders(defaultFilters, placeholderContext);
  }, [ defaultFilters, placeholderContext ]);

  // Compute default segment filters to merge with prop defaultFilters
  // This ensures segments marked with `default: true` are applied on initial page load
  // These defaults are then passed to useTable, which merges them with URL filters
  const segmentDefaultFilters = useMemo(() => {
    if (!segments || segments.length === 0) return {};

    let defaults: Record<string, any> = {};

    // Normalize segments to grouped format
    const isGrouped = segments.length > 0 && ('segments' in segments[ 0 ]);
    const groups = isGrouped
      ? segments
      : [ { id: 'default-group', segments: segments } ];

    groups.forEach(group => {
      // Normalize: grouped format has { segments: [...] }, flat format was wrapped above
      const segs = 'segments' in group ? group.segments : [ group ];

      // Find segment with explicit default=true flag
      // NOTE: Only explicit defaults are used; we don't fallback to first segment
      const defaultSeg = segs.find(s => s.default);

      if (defaultSeg && defaultSeg.filters && Object.keys(defaultSeg.filters).length > 0) {
        // Resolve placeholders (e.g., :actor.actorId) before merging
        const resolved = resolveFilterPlaceholders(defaultSeg.filters, placeholderContext);
        Object.assign(defaults, resolved);
      }
    });

    return defaults;
  }, [ segments, placeholderContext ]);

  // Merge all default filters for useTable initialization
  // Priority: segmentDefaultFilters < resolvedDefaultFilters < URL filters (handled in useTable)
  const initialFiltersForTable = useMemo(() => ({
    ...segmentDefaultFilters,
    ...resolvedDefaultFilters // Prop defaults override segment defaults if keys conflict
  }), [ segmentDefaultFilters, resolvedDefaultFilters ]);

  const {
    recordIdentifierKey,
    columns,
    listRecords,
    isLoading,
    isInitialLoad,
    Pagination,
    DisplayAppliedFilters,
    onSearch,
    handleTableChange,
    hasActiveFilters,
    activeFiltersCount,
    clearAllFilters,
    DisplayAppliedSorts,
    clearAllSorts,
    hasActiveSorts,
    activeSortsCount,
    handleRefresh,
    handleReload,
    searchQuery,
    appliedFilters,  // NEW: Now exposed from useTable
    setAppliedFilters,  // NEW: For filter segments
    setFetchTrigger,  // NEW: To trigger refetch after state updates
    fetchRecords,  // NEW: To allow direct fetch after state updates
    columnSettings,
    handleColumnSettingsChange,
    resetColumnSettings,
    currentFetchStrategy,
    handleFetchStrategyChange,
    isSearchMode,
    toggleSearchMode,
    canToggleSearchMode,
    dataUpdatedAt,
    fetchError,
    currentPage,
    sort: activeSort,
  } = useTable({
    propertiesConfig,
    apiConfig,
    routeParams,
    defaultFilters: initialFiltersForTable,
    fetchStrategy,
    initialPageSize,
    paginationConfig,
    dataSource: preloadedRecords,
  });

  // Resolve API config for view switcher layouts (handles dual API configs)
  const resolvedApiConfigForLayouts: ITableApiConfig | undefined = useMemo(() => {
    if (!apiConfig) return undefined;
    // If dual API config, resolve based on current search mode
    if ('search' in apiConfig && 'database' in apiConfig) {
      return isSearchMode ? apiConfig.search : apiConfig.database;
    }
    // Otherwise, it's already a simple ITableApiConfig
    return apiConfig as ITableApiConfig;
  }, [ apiConfig, isSearchMode ]);

  // Deep linking: bidirectional URL sync (#21)
  useDeepLink(deepLinkConfig, {
    filters: appliedFilters,
    search: searchQuery,
    sort: activeSort.map(s => ({ field: String(s.field ?? s.columnKey ?? ''), order: String(s.order ?? '') })),
    page: currentPage,
  });

  // Saved views (#19)
  const currentViewState = useMemo<TableViewState>(() => ({
    columns: columnSettings.filter(c => c.visible).map(c => c.key),
    sort: activeSort.map(s => ({ field: String(s.field ?? s.columnKey ?? ''), order: String(s.order ?? '') })),
    filters: appliedFilters,
    pageSize: initialPageSize,
    search: searchQuery,
  }), [ columnSettings, activeSort, appliedFilters, initialPageSize, searchQuery ]);

  const savedViews = useTableViews(entityName, viewsConfig, currentViewState);

  const handleLoadView = useCallback((viewId: string): TableViewState | undefined => {
    const state = savedViews.loadView(viewId);
    if (!state) return undefined;
    if (state.filters) setAppliedFilters(state.filters as Record<string, string>);
    if (state.search !== undefined) onSearch(state.search);
    setFetchTrigger(prev => prev + 1);
    return state;
  }, [ savedViews, setAppliedFilters, onSearch, setFetchTrigger ]);

  // Auto-refresh functionality
  const autoRefresh = useAutoRefresh({
    onRefresh: handleReload,
    enabled: false,
    defaultInterval: 30
  });

  // Drag-to-reorder row order state (#62)
  // Tracks local order as array of record ID strings; syncs from listRecords when data changes
  const { callApiMethod } = useApi();
  const [ dragOrderIds, setDragOrderIds ] = useState<string[]>([]);
  useEffect(() => {
    setDragOrderIds(listRecords.map(r => String(r[ recordIdentifierKey ] ?? '')));
  }, [ listRecords, recordIdentifierKey ]);

  const handleDragOrderChange = useCallback(
    async (newIds: string[]) => {
      setDragOrderIds(newIds);
      if (rowDragConfig?.onOrderChange) {
        try {
          await callApiMethod({
            ...rowDragConfig.onOrderChange,
            apiMethod: rowDragConfig.onOrderChange.apiMethod ?? 'POST',
            payload: { ids: newIds },
          });
        } catch {
          // Revert on failure
          setDragOrderIds(listRecords.map(r => String(r[ recordIdentifierKey ] ?? '')));
        }
      }
    },
    [ rowDragConfig, callApiMethod, listRecords, recordIdentifierKey ]
  );

  // Reorder listRecords to follow drag order for display
  const orderedRecords = useMemo(() => {
    if (!rowDragConfig?.enabled || dragOrderIds.length === 0) return listRecords;
    const indexMap = new Map(dragOrderIds.map((id, i) => [ id, i ]));
    return [ ...listRecords ].sort((a, b) => {
      const ai = indexMap.get(String(a[ recordIdentifierKey ] ?? '')) ?? Infinity;
      const bi = indexMap.get(String(b[ recordIdentifierKey ] ?? '')) ?? Infinity;
      return ai - bi;
    });
  }, [ rowDragConfig?.enabled, dragOrderIds, listRecords, recordIdentifierKey ]);

  const [ showFilters, setShowFilters ] = React.useState(false);

  // Density state (#113) — maps to antd Table size prop
  const densityDefault = densityConfig?.default || 'default';
  const densityStorageKey = entityName ? `ui24-table-density-${entityName}` : null;

  const [ density, setDensity ] = useState<'default' | 'compact' | 'comfortable'>(() => {
    if (densityConfig?.persist && densityStorageKey) {
      const stored = localStorage.getItem(densityStorageKey);
      if (stored === 'compact' || stored === 'comfortable' || stored === 'default') return stored;
    }
    return densityDefault;
  });

  const cycleDensity = useCallback(() => {
    setDensity(prev => {
      const next = prev === 'default' ? 'compact' : prev === 'compact' ? 'comfortable' : 'default';
      if (densityConfig?.persist && densityStorageKey) {
        localStorage.setItem(densityStorageKey, next);
      }
      return next;
    });
  }, [ densityConfig?.persist, densityStorageKey ]);

  const antTableSize = density === 'compact' ? 'small' : density === 'comfortable' ? 'large' : 'middle';

  // Pinned (frozen) columns (#113) — apply fixed: 'left'/'right' based on config
  const hasPinnedColumns = !!(pinnedColumnsConfig?.left?.length || pinnedColumnsConfig?.right?.length);
  const leftPinned = useMemo(() => new Set(pinnedColumnsConfig?.left || []), [ pinnedColumnsConfig?.left ]);
  const rightPinned = useMemo(() => new Set(pinnedColumnsConfig?.right || []), [ pinnedColumnsConfig?.right ]);

  // Column resize state (#113) — tracked widths per column, persisted to localStorage
  const resizeEnabled = !!columnResizingConfig?.enabled;
  const resizeMinWidth = columnResizingConfig?.minWidth || 60;
  const resizeStorageKey = entityName && columnResizingConfig?.persist ? `ui24-col-widths-${entityName}` : null;

  const [ columnWidths, setColumnWidths ] = useState<Record<string, number>>(() => {
    if (resizeStorageKey) {
      try {
        const stored = localStorage.getItem(resizeStorageKey);
        if (stored) return JSON.parse(stored);
      } catch { /* ignore */ }
    }
    return {};
  });

  const handleColumnResize = useCallback((dataIndex: string) => (_e: any, { size }: { size: { width: number } }) => {
    setColumnWidths(prev => {
      const next = { ...prev, [ dataIndex ]: Math.max(size.width, resizeMinWidth) };
      if (resizeStorageKey) {
        try { localStorage.setItem(resizeStorageKey, JSON.stringify(next)); } catch { /* ignore */ }
      }
      return next;
    });
  }, [ resizeMinWidth, resizeStorageKey ]);

  // Context menu (#110) — uses reusable component
  const ctxMenu = useTableContextMenu();

  // Display mode state (#32) — table vs card
  const displayDefault = displayModeConfig?.default || 'table';
  const displayStorageKey = entityName ? `ui24-display-mode-${entityName}` : null;

  const [ displayMode, setDisplayMode ] = useState<'table' | 'card'>(() => {
    if (displayModeConfig?.remember && displayStorageKey) {
      const stored = localStorage.getItem(displayStorageKey);
      if (stored === 'table' || stored === 'card') return stored;
    }
    return displayDefault;
  });

  const toggleDisplayMode = useCallback(() => {
    setDisplayMode(prev => {
      const next = prev === 'table' ? 'card' : 'table';
      if (displayModeConfig?.remember && displayStorageKey) {
        localStorage.setItem(displayStorageKey, next);
      }
      return next;
    });
  }, [ displayModeConfig?.remember, displayStorageKey ]);

  // Unified ViewSwitcher (#119) — replaces displayMode toggle when configured
  const viewState = useViewState(
    viewSwitcherConfig || { available: [ 'table' ], default: 'table' },
    entityName
  );

  // Resolve which view is active: viewSwitcher takes priority over displayMode
  const useUnifiedSwitcher = !!viewSwitcherConfig && viewSwitcherConfig.available.length > 1;
  const isCardView = useUnifiedSwitcher
    ? viewState.activeView === 'card-grid'
    : displayMode === 'card';

  // Resolve card config from unified viewSwitcher or legacy displayMode
  const resolvedCardConfig = viewSwitcherConfig?.cardConfig || displayModeConfig?.cardConfig;

  // Record click handler — navigate to the detail page using the identifier column's first action URL
  const handleRecordClick = useCallback((record: IRecord) => {
    const identifierCol = propertiesConfig.find(p => p.isIdentifier);
    const firstAction = identifierCol?.actions?.[ 0 ];
    if (firstAction?.url) {
      const url = substituteUrlParams(firstAction.url, { ...routeParams, ...record });
      coreNavigate(url);
    }
  }, [ propertiesConfig, routeParams, coreNavigate ]);

  // Layout-specific navigation: each layout can define its own navigate-on-click URL
  // with :id / :fieldName placeholders. Falls back to the generic handleRecordClick.
  const createLayoutRecordClickHandler = useCallback(
    (navigateUrl: string | undefined, idFieldOverride: string | undefined) => {
      if (!navigateUrl) return handleRecordClick;
      return (record: Record<string, unknown>) => {
        const idKey = idFieldOverride || recordIdentifierKey;
        const idValue = String(record[ idKey ] ?? '');
        const resolvedUrl = substituteUrlParams(
          navigateUrl.replace(':id', idValue).replace(`:${idKey}`, idValue),
          { ...routeParams, ...record }
        );
        coreNavigate(resolvedUrl);
      };
    },
    [ handleRecordClick, recordIdentifierKey, routeParams, coreNavigate ]
  );

  // Stable handler for card action clicks (ignores the record argument)
  const handleCardActionClick = useCallback(
    (url: string) => coreNavigate(url),
    [ coreNavigate ]
  );

  // Pre-compute stable click handlers for each layout to avoid creating new
  // functions during render (which defeats React.memo on the layout components).
  const kanbanRecordClickHandler = useMemo(
    () => createLayoutRecordClickHandler(
      viewSwitcherConfig?.kanbanConfig?.onClickNavigateTo,
      viewSwitcherConfig?.kanbanConfig?.idField
    ),
    [ createLayoutRecordClickHandler, viewSwitcherConfig?.kanbanConfig?.onClickNavigateTo, viewSwitcherConfig?.kanbanConfig?.idField ]
  );

  const calendarRecordClickHandler = useMemo(
    () => createLayoutRecordClickHandler(
      viewSwitcherConfig?.calendarConfig?.onEventClickNavigateTo,
      viewSwitcherConfig?.calendarConfig?.idField
    ),
    [ createLayoutRecordClickHandler, viewSwitcherConfig?.calendarConfig?.onEventClickNavigateTo, viewSwitcherConfig?.calendarConfig?.idField ]
  );

  const treeRecordClickHandler = useMemo(
    () => createLayoutRecordClickHandler(
      viewSwitcherConfig?.treeConfig?.onNodeClickNavigateTo,
      viewSwitcherConfig?.treeConfig?.idField
    ),
    [ createLayoutRecordClickHandler, viewSwitcherConfig?.treeConfig?.onNodeClickNavigateTo, viewSwitcherConfig?.treeConfig?.idField ]
  );

  const mapRecordClickHandler = useMemo(
    () => createLayoutRecordClickHandler(
      viewSwitcherConfig?.mapConfig?.onMarkerClickNavigateTo,
      viewSwitcherConfig?.mapConfig?.idField
    ),
    [ createLayoutRecordClickHandler, viewSwitcherConfig?.mapConfig?.onMarkerClickNavigateTo, viewSwitcherConfig?.mapConfig?.idField ]
  );

  // Kanban: move record API call when a card is dragged between columns
  const handleKanbanMoveRecord = useCallback(
    async (recordId: string, newColumnValue: string) => {
      const moveApi = viewSwitcherConfig?.kanbanConfig?.moveApiConfig;
      if (!moveApi) return;
      const groupByField = viewSwitcherConfig?.kanbanConfig?.groupByField ?? '';
      await callApiMethod({
        apiUrl: substituteUrlParams(moveApi.apiUrl, { ...routeParams, id: recordId }),
        apiMethod: moveApi.apiMethod as 'PUT' | 'PATCH' | 'POST',
        payload: { [ groupByField ]: newColumnValue },
      });
    },
    [ viewSwitcherConfig?.kanbanConfig, callApiMethod, routeParams ]
  );

  // Ref to always access latest appliedFilters in callbacks (avoids stale closures)
  const appliedFiltersRef = useRef(appliedFilters);
  appliedFiltersRef.current = appliedFilters;

  // Handler for filter segment changes (extracted from JSX to comply with Rules of Hooks)
  const handleSegmentChange = useCallback((segmentId: string, filtersToAdd: Record<string, any>, filtersToRemove: Record<string, any>) => {
    // Use ref to get latest filters (avoids stale closures)
    const currentFilters = appliedFiltersRef.current;
    let newFilters = { ...currentFilters };

    // 1. Remove filters from previous segment
    if (filtersToRemove) {
      Object.keys(filtersToRemove).forEach(key => {
        delete newFilters[ key ];
      });
    }

    // 2. Add filters from new segment
    if (filtersToAdd) {
      Object.assign(newFilters, filtersToAdd);
    }

    // 3. Restore default filters for removed keys (if they exist)
    Object.keys(filtersToRemove || {}).forEach(key => {
      if (resolvedDefaultFilters[ key ] !== undefined && newFilters[ key ] === undefined) {
        newFilters[ key ] = resolvedDefaultFilters[ key ];
      }
    });

    // 4. Update state and fetch — React batches setAppliedFilters + fetchRecords
    // into one render, so the reactive payload memo picks up new filters
    setAppliedFilters(newFilters);
    fetchRecords(1);
  }, [ resolvedDefaultFilters, setAppliedFilters, fetchRecords ]);

  // Track selected row keys for bulk actions and row selection
  const [ selectedRowKeys, setSelectedRowKeys ] = useState<React.Key[]>([]);

  // Clear stale selections when the entity changes (e.g., navigating between different tables)
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [ entityName ]);

  // Track expanded row keys for expand/collapse all functionality
  const [ expandedRowKeys, setExpandedRowKeys ] = useState<React.Key[]>([]);

  // Calculate selectedRecords only when selectedRowKeys change (not on data refetch)
  const selectedRecords = useMemo(() =>
    listRecords.filter(record => selectedRowKeys.includes(record[ recordIdentifierKey ])),
    [ selectedRowKeys, listRecords, recordIdentifierKey ]
  );

  // Initial fetch behavior:
  // useTable now handles the initial fetch automatically on mount because:
  // 1. segmentDefaultFilters + resolvedDefaultFilters are merged into initialFiltersForTable
  // 2. useTable initializes appliedFilters with these defaults + URL filters
  // 3. fetchTrigger starts at 1, which triggers the initial fetch
  // 
  // This eliminates the need for separate initial fetch logic here

  // Trigger fetch when search mode changes
  useEffect(() => {
    setFetchTrigger(prev => prev + 1);
  }, [ isSearchMode ]);

  // Reset expanded rows when data changes (pagination, filters, etc.)
  useEffect(() => {
    setExpandedRowKeys([]);
  }, [ listRecords ]);

  // Lift table state to wrapper (if callback provided)
  useEffect(() => {
    if (!onDataChange) return;

    onDataChange({
      selectedRecords,
      selectedRowKeys,
      filters: appliedFilters,
      searchQuery,
      pageType: 'list',
      entityName
    });
  }, [ selectedRecords, selectedRowKeys, appliedFilters, searchQuery, entityName, onDataChange ]);

  // Get evaluation context for per-row evaluations (expandable, selection)
  const evaluationContext = useNewEvaluationContext();

  // Bulk action condition evaluation
  const bulkActionsArr = useMemo(() => bulkActions ? [ ...bulkActions ] : [], [ bulkActions ]);
  const bulkExtraCtx = useMemo(() => ({
    selectedRecords,
    queryParams: routeParams,
  }), [ selectedRecords, routeParams ]);

  const { visibilityResults: bulkVisResults, enablementResults: bulkEnResults, getItemProps: getBulkActionProps } =
    useEvaluatedItems(bulkActionsArr, { additionalContext: bulkExtraCtx });

  // Filter visible bulk actions and attach evaluated state
  const visibleBulkActions = useMemo(() => {
    if (bulkActionsArr.length === 0) return [];

    return bulkActionsArr
      .map((action, index) => {
        const props = getBulkActionProps(index);
        return {
          ...action,
          _evaluated: {
            visible: bulkVisResults[ index ],
            enabled: bulkEnResults[ index ],
            disabledMessage: props.conditionDisabledMessage || '',
          }
        };
      })
      .filter(action => action._evaluated.visible !== false);
  }, [ bulkActionsArr, bulkVisResults, bulkEnResults, getBulkActionProps ]);

  // Row selection configuration for AntTable - using AntD's native row selection API
  const rowSelection = useMemo(() => {
    if (!rowSelectionConfig?.enabled) return undefined;

    return {
      type: (rowSelectionConfig.type ?? 'checkbox') as 'checkbox' | 'radio',
      selectedRowKeys,
      // preserveSelectedRowKeys keeps selection when paginating (#30)
      preserveSelectedRowKeys: rowSelectionConfig.persistAcrossPages ?? false,
      onChange: (selectedKeys: React.Key[]) => {
        setSelectedRowKeys(selectedKeys);
      },
      getCheckboxProps: (record: any) => {
        // Evaluate rowSelection.visibility condition per row
        // Use __raw__ record to evaluate against original field types (before boolean→Yes/No formatting)
        const selectionVisibility = rowSelectionConfig?.visibility;
        if (selectionVisibility) {
          const rawRecord = record.__raw__ || record;
          try {
            const isSelectable = conditionEvaluator.evaluateSync(
              selectionVisibility,
              { ...evaluationContext, record: rawRecord }
            );
            if (!isSelectable) {
              return { disabled: true };
            }
          } catch {
            // Fail-safe: allow selection if evaluation fails
          }
        }
        return {};
      },
    };
  }, [ rowSelectionConfig, selectedRowKeys, evaluationContext ]);

  // Expand/Collapse all rows functionality
  const handleExpandAll = useCallback(() => {
    const allKeys = listRecords.map(record => record[ recordIdentifierKey ]);
    setExpandedRowKeys(allKeys);
  }, [ listRecords, recordIdentifierKey ]);

  const handleCollapseAll = useCallback(() => {
    setExpandedRowKeys([]);
  }, []);

  const hasExpandableConfig = !!expandableConfig;
  const allExpanded = hasExpandableConfig && expandedRowKeys.length === listRecords.length && listRecords.length > 0;
  const someExpanded = hasExpandableConfig && expandedRowKeys.length > 0;

  // Expandable row configuration - reuses existing Table component for nested tables
  const expandable = useMemo(() => {
    if (!expandableConfig) return undefined;

    return {
      expandedRowKeys,
      onExpandedRowsChange: (keys: React.Key[]) => setExpandedRowKeys(keys),
      expandedRowRender: (record: any) => {
        // Build route params with parent record data for placeholder substitution
        const expandedRouteParams = {
          ...routeParams,
          ...record,
        };

        // Mode 1: Nested Table (reuses existing Table component)
        if (expandableConfig.mode === 'nested-table' && expandableConfig.tableConfig) {
          const {
            apiUrl,
            apiMethod = 'GET',
            responseKey = 'data',
            columns: columnFields,
            pageSize = 5,
            showPagination = true,
            defaultFilters: nestedDefaultFilters = {},
            showViewAll = false,
            viewAllModalWidth = 1200,
          } = expandableConfig.tableConfig;

          // Substitute placeholders in API URL (e.g., :teamId)
          const resolvedApiUrl = substituteUrlParams(apiUrl, expandedRouteParams);

          // Resolve default filters using placeholder resolver with record context
          // NOTE: Can't use usePlaceholderContext hook here (inside callback), so build context manually
          const nestedPlaceholderContext = {
            ...placeholderContext,  // Reuse actor, now from top-level hook
            routeParams: expandedRouteParams,
            record,  // Current row data
            parent: record,  // Parent record for nested context
          };
          const resolvedDefaultFilters = resolveFilterPlaceholders(nestedDefaultFilters, nestedPlaceholderContext);

          // Filter columns if specific fields are requested
          const filteredPropertiesConfig = columnFields && columnFields.length > 0
            ? propertiesConfig.filter(col => columnFields.includes(col.dataIndex))
            : propertiesConfig;

          return (
            <div>
              <Table
                propertiesConfig={filteredPropertiesConfig}
                apiConfig={{
                  apiUrl: resolvedApiUrl,
                  apiMethod,
                  responseKey,
                  useSearch: false,  // Nested tables use database mode by default
                }}
                routeParams={expandedRouteParams}
                defaultFilters={resolvedDefaultFilters}
                entityName={entityName}
              />
            </div>
          );
        }

        // Mode 2: Details (uses RenderFromPageType with details config)
        if (expandableConfig.mode === 'details') {
          const { fields, numColumns = 2 } = expandableConfig.detailsConfig || {};

          // Filter and transform table properties config to details field config
          const detailFields = (fields && fields.length > 0
            ? propertiesConfig.filter(col => fields.includes(col.dataIndex))
            : propertiesConfig  // Show all fields if no specific fields requested
          ).map(col => ({
            ...col,
            label: col.name,  // Map name to label for details
            dataIndex: col.dataIndex,
            initialValue: record[ col.dataIndex ],  // Set value from expanded record
          }));

          return (
            <div>
              <RenderFromPageType
                pageType="details"
                detailsPageConfig={{
                  dataSource: record as Record<string, unknown>,
                  propertiesConfig: detailFields,
                  columnsConfig: {
                    numColumns,
                    columns: [ { sortOrder: 0, fields: detailFields.map(c => c.dataIndex) } ]
                  }
                }}
                routeParams={expandedRouteParams}
              />
            </div>
          );
        }

        // Mode 3: Custom (uses RenderFromPageType with custom config)
        if (expandableConfig.mode === 'custom' && expandableConfig.customConfig) {
          const { pageType, pageConfig } = expandableConfig.customConfig;

          return (
            <div>
              <RenderFromPageType
                pageType={pageType}
                {...pageConfig}
                routeParams={expandedRouteParams}
              />
            </div>
          );
        }

        // Mode 4: JSON or fallback to JsonViewer (raw JSON view of the entire record using JsonViewer)
        // Use __raw__ to show original unformatted data (before date/boolean formatting)
        // Fall back to record if __raw__ doesn't exist
        const rawData = record.__raw__ || record;

        // Remove table-specific metadata fields
        const { __recordIdentifierKey__, ...cleanData } = rawData;

        return (
          <div style={{ margin: 0, padding: 0 }}>
            <JsonViewer
              data={cleanData}
              title="Record Data"
              defaultExpanded={true}
              showCopy={false}
              showStats={false}
              showModalButton={true}
            />
          </div>
        );
      },

      // Conditional row expansion based on condition evaluation
      // Use __raw__ record to evaluate against original field types (before boolean→Yes/No formatting)
      rowExpandable: (record: any) => {
        const expandCondition = expandableConfig?.rowExpandable;
        if (!expandCondition) return true; // No condition = always expandable
        const rawRecord = record.__raw__ || record;
        try {
          return conditionEvaluator.evaluateSync(
            expandCondition,
            { ...evaluationContext, record: rawRecord }
          );
        } catch {
          return true; // Fail-open: allow expansion if evaluation fails
        }
      },

      // Optional: Custom indent size
      indentSize: expandableConfig.indentSize,
    };
  }, [ expandableConfig, routeParams, propertiesConfig, entityName, expandedRowKeys, evaluationContext, placeholderContext ]);

  const renderPagination = () => {
    if (typeof Pagination === 'function') {
      return React.createElement(Pagination);
    }
    return Pagination;
  };

  // ── Memoized table props (avoid new references each render) ──

  const resolvedColumns = useMemo(() => {
    let cols = columns;
    if (hasPinnedColumns) {
      cols = cols.map(col => {
        const key = String(col.dataIndex || col.key || '');
        if (key && leftPinned.has(key)) return { ...col, fixed: 'left' as const };
        if (key && rightPinned.has(key)) return { ...col, fixed: 'right' as const };
        return col;
      });
    }
    if (resizeEnabled) {
      cols = cols.map(col => {
        const key = String(col.dataIndex || col.key || '');
        if (!key || key === 'action') return col;
        const width = columnWidths[ key ] || (typeof col.width === 'number' ? col.width : 150);
        return {
          ...col,
          width,
          onHeaderCell: () => ({
            width,
            onResize: handleColumnResize(key),
          }),
        };
      });
    }
    if (dataQualityConfig?.enabled && dataQualityConfig.showInList) {
      const qualityCol = {
        title: 'Completeness',
        dataIndex: '__dataQuality',
        key: '__dataQuality',
        width: 60,
        render: (_: unknown, record: Record<string, unknown>) => (
          <DataQualityIndicator
            record={record}
            config={dataQualityConfig}
            propertiesConfig={propertiesConfig}
            mode="compact"
          />
        ),
      };
      cols = [ ...cols, qualityCol ];
    }
    // Drag-handle column — prepended so it's always the first column (#62)
    if (rowDragConfig?.enabled) {
      const dragCol = {
        key: '__drag',
        dataIndex: '__drag',
        title: '',
        width: 36,
        fixed: 'left' as const,
        render: (_: unknown, record: Record<string, unknown>) => {
          const id = String(record[ recordIdentifierKey ] ?? '');
          return <DragHandleCell id={id} />;
        },
      };
      cols = [ dragCol, ...cols ];
    }
    return cols;
  }, [ columns, hasPinnedColumns, leftPinned, rightPinned, resizeEnabled, columnWidths, handleColumnResize, dataQualityConfig, propertiesConfig, rowDragConfig, recordIdentifierKey ]);

  const tableRowClassName = useMemo(() => {
    if (!rowFormatting || rowFormatting.length === 0) return undefined;
    return (record: IRecord) => {
      const rawRecord = record.__raw__ || record;
      const classNames: string[] = [];
      for (const rule of rowFormatting) {
        try {
          const match = conditionEvaluator.evaluateSync(rule.when, { ...evaluationContext, record: rawRecord });
          if (match && rule.className) {
            classNames.push(rule.className);
          }
        } catch {
          // Fail-safe: skip rule on evaluation error
        }
      }
      return classNames.join(' ');
    };
  }, [ rowFormatting, evaluationContext ]);

  const tableOnRow = useCallback((record: IRecord) => {
    const props: Record<string, unknown> = {};
    if (rowFormatting && rowFormatting.length > 0) {
      const rawRecord = record.__raw__ || record;
      const rowStyle: React.CSSProperties = {};
      for (const rule of rowFormatting) {
        try {
          const match = conditionEvaluator.evaluateSync(rule.when, { ...evaluationContext, record: rawRecord });
          if (match && rule.style) Object.assign(rowStyle, rule.style);
        } catch { /* fail-safe */ }
      }
      if (Object.keys(rowStyle).length > 0) props.style = rowStyle;
    }
    if (contextMenuConfig?.items?.length) {
      props.onContextMenu = (e: React.MouseEvent) => {
        ctxMenu.show(e, record);
      };
    }
    return props;
  }, [ rowFormatting, evaluationContext, contextMenuConfig, ctxMenu ]);

  const tableLocale = useMemo(() => ({
    emptyText: (
      <EmptyState
        variant={hasActiveFilters ? 'noResults' : 'noData'}
        entityName={entityName}
        config={emptyState}
        onClearFilters={hasActiveFilters ? clearAllFilters : undefined}
        onNavigate={coreNavigate}
      />
    ),
  }), [ hasActiveFilters, entityName, emptyState, clearAllFilters, coreNavigate ]);

  const tableLoading = useMemo(() => ({
    indicator: <div><Spin /></div>,
    spinning: isLoading,
  }), [ isLoading ]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        handleReload();
      }}
    >

      {showToolbar && (
        <div className="table-toolbar">
          <div style={{ flex: 1 }}>
            {isSearchMode && <Search onSearch={onSearch} value={searchQuery} />}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {canToggleSearchMode && (
              <Tooltip title={isSearchMode ? "Switch to Database Mode" : "Switch to Search Mode"}>
                <Button
                  icon={isSearchMode ? <DatabaseOutlined /> : <SearchOutlined />}
                  onClick={toggleSearchMode}
                  type={isSearchMode ? "default" : "primary"}
                />
              </Tooltip>
            )}
            {hasExpandableConfig && (
              <Tooltip title={allExpanded ? "Collapse All Rows" : "Expand All Rows"}>
                <Button
                  icon={allExpanded ? <ShrinkOutlined /> : <ExpandAltOutlined />}
                  onClick={allExpanded ? handleCollapseAll : handleExpandAll}
                  type={someExpanded ? "primary" : "default"}
                />
              </Tooltip>
            )}
            {useUnifiedSwitcher ? (
              <ViewSwitcher
                available={viewState.availableViews}
                active={viewState.activeView}
                onChange={viewState.switchView}
              />
            ) : displayModeConfig?.allowToggle ? (
              <Tooltip title={displayMode === 'table' ? 'Card View' : 'Table View'}>
                <Button
                  icon={displayMode === 'table' ? <AppstoreOutlined /> : <UnorderedListOutlined />}
                  onClick={toggleDisplayMode}
                />
              </Tooltip>
            ) : null}
            {savedViews.enabled && (
              <ViewSelector
                views={savedViews.views}
                activeViewId={savedViews.activeViewId}
                onLoad={handleLoadView}
                onSave={savedViews.saveView}
                onDelete={savedViews.deleteView}
                allowUserViews={viewsConfig?.allowUserViews}
              />
            )}
            <Tooltip title="Reset">
              <Button icon={<ClearOutlined />} onClick={handleRefresh} />
            </Tooltip>
            <RefreshControl
              onRefresh={handleReload}
              dataUpdatedAt={dataUpdatedAt}
              autoRefresh={autoRefresh}
            />
            {densityConfig?.allowToggle && (
              <Tooltip title={`Density: ${density}`}>
                <Button icon={<ColumnHeightOutlined />} onClick={cycleDensity} />
              </Tooltip>
            )}
            <Tooltip title="Column Settings">
              <Dropdown
                popupRender={() => (
                  <ColumnSettings
                    columns={columnSettings}
                    onColumnChange={handleColumnSettingsChange}
                    onReset={resetColumnSettings}
                    fetchStrategy={currentFetchStrategy}
                    onFetchStrategyChange={handleFetchStrategyChange}
                  />
                )}
                trigger={[ 'click' ]}
              >
                <Button icon={<SettingOutlined />} />
              </Dropdown>
            </Tooltip>
            <Tooltip title="View Applied Filters & Sorts">
              <Badge count={hasActiveFilters || hasActiveSorts ? (activeFiltersCount + activeSortsCount) : 0} color="blue">
                <Button disabled={!hasActiveFilters && !hasActiveSorts} icon={<NodeExpandOutlined />} onClick={() => setShowFilters(!showFilters)} />
              </Badge>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Bulk Actions Toolbar (shown when rows are selected) */}
      {selectedRowKeys.length > 0 && visibleBulkActions.length > 0 && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--ant-color-primary-bg, #e6f7ff)',
          borderRadius: '4px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontWeight: 500 }}>
            {selectedRowKeys.length} {selectedRowKeys.length === 1 ? 'item' : 'items'} selected
            {rowSelectionConfig?.persistAcrossPages && selectedRowKeys.length > (listRecords.length) && (
              <span style={{ color: 'var(--ant-color-primary, #1677ff)', marginLeft: 4, fontWeight: 400, fontSize: 12 }}>
                (across pages)
              </span>
            )}
            <Button
              type="link"
              size="small"
              onClick={() => setSelectedRowKeys([])}
              style={{ marginLeft: '8px' }}
            >
              Clear selection
            </Button>
          </div>
          <Space>
            {visibleBulkActions.map((action, index) => {
              const node = renderSingleAction({
                action,
                key: `bulk-action-${index}`,
                isDropdownItem: false,
                isTableRowAction: false,
                isDisabled: action._evaluated?.enabled === false,
                disabledMessage: action._evaluated?.disabledMessage || '',
                routeParams,
                record: undefined,
                selectedRecords,
                onSuccessCallback: handleReload,
              });
              return <React.Fragment key={`bulk-action-${index}`}>{node}</React.Fragment>;
            })}
          </Space>
        </div>
      )}

      {/* Filter Segments (quick filter tabs) */}
      {segments && segments.length > 0 && (
        <FilterSegments
          segments={segments}
          isSearchMode={isSearchMode}
          appliedFilters={appliedFilters}
          onSegmentChange={handleSegmentChange}
          placeholderContext={placeholderContext}
        />
      )}

      {/* Applied Filters & Sorts Display */}
      {showFilters && (
        <AppliedFiltersDisplay
          hasActiveFilters={hasActiveFilters}
          hasActiveSorts={hasActiveSorts}
          DisplayAppliedFilters={DisplayAppliedFilters}
          clearAllFilters={clearAllFilters}
          DisplayAppliedSorts={DisplayAppliedSorts}
          clearAllSorts={clearAllSorts}
        />
      )}

      {fetchError && listRecords.length === 0 && !isInitialLoad ? (
        <QueryErrorState
          error={fetchError}
          onRetry={handleReload}
          errorHandling={errorHandlingConfig}
          retry={retryConfig}
        />
      ) : isInitialLoad ? (
        <DataLoadingState type={loadingConfig?.type} pageType={useUnifiedSwitcher ? viewState.activeView : (isCardView ? 'card-grid' : 'table')} columns={propertiesConfig?.length || 5} rows={loadingConfig?.rows} />
      ) : (
        <>
          {/* Pagination: top or both */}
          {showPagination && (paginationConfig?.position === 'top' || paginationConfig?.position === 'both') && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              {renderPagination()}
            </div>
          )}
          <ViewContainer
            activeView={useUnifiedSwitcher ? viewState.activeView : (isCardView ? 'card-grid' : 'table')}
            tableView={
              <DragSortWrapper
                enabled={rowDragConfig?.enabled}
                rowIds={dragOrderIds}
                onOrderChange={handleDragOrderChange}
              >
                <AntTable<IRecord>
                  scroll={virtualScrollConfig?.enabled
                    ? { x: hasPinnedColumns ? 'max-content' : true, y: virtualScrollConfig.height ?? 500 }
                    : { x: hasPinnedColumns ? 'max-content' : true }
                  }
                  virtual={virtualScrollConfig?.enabled}
                  size={antTableSize}
                  components={rowDragConfig?.enabled
                    ? {
                      ...(resizeEnabled ? { header: { cell: ResizableTitle } } : {}),
                      body: { row: SortableRow },
                    }
                    : (resizeEnabled ? { header: { cell: ResizableTitle } } : undefined)
                  }
                  columns={resolvedColumns}
                  rowKey={recordIdentifierKey}
                  dataSource={rowDragConfig?.enabled ? orderedRecords : listRecords}
                  pagination={false}
                  loading={tableLoading}
                  onChange={handleTableChange}
                  rowSelection={rowSelection}
                  expandable={expandable}
                  rowClassName={tableRowClassName}
                  onRow={tableOnRow}
                  locale={tableLocale}
                  summary={summaryConfig ? (data) => (
                    <AntTable.Summary fixed>
                      <AntTable.Summary.Row>
                        {resolvedColumns.map((col, colIdx) => {
                          const colDataIndex = (col as { dataIndex?: string }).dataIndex;
                          const colConfig = summaryConfig.columns.find(c => c.dataIndex === colDataIndex);

                          // First column: show row label if provided (takes priority over aggregation)
                          if (colIdx === 0 && summaryConfig.label) {
                            return (
                              <AntTable.Summary.Cell key={0} index={0}>
                                <strong>{summaryConfig.label}</strong>
                              </AntTable.Summary.Cell>
                            );
                          }

                          if (!colConfig) return <AntTable.Summary.Cell key={colIdx} index={colIdx} />;

                          const val = computeSummaryCell(
                            colConfig.aggregation,
                            colConfig.dataIndex,
                            data as readonly Record<string, unknown>[],
                            colConfig.precision,
                            colConfig.label,
                          );
                          return (
                            <AntTable.Summary.Cell key={colIdx} index={colIdx}>
                              <strong>{`${colConfig.prefix ?? ''}${val}${colConfig.suffix ?? ''}`}</strong>
                            </AntTable.Summary.Cell>
                          );
                        })}
                      </AntTable.Summary.Row>
                    </AntTable.Summary>
                  ) : undefined}
                />
              </DragSortWrapper>
            }
            cardGridView={resolvedCardConfig ? (
              <CardView
                records={listRecords}
                cardConfig={resolvedCardConfig}
                recordIdentifierKey={recordIdentifierKey}
                onRecordClick={handleRecordClick}
                onActionClick={handleCardActionClick}
              />
            ) : undefined}
            kanbanView={viewSwitcherConfig?.kanbanConfig ? (
              <KanbanLayout
                records={listRecords}
                config={viewSwitcherConfig.kanbanConfig}
                recordIdentifierKey={recordIdentifierKey}
                onRecordClick={kanbanRecordClickHandler}
                onMoveRecord={viewSwitcherConfig.kanbanConfig.moveApiConfig ? handleKanbanMoveRecord : undefined}
                parentApiConfig={resolvedApiConfigForLayouts}
                appliedFilters={appliedFilters}
                routeParams={routeParams}
                entityName={entityName}
              />
            ) : undefined}
            calendarView={viewSwitcherConfig?.calendarConfig ? (
              <CalendarLayout
                records={listRecords}
                config={viewSwitcherConfig.calendarConfig}
                recordIdentifierKey={recordIdentifierKey}
                onRecordClick={calendarRecordClickHandler}
                parentApiConfig={resolvedApiConfigForLayouts}
                appliedFilters={appliedFilters}
                routeParams={routeParams}
                entityName={entityName}
              />
            ) : undefined}
            treeView={viewSwitcherConfig?.treeConfig ? (
              <TreeLayout
                records={listRecords}
                config={viewSwitcherConfig.treeConfig}
                recordIdentifierKey={recordIdentifierKey}
                onRecordClick={treeRecordClickHandler}
                parentApiConfig={resolvedApiConfigForLayouts}
                appliedFilters={appliedFilters}
                routeParams={routeParams}
                entityName={entityName}
              />
            ) : undefined}
            mapView={viewSwitcherConfig?.mapConfig ? (
              <MapLayout
                records={listRecords}
                config={viewSwitcherConfig.mapConfig}
                recordIdentifierKey={recordIdentifierKey}
                onRecordClick={mapRecordClickHandler}
                parentApiConfig={resolvedApiConfigForLayouts}
                appliedFilters={appliedFilters}
                routeParams={routeParams}
                entityName={entityName}
              />
            ) : undefined}
          />
          {/* Pagination: bottom (default) or both */}
          {showPagination && paginationConfig?.position !== 'top' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              {renderPagination()}
            </div>
          )}
        </>
      )}
      {/* Context menu overlay (#110) */}
      {contextMenuConfig && (
        <TableContextMenu
          {...ctxMenu.menuProps}
          config={contextMenuConfig}
          routeParams={routeParams}
          conditionEvaluator={conditionEvaluator}
          evaluationContext={evaluationContext}
          onNavigate={coreNavigate}
        />
      )}
    </ErrorBoundary>
  );
};


