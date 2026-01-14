import React, { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { ITablePropertiesConfig, ITableApiConfig, IDualTableApiConfig, SortConfig } from "./type";
import { IApiConfig } from "../core/context";
import { Pagination as AntPagination, Badge, Tag, Progress, Avatar, Rate } from "antd";
import type { SorterResult } from 'antd/es/table/interface';

import { addActionUI } from "./Actions/addActionUI";
import { addFilterUI } from "./Filters/addFilterUI";
import { usePagination } from "./Pagination/usePagination";
import { useAppliedFilters } from "./AppliedFilters/useAppliedFilters";
import { useAppliedSorts } from "./AppliedFilters/useAppliedSorts";
import { FilterFilled, PlayCircleOutlined, AudioOutlined, QrcodeOutlined } from "@ant-design/icons";
import { useTableData } from "./hooks/useTableData";
import { evaluateTemplate } from "../core/utils/template";
import { Template } from "../core/types";
import { RelationFieldRenderer } from "./renderers/RelationFieldRenderer";
import { resolveFilterPlaceholders } from "../core/utils/placeholderResolver";
import { NON_FILTER_URL_PARAMS } from "./constants";
import { usePlaceholderContext } from "./hooks/usePlaceholderContext";
import { Button } from "antd";
import { EyeOutlined, FileTextOutlined, OrderedListOutlined } from '@ant-design/icons';
import { OpenInModal } from "../modal/Modal";
import { generateJsonPreview } from "../core/utils/jsonUtils";
import { createModalConfig } from "./utils/modalConfigHelper";
import * as Icons from '@ant-design/icons';
import { formatDuration, formatTTL, DurationUnit, TTLUnit, DurationFormat, TTLFormat } from "../core/utils/duration";
import { getColumnRenderer, type ColumnConfig } from "../core/registry";

interface IuseTable {
  propertiesConfig: Array<ITablePropertiesConfig>;
  apiConfig: ITableApiConfig | IDualTableApiConfig;
  routeParams?: Record<string, string>;
  defaultFilters?: Record<string, any>; // Pre-applied filters (supports placeholders like ":teamId")
  fetchStrategy?: 'eager' | 'lazy'; // Controls whether to fetch all columns (eager) or only visible columns (lazy)
  initialPageSize?: number; // Default page size from backend config
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
          if (NON_FILTER_URL_PARAMS.includes(key as any)) {
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
    if (NON_FILTER_URL_PARAMS.includes(key as any)) {
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

export const useTable = ({ propertiesConfig, apiConfig, routeParams = {}, defaultFilters = {}, fetchStrategy = 'eager', initialPageSize = 10 }: IuseTable) => {
  const recordIdentifierKey = '__recordIdentifierKey__';
  const location = useLocation();

  // Build placeholder context once for resolving dynamic filter values
  const placeholderContext = usePlaceholderContext(routeParams);

  // NOTE: registry resolution is handled via getColumnRenderer() (non-hook, safe for loops)

  // Resolve placeholders in defaultFilters (from prop, includes segment defaults from Table.tsx)
  const resolvedDefaultFilters = React.useMemo(() => {
    return resolveFilterPlaceholders(defaultFilters, placeholderContext);
  }, [ defaultFilters, placeholderContext ]);

  // Initialize appliedFilters with layered merge (lowest to highest priority):
  // 1. resolvedDefaultFilters (prop defaults + segment defaults)
  // 2. URL filters (one-time read for deep linking)
  const [ appliedFilters, setAppliedFilters ] = React.useState<Record<string, any>>(() => {
    const urlFilters = getInitialFiltersFromUrl(location);

    // URL filters take precedence (deep link behavior)
    return { ...resolvedDefaultFilters, ...urlFilters };
  });
  const [ searchQuery, setSearchQuery ] = React.useState<string>('');

  // Determine initial mode FIRST (needed to get correct defaultSort)
  const [ isSearchMode, setIsSearchMode ] = React.useState<boolean>(() => {
    if (isDualApiConfig(apiConfig)) {
      return true; // Default to search mode for dual config
    }
    return apiConfig.useSearch || false;
  });

  // Then initialize sort based on the current mode
  const [ sort, setSort ] = React.useState<SorterResult<any>[]>(() => {
    // Determine initial mode to get correct defaultSort
    const initialMode = isDualApiConfig(apiConfig) ? true : (apiConfig.useSearch || false);
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
    pageSize: currentPageSize
  } = useTableData({
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
    fetchStrategy: currentFetchStrategy, // Use current strategy (can be changed by user)
    pageSize,
  });

  const onSearch = (value: string) => {
    setSearchQuery(value);
    setFetchTrigger(prev => prev + 1);
  }

  const toggleSearchMode = React.useCallback(() => {
    if (canToggleSearchMode(apiConfig)) {
      setIsSearchMode(prev => {
        const newMode = !prev;
        // Reset sort to defaultSort for the new mode
        const defaultSort = getDefaultSortFromApiConfig(apiConfig, newMode);
        setSort(convertDefaultSortToSorterResult(defaultSort));
        return newMode;
      });
      setSearchQuery('');
      // Reset to defaultFilters (preserves pre-applied filters like relation defaults)
      setAppliedFilters(resolvedDefaultFilters);
      // NOTE: Don't trigger fetch here:
      // - If segments exist, FilterSegments detects mode change and re-applies filters
      // - If no segments, Table.tsx useEffect on isSearchMode triggers fetch
      // This prevents double fetching
    }
  }, [ apiConfig, resolvedDefaultFilters ]);

  const handleTableChange = (_: any, __: any, sorter: SorterResult<any> | SorterResult<any>[]) => {
    const newSorters = Array.isArray(sorter) ? sorter : [ sorter ];
    setSort(newSorters.filter(s => s.order)); // Only keep sorts with an active order
    setFetchTrigger(prev => prev + 1);
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
    fetchRecords(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ fetchTrigger ]); // Depend on fetchTrigger, not appliedFilters (avoids circular updates)

  const handleRefresh = React.useCallback(() => {
    // Reset to defaultFilters instead of clearing everything
    // This preserves pre-applied filters (e.g., awayTeamId from relation modals)
    setAppliedFilters(resolvedDefaultFilters);
    setSearchQuery('');

    // Reset to initial mode
    const resetMode = isDualApiConfig(apiConfig) ? true : (apiConfig.useSearch || false);
    setIsSearchMode(resetMode);

    // Reset sort to defaultSort for the reset mode
    const defaultSort = getDefaultSortFromApiConfig(apiConfig, resetMode);
    setSort(convertDefaultSortToSorterResult(defaultSort));

    fetchRecords(1, "");
  }, [ fetchRecords, apiConfig, resolvedDefaultFilters ]);

  const handleReload = React.useCallback(() => {
    fetchRecords(currentPage, pageCursor[ currentPage ]);
  }, [ fetchRecords, currentPage, pageCursor ]);

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

  // Wrap filter functions to trigger fetch
  const applyFilters = React.useCallback((column: string, filterOperator: string, value: string | Array<string>) => {
    _applyFilters(column, filterOperator, value);
    setFetchTrigger(prev => prev + 1);
  }, [ _applyFilters ]);

  const clearAllFilters = React.useCallback(() => {
    _clearAllFilters();
    setFetchTrigger(prev => prev + 1);
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

  //Pagination
  const { Pagination: CursorPagination } = usePagination({
    pageCursor,
    getRecords: fetchRecords,
    currentPage,
    isLastPage,
    pageSize,
    onPageSizeChange: handlePageSizeChange
  });

  const NumericalPagination = () => (
    <AntPagination
      current={currentPage}
      total={totalRecords}
      pageSize={currentPageSize}
      onChange={(page, newPageSize) => {
        if (newPageSize !== currentPageSize) {
          handlePageSizeChange(newPageSize);
        } else {
          fetchRecords(page);
        }
      }}
      onShowSizeChange={(_, size) => handlePageSizeChange(size)}
      showSizeChanger
      showTotal={(total, range) => `${range[ 0 ]}-${range[ 1 ]} of ${total}`}
      pageSizeOptions={[ '10', '20', '50', '100' ]}
    />
  );

  const selectableColumns = React.useMemo(() => propertiesConfig.filter(p => !p.isIdentifier), [ propertiesConfig ]);

  const handleColumnSettingsChange = (newSettings) => {
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
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[Table] Template evaluation failed:`, e);
          }
          return text;  // Fallback to original value
        }
      });
    }

    return rendererCache.current.get(cacheKey)!;
  }, []);

  // Field type renderers - create once
  const colorRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    const colorValue = typeof text === 'string' ? text : '';
    if (!colorValue) return <span>—</span>;
    return (
      <>
        <svg width="12" height="12" style={{ verticalAlign: 'middle' }}>
          <rect width="12" height="12" fill={colorValue} strokeWidth={1} stroke="rgb(0,0,0)" />
        </svg>
        <span style={{ marginLeft: 8 }}> {colorValue}</span>
      </>
    );
  }, []);

  const imageRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    const imageUrl = typeof text === 'string' ? text : '';
    if (!imageUrl) return <span>—</span>;
    return (
      <img
        src={imageUrl}
        alt="Preview"
        style={{
          width: '40px',
          height: '40px',
          objectFit: 'cover',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
        onClick={() => window.open(imageUrl, '_blank')}
      />
    );
  }, []);

  const fileRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    const fileUrl = typeof text === 'string' ? text : '';
    if (!fileUrl) return <span>—</span>;
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1677ff' }}>
        Download
      </a>
    );
  }, []);

  // Complex field renderers with modal support using existing OpenInModal component
  const jsonRenderer = (
    text: unknown,
    record: Record<string, unknown>,
    columnName: string,
    fieldConfig: Pick<ITablePropertiesConfig, 'dataIndex'>
  ): React.ReactNode => {
    if (!text || (typeof text === 'object' && Object.keys(text).length === 0)) {
      return <span>—</span>;
    }

    // Use shared utility for consistent preview generation (Table uses shorter strings for compact display)
    const previewLabel = generateJsonPreview(text, { maxStringLength: 20, maxKeys: 2 });
    const detailsConfig = createModalConfig('json', text, fieldConfig, 'map');

    return (
      <OpenInModal
        modalType="details"
        modalTitle={columnName}
        modalWidth={800}
        modalPageConfig={detailsConfig}
      >
        <Button
          size="small"
          icon={<FileTextOutlined />}
          type="link"
          style={{
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: '12px'
          }}
        >
          {previewLabel}
        </Button>
      </OpenInModal>
    );
  };

  const listRenderer = (
    text: unknown,
    record: Record<string, unknown>,
    columnName: string,
    fieldConfig: Pick<ITablePropertiesConfig, 'dataIndex'>
  ): React.ReactNode => {
    if (!Array.isArray(text) || text.length === 0) return <span>—</span>;

    // Simple string/number array - show inline if short
    if (text.every(item => typeof item === 'string' || typeof item === 'number')) {
      if (text.length === 1) return <span>{String(text[ 0 ])}</span>;
      if (text.length <= 3) return <span>{text.join(', ')}</span>;
    }

    // Complex array - show in modal
    const detailsConfig = createModalConfig(undefined, text, fieldConfig, 'list');

    return (
      <OpenInModal
        modalType="details"
        modalTitle={columnName}
        modalWidth={800}
        modalPageConfig={detailsConfig}
      >
        <Button
          size="small"
          icon={<OrderedListOutlined />}
          type="link"
        >
          View ({text.length})
        </Button>
      </OpenInModal>
    );
  };

  // Shared utility: Generate preview text with ellipsis for text-heavy content
  // Supports: BlockNote blocks (wysiwyg/rich-text), plain strings (code/markdown/textarea)
  const generateContentPreview = React.useCallback((content: unknown, maxLength: number = 32): string => {
    if (!content) return '';

    try {
      // BlockNote blocks (rich-text/wysiwyg) - structured array format
      if (Array.isArray(content)) {
        const extractTextFromBlock = (block: any): string => {
          let text = '';
          if (block.content && Array.isArray(block.content)) {
            text += block.content.map((item: any) => item.text || '').join('');
          }
          if (block.children && Array.isArray(block.children)) {
            text += ' ' + block.children.map(extractTextFromBlock).filter(Boolean).join(' ');
          }
          return text;
        };

        const plainText = content.map(extractTextFromBlock).filter(Boolean).join(' ').trim();
        return plainText ? (plainText.length > maxLength ? plainText.substring(0, maxLength) + '...' : plainText) : '';
      }

      // Plain strings (code, markdown, textarea, longtext)
      if (typeof content === 'string') {
        const cleaned = content.trim();
        return cleaned ? (cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned) : '';
      }

      return '';
    } catch {
      return '';
    }
  }, []);

  const richTextRenderer = (
    text: unknown,
    record: Record<string, unknown>,
    columnName: string,
    fieldConfig: Pick<ITablePropertiesConfig, 'dataIndex'>
  ): React.ReactNode => {
    if (!text) return <span>—</span>;

    const preview = generateContentPreview(text);
    const detailsConfig = createModalConfig('rich-text', text, fieldConfig);

    return (
      <OpenInModal
        modalType="details"
        modalTitle={columnName}
        modalWidth={900}
        modalPageConfig={detailsConfig}
      >
        <Button
          size="small"
          icon={<EyeOutlined />}
          type="link"
        >
          {preview || 'View Content'}
        </Button>
      </OpenInModal>
    );
  };

  const numberRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (text === null || text === undefined) return <span>—</span>;
    const num = typeof text === 'number' ? text : parseFloat(String(text));
    return isNaN(num) ? <span>—</span> : <span>{num.toLocaleString()}</span>;
  }, []);

  const rangeRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (text === null || text === undefined) return <span>—</span>;
    return <span>{String(text)}%</span>;
  }, []);

  const ratingRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (text === null || text === undefined) return <span>—</span>;
    const rating = typeof text === 'number' ? text : parseFloat(String(text));
    if (isNaN(rating)) return <span>—</span>;
    return <Rate disabled value={rating} style={{ fontSize: 14 }} />;
  }, []);

  // NEW field type renderers
  const urlRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (!text) return <span>—</span>;
    const url = String(text);
    return <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#1677ff' }}>{url.length > 30 ? url.substring(0, 30) + '...' : url}</a>;
  }, []);

  const phoneRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (!text) return <span>—</span>;
    return <a href={`tel:${text}`} style={{ color: '#1677ff' }}>{String(text)}</a>;
  }, []);

  const currencyRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (text === null || text === undefined) return <span>—</span>;
    const num = typeof text === 'number' ? text : parseFloat(String(text));
    if (isNaN(num)) return <span>—</span>;
    return <span>${num.toFixed(2)}</span>;
  }, []);

  const percentageRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (text === null || text === undefined) return <span>—</span>;
    return <span>{Number(text)}%</span>;
  }, []);

  const sliderRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (text === null || text === undefined) return <span>—</span>;
    return <span>{String(text)}</span>;
  }, []);

  // Duration renderer - uses shared formatDuration utility with unit and format support
  const createDurationRenderer = React.useCallback((
    unit: DurationUnit = 'seconds',
    format: DurationFormat = 'auto'
  ) => {
    return (text: unknown): React.ReactNode => <span>{formatDuration(text, unit, format)}</span>;
  }, []);

  // TTL renderer - displays time remaining until expiration with auto-refresh support
  const createTTLRenderer = React.useCallback((
    unit: TTLUnit = 'seconds',
    format: TTLFormat = 'auto',
    autoRefresh?: number
  ) => {
    return (text: unknown): React.ReactNode => {
      const TTLCell = () => {
        const [ ttlValue, setTtlValue ] = React.useState(() => formatTTL(text, unit, format));
        const isExpired = ttlValue === 'expired';

        // Auto-refresh support
        React.useEffect(() => {
          if (!autoRefresh || autoRefresh <= 0 || isExpired) {
            return;
          }

          const interval = setInterval(() => {
            const newValue = formatTTL(text, unit, format);
            setTtlValue(newValue);
          }, autoRefresh * 1000);

          return () => clearInterval(interval);
        }, [ autoRefresh, isExpired ]);

        return (
          <span style={{
            color: isExpired ? '#ff4d4f' : undefined,
            fontWeight: isExpired ? 500 : undefined
          }}>
            {ttlValue}
          </span>
        );
      };

      return <TTLCell />;
    };
  }, []);

  const badgeRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (!text) return <span>—</span>;
    return <Badge status="default" text={String(text)} />;
  }, []);

  const tagRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (!text) return <span>—</span>;
    if (Array.isArray(text)) {
      return (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {text.map((tag: any, i: number) => (
            <Tag key={i}>{String(tag)}</Tag>
          ))}
        </div>
      );
    }
    return <Tag>{String(text)}</Tag>;
  }, []);

  const progressRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (text === null || text === undefined) return <span>—</span>;
    const value = typeof text === 'number' ? text : parseFloat(String(text));
    if (isNaN(value)) return <span>—</span>;
    return <Progress percent={value} size="small" style={{ width: 120 }} />;
  }, []);

  const avatarRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (!text) return <span>—</span>;
    return <Avatar src={String(text)} size="small" />;
  }, []);

  const iconRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (!text) return <span>—</span>;
    const IconComponent = (Icons as any)[ String(text) ];
    return IconComponent ? <IconComponent style={{ fontSize: 18 }} /> : <span>{String(text)}</span>;
  }, []);

  const linkRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (!text) return <span>—</span>;
    const url = String(text);
    return <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#1677ff' }}>Link</a>;
  }, []);

  const videoRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (!text) return <span>—</span>;
    return (
      <Button
        size="small"
        icon={<PlayCircleOutlined />}
        type="link"
        onClick={() => window.open(String(text), '_blank')}
      >
        Video
      </Button>
    );
  }, []);

  const audioRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (!text) return <span>—</span>;
    return (
      <Button
        size="small"
        icon={<AudioOutlined />}
        type="link"
        onClick={() => window.open(String(text), '_blank')}
      >
        Audio
      </Button>
    );
  }, []);

  const qrcodeRenderer = React.useMemo(() => (text: unknown): React.ReactNode => {
    if (!text) return <span>—</span>;
    return (
      <Button
        size="small"
        icon={<QrcodeOutlined />}
        type="link"
      >
        QR
      </Button>
    );
  }, []);

  const columns = addFilterUI(
    addActionUI(propertiesConfig, handleReload, routeParams),
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

      let renderer = column.render;

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
      // Priority 3: Field type specific renderers (built-in)
      if (!renderer && column.fieldType) {
        const fieldType = column.fieldType.toLowerCase();
        const columnName = column.name || column.title || column.dataIndex;

        // Image fields
        if (fieldType === 'image') {
          renderer = imageRenderer;
        }
        // File fields
        else if (fieldType === 'file') {
          renderer = fileRenderer;
        }
        // Color fields
        else if (fieldType === 'color') {
          renderer = colorRenderer;
        }
        // JSON/Map fields - modal-based
        else if (fieldType === 'json' || column.type === 'map') {
          renderer = (text: unknown, record: Record<string, unknown>) =>
            jsonRenderer(text, record, columnName, column);
        }
        // List/Array fields (but not multi-select which is already formatted as string) - modal-based
        else if (column.type === 'list' && fieldType !== 'multi-select') {
          renderer = (text: unknown, record: Record<string, unknown>) =>
            listRenderer(text, record, columnName, column);
        }
        // Rich text fields - modal-based
        else if (fieldType === 'rich-text' || fieldType === 'wysiwyg') {
          renderer = (text: unknown, record: Record<string, unknown>) =>
            richTextRenderer(text, record, columnName, column);
        }
        // Textarea, code, markdown - show preview with modal for full content
        else if (fieldType === 'textarea' || fieldType === 'code' || fieldType === 'markdown' || fieldType === 'longtext') {
          renderer = (text: unknown, record: Record<string, unknown>): React.ReactNode => {
            if (!text) return <span>—</span>;

            const preview = generateContentPreview(text);
            if (!preview) return <span>—</span>;

            // If content is short, show inline
            if (typeof text === 'string' && text.length < 50) {
              return <span>{text}</span>;
            }

            // Show preview button with modal for longer content
            const detailsConfig = createModalConfig(column.fieldType, text, column);

            return (
              <OpenInModal
                modalType="details"
                modalTitle={columnName}
                modalWidth={800}
                modalPageConfig={detailsConfig}
              >
                <Button
                  size="small"
                  icon={<FileTextOutlined />}
                  type="link"
                >
                  {preview}
                </Button>
              </OpenInModal>
            );
          };
        }
        // Number fields
        else if (fieldType === 'number') {
          renderer = numberRenderer;
        }
        // Range fields
        else if (fieldType === 'range') {
          renderer = rangeRenderer;
        }
        // Rating fields
        else if (fieldType === 'rating') {
          renderer = ratingRenderer;
        }
        // URL fields
        else if (fieldType === 'url') {
          renderer = urlRenderer;
        }
        // Phone fields
        else if (fieldType === 'phone') {
          renderer = phoneRenderer;
        }
        // Currency fields
        else if (fieldType === 'currency') {
          renderer = currencyRenderer;
        }
        // Percentage fields
        else if (fieldType === 'percentage') {
          renderer = percentageRenderer;
        }
        // Slider fields
        else if (fieldType === 'slider') {
          renderer = sliderRenderer;
        }
        // Duration fields - use durationUnit and format from column config
        else if (fieldType === 'duration') {
          renderer = createDurationRenderer(
            column.durationUnit || 'seconds',
            column.durationFormat || 'auto'
          );
        }
        // TTL fields - displays time remaining until expiration with auto-refresh
        else if (fieldType === 'ttl') {
          renderer = createTTLRenderer(
            column.ttlUnit || 'seconds',
            column.ttlFormat || 'auto',
            column.ttlAutoRefresh
          );
        }
        // Badge fields
        else if (fieldType === 'badge') {
          renderer = badgeRenderer;
        }
        // Tag fields
        else if (fieldType === 'tag' || fieldType === 'tags') {
          renderer = tagRenderer;
        }
        // Progress fields
        else if (fieldType === 'progress') {
          renderer = progressRenderer;
        }
        // Avatar fields
        else if (fieldType === 'avatar') {
          renderer = avatarRenderer;
        }
        // Icon fields
        else if (fieldType === 'icon') {
          renderer = iconRenderer;
        }
        // Link fields
        else if (fieldType === 'link') {
          renderer = linkRenderer;
        }
        // Video fields
        else if (fieldType === 'video') {
          renderer = videoRenderer;
        }
        // Audio fields
        else if (fieldType === 'audio') {
          renderer = audioRenderer;
        }
        // QR Code fields
        else if (fieldType === 'qrcode') {
          renderer = qrcodeRenderer;
        }
      }

      const columnSetting = columnSettings.find(s => s.key === column.dataIndex);
      return {
        ...column,
        title: columnSetting?.title || column.dataIndex,
        render: renderer,
        fixed: columnSetting?.fixed,
        sorter: (isSearchMode && (column.isSortable === true || column.isSortable === undefined)) ? { multiple: index + 1 } : undefined,
        sortOrder: sort.find(s => s.field === column.dataIndex)?.order,
        filterIcon: <FilterFilled style={{ color: !!appliedFilters[ column.dataIndex ] ? "#1677ff" : undefined }} />,
      };
    })
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

    const grouped: any[] = [];
    const groupedFieldSet = new Set<string>();
    const groupMap = new Map<string, any[]>();

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
        title: groupTitle,
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
    Pagination: isSearchMode ? <NumericalPagination /> : CursorPagination,
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
  };
};
