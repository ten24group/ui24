import React, { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { ITablePropertiesConfig, ITableApiConfig, IDualTableApiConfig, SortConfig, IPaginationConfig, IRecord } from "./type";
import { Badge, Typography } from "antd";
import type { SorterResult } from 'antd/es/table/interface';

import { addActionUI } from "./Actions/addActionUI";
import { addFilterUI } from "./Filters/addFilterUI";
import { useCursorPagination, OffsetPagination } from "./Pagination/usePagination";
import { useAppliedFilters } from "./AppliedFilters/useAppliedFilters";
import { useAppliedSorts } from "./AppliedFilters/useAppliedSorts";
import { FilterFilled } from "@ant-design/icons";
import { useTableData } from "./hooks/useTableData";
import { evaluateTemplate } from "../core/utils/template";
import { Template } from "../core/types";
import { RelationFieldRenderer } from "./renderers/RelationFieldRenderer";
import { resolveFilterPlaceholders } from "../core/utils/placeholderResolver";
import { NON_FILTER_URL_PARAMS } from "./constants";
import { usePlaceholderContext } from "./hooks/usePlaceholderContext";
import { getColumnRenderer, type ColumnConfig } from "../core/registry";
import { useEvaluatedItems } from "../core/hooks/useEvaluatedItems";
import { useTranslation } from "../core/hooks";
import { fieldTypeRegistry } from "../core/registry/FieldTypeRegistry";
import { Icon } from "../core/common/Icons/Icons";
import "../core/registry/field-types"; // ensure built-in registrations run
import { conditionEvaluator } from "../core/utils/ConditionEvaluator";
import { getNestedValue } from "../core/utils";
import { useNewEvaluationContext } from "../core/context/NewEvaluationContext";
import { useRenderPipeline } from "../core/rendering";
import { MaskedDisplay } from "../core/common/MaskedDisplay";
import { computeDerivedValue } from "../core/hooks/useDerivedFields";
import { IS_DEV } from "../core/constants";
import { instrument } from "../core/telemetry";

interface IuseTable {
  propertiesConfig: Array<ITablePropertiesConfig>;
  apiConfig: ITableApiConfig | IDualTableApiConfig;
  routeParams?: Record<string, string>;
  defaultFilters?: Record<string, any>;
  fetchStrategy?: 'eager' | 'lazy';
  initialPageSize?: number;
  paginationConfig?: IPaginationConfig;
  /** Pre-loaded data — when provided, skips API fetching entirely (client-side data mode) */
  dataSource?: Array<Record<string, unknown>>;
}

// Utility functions to handle both single and dual API configurations
const isDualApiConfig = (config: ITableApiConfig | IDualTableApiConfig): config is IDualTableApiConfig => {
  return 'search' in config && 'database' in config;
};

const getCurrentApiConfig = (apiConfig: ITableApiConfig | IDualTableApiConfig, isSearchMode: boolean): ITableApiConfig => {
  if (isDualApiConfig(apiConfig)) {
    return isSearchMode ? apiConfig.search : apiConfig.database;
  }
  return apiConfig;
};

const canToggleSearchMode = (apiConfig: ITableApiConfig | IDualTableApiConfig): boolean => {
  return isDualApiConfig(apiConfig);
};

/**
 * Determine the default search/database mode for a given API config.
 * Respects REACT_APP_DEFAULT_LIST_MODE env var for dual configs.
 * Single-config entities use their `useSearch` flag.
 *
 * Used on both initial mount AND reset to ensure consistent behavior.
 */
const getDefaultSearchMode = (apiConfig: ITableApiConfig | IDualTableApiConfig): boolean => {
  if (isDualApiConfig(apiConfig)) {
    return process.env.REACT_APP_DEFAULT_LIST_MODE !== 'database';
  }
  return (apiConfig as ITableApiConfig).useSearch || false;
};

/**
 * Convert backend defaultSort format to Ant Design SorterResult format
 * 
 * Three formats:
 * 1. Object: { field: 'createdAt', order: 'desc' } → [{ field: 'createdAt', order: 'descend' }]
 * 2. Array: [{ field: 'publishDate', order: 'desc' }, ...] → Multi-column sorters
 * 3. String: 'asc' | 'desc' → [] (DynamoDB index order indicator, not an actual sort)
 * 
 * Note: For DynamoDB mode, the string format ('asc' | 'desc') just indicates the expected
 * index order direction. Since DynamoDB doesn't support arbitrary sorting with cursor pagination,
 * we return an empty array (no sort indicators shown in UI).
 */
const convertDefaultSortToSorterResult = (defaultSort: SortConfig | undefined): SorterResult<any>[] => {
  if (!defaultSort) return [];

  // Handle string format: 'asc' | 'desc'
  // This is for DynamoDB and indicates index order, NOT an actual sortable field
  // Return empty array since we don't have a field to sort by
  if (typeof defaultSort === 'string') {
    // Just 'asc' or 'desc' - this is DynamoDB index order indication
    // No field specified, so we can't create a sorter
    return [];
  }

  // Handle array format (multi-column sort for search mode)
  if (Array.isArray(defaultSort)) {
    return defaultSort.map(s => ({
      field: s.field,
      order: s.order === 'asc' ? 'ascend' : 'descend'
    } as SorterResult<any>));
  }

  // Handle object format (single column sort for search mode)
  return [ {
    field: defaultSort.field,
    order: defaultSort.order === 'asc' ? 'ascend' : 'descend'
  } as SorterResult<any> ];
};

/**
 * Get defaultSort from apiConfig based on current mode
 * Follows the same pattern as getCurrentApiConfig - respects the active mode
 */
const getDefaultSortFromApiConfig = (apiConfig: ITableApiConfig | IDualTableApiConfig, isSearchMode: boolean): SortConfig | undefined => {
  if (isDualApiConfig(apiConfig)) {
    // Use the config for the current mode (just like filters, pagination, etc.)
    return isSearchMode ? apiConfig.search?.defaultSort : apiConfig.database?.defaultSort;
  }
  return apiConfig.defaultSort;
};

/**
 * Parse filters from URL query params or sessionStorage (one-time read on mount)
 * Supports both direct query params and large param storage (f=key)
 * 
 * URL filters are treated as "deep link" parameters:
 * - Read ONCE on initial page load
 * - NOT synced back when other filters change (one-way read)
 * - Merged with default/segment filters on initialization
 * 
 * Internal structure ALWAYS uses operator format for UI compatibility:
 * - Plain values: sport=basketball → {sport: {eq: "basketball"}}
 * - With operator: sport.neq=football → {sport: {neq: "football"}}
 * - System params (debug, trace, mock) are IGNORED here, passed directly to API
 */
const getInitialFiltersFromUrl = (location: ReturnType<typeof useLocation>): Record<string, any> => {
  const queryParams = new URLSearchParams(location.search);

  // System/infrastructure params that should NOT be in filters
  // (defined in ./constants.ts for consistency across table code)

  // Filter operators supported by backend
  const OPERATORS = [ 'eq', 'ne', 'neq', 'in', 'nin', 'gte', 'gt', 'lte', 'lt', 'bt', 'contains', 'notContains', 'beginsWith', 'startsWith', 'endsWith', 'like', 'exists', 'notExists', 'isEmpty', 'isNull', 'notEmpty', 'notNull' ];

  // Helper to parse key with operator (e.g., "sport.neq" → {field: "sport", operator: "neq"})
  const parseKeyOperator = (key: string): { field: string; operator?: string } => {
    const parts = key.split('.');
    if (parts.length === 2 && OPERATORS.includes(parts[ 1 ])) {
      return { field: parts[ 0 ], operator: parts[ 1 ] };
    }
    return { field: key };
  };

  // Check for sessionStorage filter key (useLargeParamStorage pattern)
  const filterKey = queryParams.get('f');
  if (filterKey) {
    try {
      const storedData = sessionStorage.getItem(filterKey);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        // Convert flat query params to filter structure
        const filters: Record<string, any> = {};

        Object.entries(parsed).forEach(([ key, value ]) => {
          // Skip non-filter params (infrastructure)
          if (NON_FILTER_URL_PARAMS.includes(key)) {
            return;
          }

          // Parse key to check if it has an operator
          const { field, operator } = parseKeyOperator(key);

          // Deserialize value types
          let deserializedValue: any = value;

          if (typeof value === 'string') {
            // Try to detect arrays, booleans, numbers
            if (value.startsWith('[') && value.endsWith(']')) {
              try {
                deserializedValue = JSON.parse(value);
              } catch {
                deserializedValue = value;
              }
            } else if (value === 'true') {
              deserializedValue = true;
            } else if (value === 'false') {
              deserializedValue = false;
            } else if (/^\d+(\.\d+)?$/.test(value)) {
              deserializedValue = parseFloat(value);
            } else {
              deserializedValue = value;
            }
          }

          // Build filter structure (ALWAYS with operator for UI!)
          if (operator) {
            // Key already has operator
            if (!filters[ field ]) {
              filters[ field ] = {};
            }
            filters[ field ][ operator ] = deserializedValue;
          } else {
            // Plain key - WRAP in {eq: value} for UI!
            filters[ field ] = { eq: deserializedValue };
          }
        });
        return filters;
      }
    } catch (error) {
      console.error('Failed to restore filters from sessionStorage:', error);
    }
  }

  // Otherwise, parse regular query params as filters
  const filters: Record<string, any> = {};

  queryParams.forEach((value, key) => {
    // Skip non-filter params (infrastructure like page, cursor, etc.)
    if (NON_FILTER_URL_PARAMS.includes(key)) {
      return;
    }

    // Parse key to check if it has an operator (e.g., "sport.neq")
    const { field, operator } = parseKeyOperator(key);

    // Deserialize value
    let deserializedValue: any;
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        deserializedValue = JSON.parse(value);
      } catch {
        deserializedValue = value;
      }
    } else if (value === 'true') {
      deserializedValue = true;
    } else if (value === 'false') {
      deserializedValue = false;
    } else if (/^\d+(\.\d+)?$/.test(value)) {
      deserializedValue = parseFloat(value);
    } else {
      deserializedValue = value;
    }

    // Build filter structure (ALWAYS with operator for UI!)
    if (operator) {
      // Key already has operator: sport.neq=football → {sport: {neq: "football"}}
      if (!filters[ field ]) {
        filters[ field ] = {};
      }
      filters[ field ][ operator ] = deserializedValue;
    } else {
      // Plain key: sport=basketball → {sport: {eq: "basketball"}} (UI needs this!)
      filters[ field ] = { eq: deserializedValue };
    }
  });

  return filters;
};

