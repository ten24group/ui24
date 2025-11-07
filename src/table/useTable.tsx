import React, { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { ITablePropertiesConfig, ITableApiConfig, IDualTableApiConfig, SortConfig } from "./type";
import { IApiConfig } from "../core/context";
import { Pagination as AntPagination } from "antd";
import type { SorterResult } from 'antd/es/table/interface';

import { addActionUI } from "./Actions/addActionUI";
import { addFilterUI } from "./Filters/addFilterUI";
import { usePagination } from "./Pagination/usePagination";
import { useAppliedFilters } from "./AppliedFilters/useAppliedFilters";
import { useAppliedSorts } from "./AppliedFilters/useAppliedSorts";
import { FilterFilled } from "@ant-design/icons";
import { useTableData } from "./hooks/useTableData";
import { evaluateTemplate } from "../core/utils/template";

interface IuseTable {
  propertiesConfig: Array<ITablePropertiesConfig>;
  apiConfig: ITableApiConfig | IDualTableApiConfig;
  routeParams?: Record<string, string>;
  defaultFilters?: Record<string, any>; // Pre-applied filters (supports placeholders like ":teamId")
}

// Utility functions to handle both single and dual API configurations
const isDualApiConfig = (config: ITableApiConfig | IDualTableApiConfig): config is IDualTableApiConfig => {
  return 'search' in config && 'database' in config;
};

const getCurrentApiConfig = (apiConfig: ITableApiConfig | IDualTableApiConfig, isSearchMode: boolean): IApiConfig => {
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
  return [{
    field: defaultSort.field,
    order: defaultSort.order === 'asc' ? 'ascend' : 'descend'
  } as SorterResult<any>];
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
 * Parse filters from URL query params or sessionStorage
 * Supports both direct query params and large param storage (f=key)
 * 
 * CRITICAL: Internal structure MUST use operators for UI compatibility!
 * - Plain values: sport=basketball → {sport: {eq: "basketball"}} (UI needs this!)
 * - Already has operator: sport.neq=football → {sport: {neq: "football"}}
 * - System params (debug, trace, etc.) are IGNORED here, added separately to API
 */
const getInitialFiltersFromUrl = (location: ReturnType<typeof useLocation>): Record<string, any> => {
  const queryParams = new URLSearchParams(location.search);
  
  // System/infrastructure params that should NOT be in filters
  // These either control pagination/search OR are pass-through params for backend
  const NON_FILTER_PARAMS = [
    'f', 'page', 'cursor', 'count', 'q', 'sort', 'attributes',  // Infrastructure
    'debug', 'trace', 'mock', 'test', 'dev', 'verbose', 'dryRun'  // Backend pass-through
  ];
  
  // Filter operators supported by backend
  const OPERATORS = ['eq', 'ne', 'neq', 'in', 'nin', 'gte', 'gt', 'lte', 'lt', 'contains', 'notContains', 'beginsWith'];
  
  // Helper to parse key with operator (e.g., "sport.neq" → {field: "sport", operator: "neq"})
  const parseKeyOperator = (key: string): { field: string; operator?: string } => {
    const parts = key.split('.');
    if (parts.length === 2 && OPERATORS.includes(parts[1])) {
      return { field: parts[0], operator: parts[1] };
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
        
        Object.entries(parsed).forEach(([key, value]) => {
          // Skip non-filter params (infrastructure)
          if (NON_FILTER_PARAMS.includes(key)) {
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
            if (!filters[field]) {
              filters[field] = {};
            }
            filters[field][operator] = deserializedValue;
          } else {
            // Plain key - WRAP in {eq: value} for UI!
            filters[field] = { eq: deserializedValue };
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
    if (NON_FILTER_PARAMS.includes(key)) {
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
      if (!filters[field]) {
        filters[field] = {};
      }
      filters[field][operator] = deserializedValue;
    } else {
      // Plain key: sport=basketball → {sport: {eq: "basketball"}} (UI needs this!)
      filters[field] = { eq: deserializedValue };
    }
  });
  
  return filters;
};

export const useTable = ({ propertiesConfig, apiConfig, routeParams = {}, defaultFilters = {} }: IuseTable) => {
  const recordIdentifierKey = '__recordIdentifierKey__';
  const location = useLocation();

  // Memoize resolved defaultFilters to reference them when resetting
  const resolvedDefaultFilters = React.useMemo(() => {
    const resolved: Record<string, any> = {};
    Object.entries(defaultFilters).forEach(([key, value]) => {
      if (typeof value === 'string' && value.startsWith(':')) {
        // Placeholder: extract param name and resolve
        const paramName = value.slice(1); // Remove leading ':'
        const resolvedValue = routeParams[paramName];
        
        if (resolvedValue != null) {
          // Wrap in operator structure for UI compatibility
          resolved[key] = { eq: resolvedValue };
        } else {
          console.warn(`[useTable] Could not resolve placeholder "${value}" for filter "${key}"`);
        }
      } else {
        // Non-placeholder value: use as-is (already in operator structure)
        resolved[key] = value;
      }
    });
    return resolved;
  }, [defaultFilters, routeParams]);

  // Initialize filters from URL query params + defaultFilters (for modal navigation pattern)
  const [ appliedFilters, setAppliedFilters ] = React.useState<Record<string, any>>(() => {
    const urlFilters = getInitialFiltersFromUrl(location);
    
    // Merge: URL filters take precedence over defaultFilters
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
    propertiesConfig.filter(p => !p.hidden).map(p => p.dataIndex)
  );
  const [ columnSettings, setColumnSettings ] = React.useState(
    propertiesConfig.map(p => ({
      key: p.dataIndex,
      title: p.name,
      visible: !p.hidden,
      fixed: p.actions ? 'right' : undefined,
      isIdentifier: p.isIdentifier,
    }))
  );
  const [ facetedColumns, setFacetedColumns ] = React.useState<string[]>([]);
  const [ fetchTrigger, setFetchTrigger ] = React.useState(0);

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
    recordPerPage
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
  });

  const onSearch = (value: string) => {
    setSearchQuery(value);
    setFetchTrigger(prev => prev + 1);
  }

  const toggleSearchMode = React.useCallback(() => {
    if (canToggleSearchMode(apiConfig)) {
      setIsSearchMode(prev => {
        const newMode = !prev;
        // Reset sort to defaultSort
        const defaultSort = getDefaultSortFromApiConfig(apiConfig, newMode);
        setSort(convertDefaultSortToSorterResult(defaultSort));
        return newMode;
      });
      setSearchQuery('');
      // Reset to defaultFilters instead of clearing everything
      // This preserves pre-applied filters (e.g., awayTeamId from relation modals)
      setAppliedFilters(resolvedDefaultFilters);
      setFetchTrigger(prev => prev + 1);
    }
  }, [apiConfig, resolvedDefaultFilters]);

  const handleTableChange = (_: any, __: any, sorter: SorterResult<any> | SorterResult<any>[]) => {
    const newSorters = Array.isArray(sorter) ? sorter : [ sorter ];
    setSort(newSorters.filter(s => s.order)); // Only keep sorts with an active order
    setFetchTrigger(prev => prev + 1);
  };

  // Reset columns and state when entity changes (navigation between list pages)
  // Use useLayoutEffect to ensure this runs BEFORE the fetch effect
  useLayoutEffect(() => {
    setVisibleColumns(propertiesConfig.filter(p => !p.hidden).map(p => p.dataIndex));
    setColumnSettings(propertiesConfig.map(p => ({
      key: p.dataIndex,
      title: p.name,
      visible: !p.hidden,
      fixed: p.actions ? 'right' : undefined,
      isIdentifier: p.isIdentifier,
    })));
    setFacetedColumns([]);
    
    // Reset filters and search when navigating to a different entity
    // (but preserve URL-based filters through location query params)
    const urlFilters = getInitialFiltersFromUrl(location);
    // Use the memoized resolvedDefaultFilters
    setAppliedFilters({ ...resolvedDefaultFilters, ...urlFilters });
    setSearchQuery('');
    
    // Reset sort to default for the current mode
    const defaultSort = getDefaultSortFromApiConfig(apiConfig, isSearchMode);
    setSort(convertDefaultSortToSorterResult(defaultSort));
    
    // Trigger fetch with new state
    setFetchTrigger(prev => prev + 1);
  }, [getCurrentApiConfig(apiConfig, isSearchMode).apiUrl, propertiesConfig.map(p => p.dataIndex).join(',')]);

  // Fetch data when trigger changes
  useEffect(() => {
    fetchRecords(1);
  }, [fetchTrigger]);

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
    getColumnNameByKey
  });

  // Wrap filter functions to trigger fetch
  const applyFilters = React.useCallback((column: string, filterOperator: string, value: string | Array<string>) => {
    _applyFilters(column, filterOperator, value);
    setFetchTrigger(prev => prev + 1);
  }, [_applyFilters]);

  const clearAllFilters = React.useCallback(() => {
    _clearAllFilters();
    setFetchTrigger(prev => prev + 1);
  }, [_clearAllFilters]);

  const getAppliedFilterForColumn = (column: string) => {
    return appliedFilters[ column ] || {};
  }

  const toggleFacetedColumn = (dataIndex: string) => {
    setFacetedColumns(prev =>
      prev.includes(dataIndex)
        ? prev.filter(d => d !== dataIndex)
        : [ ...prev, dataIndex ]
    );
    setFetchTrigger(prev => prev + 1);
  };

  //Sorts
  const { DisplayAppliedSorts, clearAllSorts: _clearAllSorts, hasActiveSorts, activeSortsCount } = useAppliedSorts({
    sort,
    setSort,
    getColumnNameByKey
  });

  const clearAllSorts = React.useCallback(() => {
    _clearAllSorts();
    setFetchTrigger(prev => prev + 1);
  }, [_clearAllSorts]);

  //Pagination
  const { Pagination: CursorPagination } = usePagination({
    pageCursor,
    getRecords: fetchRecords,
    currentPage,
    isLastPage
  });

  const NumericalPagination = () => (
    <AntPagination
      current={currentPage}
      total={totalRecords}
      pageSize={recordPerPage}
      onChange={(page) => fetchRecords(page)}
      showSizeChanger={false}
    />
  );

  const selectableColumns = React.useMemo(() => propertiesConfig.filter(p => !p.isIdentifier), [ propertiesConfig ]);

  const handleColumnSettingsChange = (newSettings) => {
    setColumnSettings(newSettings);
    setVisibleColumns(newSettings.filter(c => c.visible).map(c => c.key));
  };

  const resetColumnSettings = () => {
    const defaultSettings = propertiesConfig.map(p => ({
      key: p.dataIndex,
      title: p.name,
      visible: !p.hidden,
      fixed: p.actions ? 'right' : undefined,
      isIdentifier: p.isIdentifier,
    }));
    handleColumnSettingsChange(defaultSettings);
  };

  const columns = addFilterUI(
    addActionUI(propertiesConfig, handleReload, routeParams),
    applyFilters,
    (col) => setAppliedFilters(f => {
      const newF = { ...f };
      delete newF[ col ]; return newF;
    }),
    getAppliedFilterForColumn,
    facetResults,
    facetedColumns,
    toggleFacetedColumn,
    !!isSearchMode
  )
    .map((column, index) => {
      if (column.key === 'action') return column;

      let renderer = column.render;
      
      // Template rendering (highest priority)
      if (column.template) {
        renderer = (text: any, record: any) => {
          try {
            const templateValue = column.template;
            if (typeof templateValue === 'string') {
              // Simple string template
              return evaluateTemplate(templateValue, record);
            } else {
              // Complex template object
              return evaluateTemplate(templateValue, record);
            }
          } catch (e) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`[Table] Template evaluation failed for column ${column.dataIndex}:`, e);
            }
            return text;  // Fallback to original value
          }
        };
      }
      // Color field type handling
      else if (column.fieldType === 'color') {
        renderer = (text: string) => (
          <>
            <svg width="12" height="12" style={{ verticalAlign: 'middle' }}>
              <rect width="12" height="12" fill={text} strokeWidth={1} stroke="rgb(0,0,0)" />
            </svg>
            <span style={{ marginLeft: 8 }}> {text}</span>
          </>
        );
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
      }
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

  return {
    recordIdentifierKey,
    columns,
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
    isSearchMode,
    toggleSearchMode,
    canToggleSearchMode: canToggleSearchMode(apiConfig),
    appliedFilters,
  };
};