/** Read deep-link state slices (sort, q, page) from URL on mount (#21). */
function getDeepLinkStateFromUrl(location: ReturnType<typeof useLocation>, prefix?: string): {
  sort?: Array<{ field: string; order: string }>;
  search?: string;
  page?: number;
} {
  const params = new URLSearchParams(location.search);
  const key = (k: string) => prefix ? `${prefix}.${k}` : k;
  const result: ReturnType<typeof getDeepLinkStateFromUrl> = {};

  const sortParam = params.get(key('sort'));
  if (sortParam) {
    result.sort = sortParam.split(',').map(s => {
      const [field, dir] = s.split(':');
      return { field, order: dir === 'asc' ? 'ascend' : 'descend' };
    });
  }

  const q = params.get(key('q'));
  if (q) result.search = q;

  const page = params.get(key('page'));
  if (page && /^\d+$/.test(page)) result.page = parseInt(page, 10);

  return result;
}

export const useTable = ({ propertiesConfig, apiConfig, routeParams = {}, defaultFilters = {}, fetchStrategy = 'eager', initialPageSize = 10, paginationConfig, dataSource: preloadedRecords }: IuseTable) => {
  const recordIdentifierKey = '__recordIdentifierKey__';
  const location = useLocation();

  // Build placeholder context once for resolving dynamic filter values
  const placeholderContext = usePlaceholderContext(routeParams);

  // Evaluation context for conditional cell formatting (#26)
  const evaluationContext = useNewEvaluationContext();

  const { t } = useTranslation(); // i18n (#22)

  // Rendering pipeline (#95) — provides processField() for unified field rendering
  const { processField } = useRenderPipeline({ renderContext: 'table', routeParams: routeParams || {} });

  // NOTE: registry resolution is handled via getColumnRenderer() (non-hook, safe for loops)

  // Resolve placeholders in defaultFilters (from prop, includes segment defaults from Table.tsx)
  const resolvedDefaultFilters = React.useMemo(() => {
    return resolveFilterPlaceholders(defaultFilters, placeholderContext);
  }, [ defaultFilters, placeholderContext ]);

  // Initialize appliedFilters from defaults + URL deep-link params (one-time on mount).
  // URL filters take precedence over defaults when present.
  const [ appliedFilters, setAppliedFilters ] = React.useState<Record<string, any>>(() => {
    const urlFilters = getInitialFiltersFromUrl(location);
    if (Object.keys(urlFilters).length > 0) {
      return { ...resolvedDefaultFilters, ...urlFilters };
    }
    return { ...resolvedDefaultFilters };
  });
  // Read deep-link state from URL on mount (#21)
  const urlDeepLinkState = React.useMemo(() => getDeepLinkStateFromUrl(location), []);
  const [ searchQuery, setSearchQuery ] = React.useState<string>(urlDeepLinkState.search ?? '');

  // Determine initial mode FIRST (needed to get correct defaultSort).
  // Uses getDefaultSearchMode() to respect REACT_APP_DEFAULT_LIST_MODE env var for dual configs.
  const [ isSearchMode, setIsSearchMode ] = React.useState<boolean>(() => getDefaultSearchMode(apiConfig));

  // Then initialize sort based on the current mode
  const [ sort, setSort ] = React.useState<SorterResult<any>[]>(() => {
    if (urlDeepLinkState.sort && urlDeepLinkState.sort.length > 0) {
      return urlDeepLinkState.sort.map((s, i) => ({
        field: s.field,
        columnKey: s.field,
        order: s.order as 'ascend' | 'descend',
        column: { dataIndex: s.field } as any,
      }));
    }
    const initialMode = getDefaultSearchMode(apiConfig);
    const defaultSort = getDefaultSortFromApiConfig(apiConfig, initialMode);
    return convertDefaultSortToSorterResult(defaultSort);
  });
  const [ visibleColumns, setVisibleColumns ] = React.useState<string[]>(
    propertiesConfig.filter(p => {
      // Check defaultVisible first (new property), fallback to !hidden for backward compatibility
      if (p.hasOwnProperty('defaultVisible')) {
        return p.defaultVisible !== false;
      }
      return !p.hidden;
    }).map(p => p.dataIndex)
  );
  const [ columnSettings, setColumnSettings ] = React.useState(
    propertiesConfig.map(p => {
      // Check defaultVisible first (new property), fallback to !hidden for backward compatibility
      const isVisible = p.hasOwnProperty('defaultVisible')
        ? p.defaultVisible !== false
        : !p.hidden;

      return {
        key: p.dataIndex,
        title: p.name,
        visible: isVisible,
        fixed: p.actions ? 'right' : undefined,
        isIdentifier: p.isIdentifier,
      };
    })
  );

  // Manage current fetch strategy (session-only, user can change in Column Settings)
  const [ currentFetchStrategy, setCurrentFetchStrategy ] = React.useState<'eager' | 'lazy'>(fetchStrategy);
  const [ facetedColumns, setFacetedColumns ] = React.useState<string[]>([]);

  // Page size state (records per page) - user can change via pagination controls
  // Initialize with backend config or default to 10
  const [ pageSize, setPageSize ] = React.useState(initialPageSize);

  // fetchTrigger starts at 1 to trigger initial fetch on mount
  // This ensures tables load data immediately after initialization (with merged defaults + URL filters)
  const [ fetchTrigger, setFetchTrigger ] = React.useState(1);

  // Ref to signal that the next fetchTrigger-driven fetch should bypass the React Query cache.
  // Set to true before incrementing fetchTrigger (e.g., Reset button) so the effect can pass forceRefresh.
  const forceNextFetchRef = React.useRef(false);

  const tableDataResult = useTableData({
    apiConfig: getCurrentApiConfig(apiConfig, isSearchMode),
    routeParams,
    appliedFilters,
    searchQuery,
    sort,
    visibleColumns,
    facetedColumns,
    propertiesConfig,
    recordIdentifierKey,
    isSearchMode,
    fetchStrategy: currentFetchStrategy,
    pageSize,
    initialPage: 1,
  });

  // Client-side data mode: when preloadedRecords is provided, bypass API results
  const isClientSideData = !!preloadedRecords;
  const {
    listRecords,
    isLoading,
    isInitialLoad,
    currentPage,
    pageCursor,
    isLastPage,
    totalRecords,
    facetResults,
    fetchRecords,
    pageSize: currentPageSize,
    dataUpdatedAt,
    error: fetchError,
  } = isClientSideData
    ? {
        listRecords: preloadedRecords,
        isLoading: false,
        isInitialLoad: false,
        currentPage: 1,
        pageCursor: tableDataResult.pageCursor,
        isLastPage: true,
        totalRecords: preloadedRecords.length,
        facetResults: {},
        fetchRecords: tableDataResult.fetchRecords,
        pageSize: tableDataResult.pageSize,
        dataUpdatedAt: new Date().toISOString(),
        error: null,
      }
    : tableDataResult;

  const onSearch = (value: string) => {
    setSearchQuery(value);
    setFetchTrigger(prev => prev + 1);
    instrument.event('table.search', { 'table.searchQuery': value });
  }

  const toggleSearchMode = React.useCallback(() => {
    if (canToggleSearchMode(apiConfig)) {
      // Compute the new mode outside the updater so setSort can be called separately
      // (updater functions should be pure — no side effects like calling other setState)
      setIsSearchMode(prev => !prev);
      // Use the current value to derive what the new mode will be after the toggle
      // React batches these setState calls, so isSearchMode still has the old value here
      const newMode = !isSearchMode;
      const defaultSort = getDefaultSortFromApiConfig(apiConfig, newMode);
      setSort(convertDefaultSortToSorterResult(defaultSort));
      setSearchQuery('');
      // Reset to defaultFilters (preserves pre-applied filters like relation defaults)
      setAppliedFilters(resolvedDefaultFilters);
      // NOTE: Don't trigger fetch here:
      // - If segments exist, FilterSegments detects mode change and re-applies filters
      // - If no segments, Table.tsx useEffect on isSearchMode triggers fetch
      // This prevents double fetching
    }
  }, [ apiConfig, resolvedDefaultFilters, isSearchMode ]);

  const handleTableChange = (_pagination: unknown, _filters: unknown, sorter: SorterResult<any> | SorterResult<any>[]) => {
    const newSorters = Array.isArray(sorter) ? sorter : [ sorter ];
    const activeSorts = newSorters.filter(s => s.order);
    setSort(activeSorts);
    setFetchTrigger(prev => prev + 1);
    instrument.event('table.sort', { 
      'table.sortCount': activeSorts.length,
      'table.sortFields': activeSorts.map(s => s.field).join(','),
    });
  };

  // Determine stable API URL for entity identification
  // This prevents resetting filters when switching between search/database modes (which change current API URL)
  const stableApiUrl = isDualApiConfig(apiConfig) ? apiConfig.database?.apiUrl : apiConfig.apiUrl;

  // Track initial dependencies to detect actual entity changes (vs React Strict Mode re-mount)
  const initialDepsRef = React.useRef({
    url: stableApiUrl,
    cols: propertiesConfig.map(p => p.dataIndex).join(',')
  });

  // Reset table state when navigating between different entities
  // Use useLayoutEffect to run BEFORE fetch effect (prevents double fetch)
  useLayoutEffect(() => {
    const currentCols = propertiesConfig.map(p => p.dataIndex).join(',');

    // Check if configuration actually changed (not just Strict Mode double-invocation)
    // Using value comparison (url + columns) instead of boolean flag prevents reset on re-mount
    if (stableApiUrl === initialDepsRef.current.url && currentCols === initialDepsRef.current.cols) {
      // Same entity, don't reset (could be Strict Mode or initial mount)
      return;
    }

    // Different entity detected, update refs for next comparison
    initialDepsRef.current = { url: stableApiUrl, cols: currentCols };

    setVisibleColumns(propertiesConfig.filter(p => {
      // Check defaultVisible first (new property), fallback to !hidden for backward compatibility
      if (p.hasOwnProperty('defaultVisible')) {
        return p.defaultVisible !== false;
      }
      return !p.hidden;
    }).map(p => p.dataIndex));

    setColumnSettings(propertiesConfig.map(p => {
      // Check defaultVisible first (new property), fallback to !hidden for backward compatibility
      const isVisible = p.hasOwnProperty('defaultVisible')
        ? p.defaultVisible !== false
        : !p.hidden;

      return {
        key: p.dataIndex,
        title: p.name,
        visible: isVisible,
        fixed: p.actions ? 'right' : undefined,
        isIdentifier: p.isIdentifier,
      };
    }));
    setFacetedColumns([]);

    // Reset filters and search when navigating to a different entity
    // IMPORTANT: Don't read URL filters here - they're only applied on initial mount (one-time read)
    // This prevents old filters from sticking when navigating between pages
    setAppliedFilters(resolvedDefaultFilters);
    setSearchQuery('');

    // Reset sort to default for the current mode
    const defaultSort = getDefaultSortFromApiConfig(apiConfig, isSearchMode);
    setSort(convertDefaultSortToSorterResult(defaultSort));

    // Trigger fetch with new state
    setFetchTrigger(prev => prev + 1);
  }, [ stableApiUrl, propertiesConfig.map(p => p.dataIndex).join(',') ]);

  // Fetch data when fetchTrigger changes
  // fetchTrigger starts at 1, so this triggers the initial fetch on mount
  // Subsequent increments trigger refetch (from filters, search, sort, etc.)
  React.useEffect(() => {
    const shouldForce = forceNextFetchRef.current;
    forceNextFetchRef.current = false;
    fetchRecords(1, undefined, shouldForce ? { forceRefresh: true } : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ fetchTrigger ]); // Depend on fetchTrigger, not appliedFilters (avoids circular updates)

  const handleRefresh = React.useCallback(() => {
    // Reset to defaultFilters instead of clearing everything
    // This preserves pre-applied filters (e.g., awayTeamId from relation modals)
    setAppliedFilters(resolvedDefaultFilters);
    setSearchQuery('');

    // Reset to the env-configured default mode (respects REACT_APP_DEFAULT_LIST_MODE).
    // Previously this hardcoded `true` for dual configs, which wrongly forced search mode
    // even when the env var specified 'database' as the default.
    const resetMode = getDefaultSearchMode(apiConfig);
    setIsSearchMode(resetMode);

    // Reset sort to defaultSort for the reset mode
    const defaultSort = getDefaultSortFromApiConfig(apiConfig, resetMode);
    setSort(convertDefaultSortToSorterResult(defaultSort));

    // Use fetchTrigger instead of calling fetchRecords directly.
    // Direct calls would use stale closure values (old filters/sort/search/mode).
    // fetchTrigger defers the fetch to the next render where fetchRecords has the correct state.
    forceNextFetchRef.current = true;
    setFetchTrigger(prev => prev + 1);
  }, [ apiConfig, resolvedDefaultFilters ]);

  // Refs for handleReload stability — reading page/cursor from refs makes handleReload's
  // identity depend only on fetchRecords (which is already stable). Without refs,
  // handleReload changes on every pagination (pageCursor updates), propagating
  // unnecessary re-renders to RefreshControl, useAutoRefresh, bulk actions, etc.
  // Note: currentPageRef is also used by the persistence section below.
  const currentPageRef = React.useRef(currentPage);
  currentPageRef.current = currentPage;
  const pageCursorRef = React.useRef(pageCursor);
  pageCursorRef.current = pageCursor;

  const handleReload = React.useCallback(() => {
    const page = currentPageRef.current;
    fetchRecords(page, pageCursorRef.current[ page ], { forceRefresh: true });
  }, [ fetchRecords ]);

  const getColumnNameByKey = (dataIndex: string) => {
    return propertiesConfig.find((column) => column.dataIndex === dataIndex)?.name;
  }

  //Filters
  const { applyFilters: _applyFilters, DisplayAppliedFilters, clearAllFilters: _clearAllFilters, hasActiveFilters, activeFiltersCount } = useAppliedFilters({
    appliedFilters,
    setAppliedFilters,
    getColumnNameByKey,
    onFilterChange: () => setFetchTrigger(prev => prev + 1)
  });

  const applyFilters = React.useCallback((column: string, filterOperator: string, value: string | Array<string>) => {
    _applyFilters(column, filterOperator, value);
    setFetchTrigger(prev => prev + 1);
    instrument.event('table.filter', { 
      'table.filterColumn': column,
      'table.filterOperator': filterOperator,
    });
  }, [ _applyFilters ]);

  const clearAllFilters = React.useCallback(() => {
    _clearAllFilters();
    setFetchTrigger(prev => prev + 1);
    instrument.event('table.filterClear', {});
  }, [ _clearAllFilters ]);

  // Stabilize with useCallback - memoization dependency
  const getAppliedFilterForColumn = React.useCallback((column: string) => {
    return appliedFilters[ column ] || {};
  }, [ appliedFilters ]);

  const toggleFacetedColumn = React.useCallback((dataIndex: string) => {
    setFacetedColumns(prev =>
      prev.includes(dataIndex)
        ? prev.filter(d => d !== dataIndex)
        : [ ...prev, dataIndex ]
    );
    setFetchTrigger(prev => prev + 1);
  }, []); // No dependencies - uses functional updates

  //Sorts
  const { DisplayAppliedSorts, clearAllSorts: _clearAllSorts, hasActiveSorts, activeSortsCount } = useAppliedSorts({
    sort,
    setSort,
    getColumnNameByKey
  });

  const clearAllSorts = React.useCallback(() => {
    _clearAllSorts();
    setFetchTrigger(prev => prev + 1);
  }, [ _clearAllSorts ]);

  // Handle page size change - reset to page 1 and trigger fetch
  const handlePageSizeChange = React.useCallback((newSize: number) => {
    setPageSize(newSize);
    setFetchTrigger(prev => prev + 1); // Trigger refetch via useEffect with updated pageSize
  }, []);

  // Pagination — both modes use shared components from Pagination/usePagination.tsx
  const { Pagination: CursorPagination } = useCursorPagination({
    pageCursor,
    getRecords: fetchRecords,
    currentPage,
    isLastPage,
    pageSize,
    onPageSizeChange: handlePageSizeChange,
    currentPageRecordCount: listRecords.length,
    paginationConfig,
  });

  const NumericalPaginationElement = (
    <OffsetPagination
      currentPage={currentPage}
      totalRecords={totalRecords}
      pageSize={currentPageSize}
      onPageChange={fetchRecords}
      onPageSizeChange={handlePageSizeChange}
      paginationConfig={paginationConfig}
    />
  );

  // Batch evaluate column visibility conditions
  const { visibleItems: conditionVisibleProperties } = useEvaluatedItems(propertiesConfig);

  const selectableColumns = React.useMemo(() => conditionVisibleProperties.filter(p => !p.isIdentifier), [ conditionVisibleProperties ]);

  const handleColumnSettingsChange = (newSettings: typeof columnSettings) => {
    setColumnSettings(newSettings);
    setVisibleColumns(newSettings.filter(c => c.visible).map(c => c.key));
  };

  const resetColumnSettings = () => {
    const defaultSettings = propertiesConfig.map(p => {
      // Check defaultVisible first (new property), fallback to !hidden for backward compatibility
      const isVisible = p.hasOwnProperty('defaultVisible')
        ? p.defaultVisible !== false
        : !p.hidden;

      return {
        key: p.dataIndex,
        title: p.name,
        visible: isVisible,
        fixed: p.actions ? 'right' : undefined,
        isIdentifier: p.isIdentifier,
      };
    });
    handleColumnSettingsChange(defaultSettings);
  };

  const handleFetchStrategyChange = (strategy: 'eager' | 'lazy') => {
    setCurrentFetchStrategy(strategy);
    // Trigger a refetch with the new strategy
    setFetchTrigger(prev => prev + 1);
  };

  // Remove entire column from filters (used by filter UI)
  // Stabilize with useCallback - memoization dependency
  const removeFilter = React.useCallback((col: string) => {
    setAppliedFilters(prev => {
      const { [ col ]: _, ...rest } = prev;
      return rest;
    });
    setFetchTrigger(prev => prev + 1);
  }, []); // No dependencies - uses functional updates

  // OPTIMIZATION: Cache column renderers to avoid creating new functions
  // Template renderers are pure functions - same template always produces same renderer
  const rendererCache = React.useRef<Map<string, (text: any, record: any) => any>>(new Map());

  const getTemplateRenderer = React.useCallback((template: string | object) => {
    const cacheKey = typeof template === 'string' ? template : JSON.stringify(template);

    if (!rendererCache.current.has(cacheKey)) {
      rendererCache.current.set(cacheKey, (text: any, record: any) => {
        try {
          return evaluateTemplate(template as Template, record);
        } catch (e) {
          if (IS_DEV) {
            console.warn(`[Table] Template evaluation failed:`, e);
          }
          return text;  // Fallback to original value
        }
      });
    }

    return rendererCache.current.get(cacheKey)!;
  }, []);

  // All field type renderers are now in the FieldTypeRegistry (field-types/ files).

  const columns = addFilterUI(
    addActionUI(conditionVisibleProperties, handleReload, routeParams),
    applyFilters,
    removeFilter,
    getAppliedFilterForColumn,
    facetResults,
    facetedColumns,
    toggleFacetedColumn,
    !!isSearchMode
  )
    .map((column, index) => {
      if (column.key === 'action') return column;

      // Run rendering pipeline for this column (#95)
      // Uses processField to evaluate visibility, resolve conditional labels, and apply formatting metadata
      const pipelineResult = processField(column, null, {}, index);
      if (!pipelineResult.isVisible) {
        return { ...column, hidden: true }; // Mark hidden, filtered below
      }
      // Apply resolved label from pipeline (handles ConditionalValue<string> on name/title)
      if (pipelineResult.resolvedProps.label !== undefined) {
        column = { ...column, name: t(pipelineResult.resolvedProps.label) }; // i18n (#22)
      } else if (column.name) {
        column = { ...column, name: t(column.name) }; // i18n (#22) — translate raw labels too
      }

      let renderer = column.render;
      // Tracks table-level registry defaults for this column so they can be
      // merged into the antd column definition (for align/width/ellipsis/etc).
      // Only set when Priority 3 (FieldTypeRegistry) provides the renderer —
      // custom and extension renderers don't use registry defaults.
      let columnTableDefaults: Record<string, unknown> | undefined;

      // Priority 1: Relation config renderer (for related entities)
      if (column.relationConfig) {
        renderer = (value: any, record: any) => (
          <RelationFieldRenderer
            relationConfig={column.relationConfig!}
            value={value}
            record={record}
            routeParams={routeParams}
            label={column.name}
          />
        );
      }
      // Priority 1.5: Composite column renderer (multi-field columns)
      else if (column.composite) {
        const { fields, template: compositeTemplate, layout = 'stacked' } = column.composite;
        renderer = (_value: any, record: Record<string, unknown>) => {
          if (compositeTemplate) {
            return <span>{evaluateTemplate(compositeTemplate, record)}</span>;
          }
          const values = fields.map(f => getNestedValue(record, f)).filter(v => v != null);
          if (values.length === 0) return <span>—</span>;
          if (layout === 'inline') {
            return (
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                {values.map((v, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span style={{ color: '#d9d9d9' }}>·</span>}
                    <span>{String(v)}</span>
                  </React.Fragment>
                ))}
              </span>
            );
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.4 }}>
              <span style={{ fontWeight: 500 }}>{String(values[ 0 ])}</span>
              {values.slice(1).map((v, i) => (
                <span key={i} style={{ fontSize: '0.85em', color: '#8c8c8c' }}>{String(v)}</span>
              ))}
            </div>
          );
        };
      }
      // Priority 2: Template renderer (for composite values)
      else if (column.template) {
        renderer = getTemplateRenderer(column.template);
      }
      // Priority 2.5: ExtensionRegistry custom renderer
      else if (column.renderer || column.fieldType) {
        const { Component: CustomColumnRenderer, resolverContext } = getColumnRenderer(column.fieldType || '', {
          fieldName: column.dataIndex,
          explicitRenderer: column.renderer,
          routeParams
        });

        if (CustomColumnRenderer) {
          renderer = (value: any, record: any, rowIndex: number) => {
            const customColumnProps = {
              routeParams: resolverContext.routeParams,
              depth: resolverContext.depth,
              value,
              record,
              column: column as ColumnConfig,
              rowIndex
            };
            return <CustomColumnRenderer {...customColumnProps} />;
          };
        }
      }
      // Priority 3: Field type specific renderers (built-in via FieldTypeRegistry)
      if (!renderer && (column.fieldType || column.type)) {
        // Map structural types to fieldType for registry lookup
        let effectiveFieldType = (column.fieldType || '').toLowerCase();
        if (column.type === 'map' && !fieldTypeRegistry.get(effectiveFieldType, 'table')) {
          effectiveFieldType = 'json';
        }
        if (column.type === 'list' && effectiveFieldType !== 'multi-select') {
          effectiveFieldType = 'list';
        }

        const TableComponent = fieldTypeRegistry.get(effectiveFieldType, 'table');
        if (TableComponent) {
          // Merge smart defaults from registry (#98): defaults < entity config
          const tableDefaults = fieldTypeRegistry.getDefaults(effectiveFieldType, 'table');
          columnTableDefaults = tableDefaults; // saved so the return below can spread into antd col def
          const mergedColumn = tableDefaults ? { ...tableDefaults, ...column } : column;
          renderer = (text: unknown, record: Record<string, unknown>, rowIndex: number) => (
            <TableComponent value={text} record={record} column={mergedColumn} rowIndex={rowIndex} routeParams={routeParams} />
          );
        }
      }

      // Wrap renderer with conditional cell formatting (#26)
      if (column.formatting && column.formatting.length > 0 && renderer) {
        type BadgeStatus = 'success' | 'processing' | 'error' | 'warning' | 'default';
        const baseRenderer = renderer;
        const formattingRules = column.formatting;
        renderer = (text: unknown, record: IRecord, rowIndex: number) => {
          const rawRecord = record.__raw__ || record;
          let cellStyle: React.CSSProperties = {};
          let cellClassName = '';
          let matchedBadge: { status: BadgeStatus } | undefined;
          let matchedIcon: { name: string; color?: string } | undefined;
          for (const rule of formattingRules) {
            try {
              const match = conditionEvaluator.evaluateSync(rule.when, { ...evaluationContext, record: rawRecord });
              if (match) {
                if (rule.style) Object.assign(cellStyle, rule.style);
                if (rule.className) cellClassName += (cellClassName ? ' ' : '') + rule.className;
                if (rule.badge && !matchedBadge) matchedBadge = rule.badge;
                if (rule.icon && !matchedIcon) matchedIcon = rule.icon;
              }
            } catch {
              // Fail-safe: skip rule on evaluation error
            }
          }
          let content = baseRenderer(text, record, rowIndex);
          const hasStyleOrClass = Object.keys(cellStyle).length > 0 || cellClassName;
          if (hasStyleOrClass) {
            content = <span style={cellStyle} className={cellClassName || undefined}>{content}</span>;
          }
          if (matchedIcon) {
            content = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon iconName={matchedIcon.name} />{content}
            </span>;
          }
          if (matchedBadge) {
            content = <Badge status={matchedBadge.status} text={content} />;
          }
          return content;
        };
      }

      // Wrap with copyable (#60) when config says so — works for ALL columns including plain text
      if (column.copyable) {
        const copyableBase = renderer;
        const isComposite = !!column.composite;
        const isJson = column.fieldType === 'json' || column.type === 'map';
        renderer = (text: unknown, record: Record<string, unknown>, rowIndex: number) => {
          const content = copyableBase ? copyableBase(text, record, rowIndex) : (text != null ? String(text) : '—');
          // Compute clipboard text based on column type
          let clipboardText: string;
          if (isComposite && column.composite) {
            const vals = column.composite.fields.map(f => getNestedValue(record, f)).filter(v => v != null);
            clipboardText = vals.map(String).join(' ');
          } else if (isJson || (text && typeof text === 'object')) {
            clipboardText = JSON.stringify(text, null, 2);
          } else {
            clipboardText = text != null ? String(text) : '';
          }
          if (!clipboardText) return content;
          return (
            <Typography.Text copyable={{ text: clipboardText, tooltips: [ 'Copy', 'Copied' ] }} style={{ display: 'inline' }}>
              {content}
            </Typography.Text>
          );
        };
      }

      // Derived / computed column values (#35) — compute from record at render time
      if (column.derived) {
        const derivedBase = renderer;
        const derivedConfig = column.derived;
        renderer = (text: unknown, record: IRecord, rowIndex: number) => {
          const rawRecord = record.__raw__ || record;
          const derivedValue = computeDerivedValue(derivedConfig, rawRecord as Record<string, unknown>);
          if (derivedValue !== undefined) {
            return derivedBase ? derivedBase(derivedValue, record, rowIndex) : String(derivedValue);
          }
          return derivedBase ? derivedBase(text, record, rowIndex) : (text != null ? String(text) : '—');
        };
      }

      // Data masking (#51) — wrap string cell values when masking is configured
      if (column.masking?.enabled) {
        const maskingBase = renderer;
        const maskingConfig = column.masking;
        renderer = (text: unknown, record: IRecord, rowIndex: number) => {
          if (typeof text === 'string' && text) {
            return <MaskedDisplay value={text} config={maskingConfig} />;
          }
          return maskingBase ? maskingBase(text, record, rowIndex) : (text != null ? String(text) : '—');
        };
      }

      const columnSetting = columnSettings.find(s => s.key === column.dataIndex);
      return {
        // Registry defaults (lowest priority) — makes align/width/ellipsis from
        // FieldTypeRegistry actually reach antd's Table column definition.
        // Entity config always wins because it's spread after.
        ...columnTableDefaults,
        ...column,
        title: columnSetting?.title || column.name || column.dataIndex,
        render: renderer,
        fixed: columnSetting?.fixed,
        sorter: (isSearchMode && (column.isSortable === true || column.isSortable === undefined)) ? { multiple: index + 1 } : undefined,
        sortOrder: sort.find(s => s.field === column.dataIndex)?.order,
        filterIcon: <FilterFilled style={{ color: !!appliedFilters[ column.dataIndex ] ? "#1677ff" : undefined }} />,
      };
    })
    .filter(c => !c.hidden) // Remove pipeline-hidden columns (#95)
    .filter(c => c.key === 'action' || columnSettings.find(s => s.key === c.dataIndex)?.visible)
    .sort((a, b) => {
      const aIndex = columnSettings.findIndex(s => s.key === a.dataIndex);
      const bIndex = columnSettings.findIndex(s => s.key === b.dataIndex);
      if (a.fixed === 'right' || a.key === 'action') return 1;
      if (b.fixed === 'right' || b.key === 'action') return -1;
      if (a.fixed === 'left') return -1;
      if (b.fixed === 'left') return 1;
      return aIndex - bIndex;
    });

  // Apply column grouping based on groupTitle property
  // Uses Ant Design's children property to create grouped column headers
  const finalColumns = React.useMemo(() => {
    // Check if any columns have groupTitle
    const hasGroups = columns.some(col => col.groupTitle);
    if (!hasGroups) {
      return columns;
    }

    type Column = (typeof columns)[ number ];
    const grouped: Array<Column | { title: string; children: Column[] }> = [];
    const groupedFieldSet = new Set<string>();
    const groupMap = new Map<string, Column[]>();

    // Group columns by groupTitle
    columns.forEach(col => {
      if (col.groupTitle) {
        if (!groupMap.has(col.groupTitle)) {
          groupMap.set(col.groupTitle, []);
        }
        groupMap.get(col.groupTitle)!.push(col);
        groupedFieldSet.add(col.dataIndex as string);
      }
    });

    // Create grouped column structures
    groupMap.forEach((childColumns, groupTitle) => {
      grouped.push({
        title: t(groupTitle), // i18n (#22)
        children: childColumns
      });
    });

    // Add ungrouped columns (including action column)
    const ungroupedColumns = columns.filter(col =>
      !groupedFieldSet.has(col.dataIndex as string)
    );

    return [ ...grouped, ...ungroupedColumns ];
  }, [ columns ]);


  return {
    recordIdentifierKey,
    columns: finalColumns,
    listRecords,
    isLoading,
    isInitialLoad,
    Pagination: isSearchMode ? NumericalPaginationElement : CursorPagination,
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
    selectableColumns,
    searchQuery,
    columnSettings,
    handleColumnSettingsChange,
    resetColumnSettings,
    currentFetchStrategy,
    handleFetchStrategyChange,
    isSearchMode,
    toggleSearchMode,
    canToggleSearchMode: canToggleSearchMode(apiConfig),
    appliedFilters,
    setAppliedFilters,  // Exposed for FilterSegments to update filters
    setFetchTrigger,    // Exposed to trigger refetch after state updates
    fetchRecords,       // Exposed to allow immediate fetch with filtersOverride (bypasses React async setState)
    dataUpdatedAt,      // Timestamp of last successful data fetch (#106)
    processField,       // Rendering pipeline (#95) — run a field through evaluate→transform→resolve→select→format
    fetchError,          // Query error (#58) — for inline error state rendering
    currentPage,        // Current page number (#21) — for deep link URL sync
    sort,               // Active sort state (#21) — SorterResult[] for deep link URL sync
  };
};
