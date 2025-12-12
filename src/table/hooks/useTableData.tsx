import React from 'react';
import { useApi, IApiConfig } from '../../core/context';
import { useAppContext } from '../../core/context/AppContext';
import { SorterResult } from 'antd/es/table/interface';
import { ITablePropertiesConfig, ITableApiConfig } from '../type';
import { getNestedValue } from '../../core/utils';
import { handleApiError } from '../../core/utils/api-error-handler';
import { NON_FILTER_URL_PARAMS } from '../constants';
import { resolveFilterPlaceholders } from '../../core/utils/placeholderResolver';
import { usePlaceholderContext } from './usePlaceholderContext';
import { useFormat } from '../../core';

const recordPerPage = 10;

// Utility to replace URL parameters with values
const replaceUrlParams = (url: string, params: Record<string, string> = {}) => {
  return url.replace(/:(\w+)/g, (_, param) => params[ param ] || `:${param}`);
};

const getFilterPayload = (filters: Record<string, any>, apiMethod: string = "GET") => {
  if (apiMethod === "GET") {
    let transformedFilters: Record<string, any> = {};

    for (let key in filters) {
      const value = filters[ key ];

      // Check if value is an object with operators
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Nested structure with operators
        for (let operator in value) {
          if (operator === 'eq') {
            // Special case: .eq operator outputs as plain param (no .eq suffix)
            // {sport: {eq: "basketball"}} → sport=basketball
            if (Array.isArray(value[ operator ])) {
              transformedFilters[ key ] = value[ operator ].join(",");
            } else {
              transformedFilters[ key ] = value[ operator ];
            }
          } else {
            // Other operators: keep the operator suffix
            // {sport: {neq: "football"}} → sport.neq=football
            if (Array.isArray(value[ operator ])) {
              transformedFilters[ `${key}.${operator}` ] = value[ operator ].join(",");
            } else {
              transformedFilters[ `${key}.${operator}` ] = value[ operator ];
            }
          }
        }
      } else {
        // Plain value (shouldn't happen now, but handle it)
        if (Array.isArray(value)) {
          transformedFilters[ key ] = value.join(",");
        } else {
          transformedFilters[ key ] = value;
        }
      }
    }
    return transformedFilters;
  }
  return { filters };
};

interface IUseTableDataProps {
  apiConfig: ITableApiConfig;  // Extended config with defaultSort support
  routeParams?: Record<string, string>;
  appliedFilters: Record<string, any>;
  searchQuery: string;
  sort: SorterResult<any>[];
  visibleColumns: string[];
  facetedColumns: string[];
  propertiesConfig: ITablePropertiesConfig[];
  recordIdentifierKey: string;
  isSearchMode: boolean;
  fetchStrategy?: 'eager' | 'lazy'; // Controls whether to fetch all columns (eager) or only visible columns (lazy)
}

export const useTableData = ({
  apiConfig,
  routeParams = {},
  appliedFilters,
  searchQuery,
  sort,
  visibleColumns,
  facetedColumns,
  propertiesConfig,
  recordIdentifierKey,
  isSearchMode,
  fetchStrategy = 'eager', // Default to eager fetching
}: IUseTableDataProps) => {
  const [ listRecords, setListRecords ] = React.useState([]);
  const [ isLoading, setIsLoading ] = React.useState(false);
  const [ isInitialLoad, setIsInitialLoad ] = React.useState(true);  // Track initial load for skeleton
  const [ currentPage, setCurrentPage ] = React.useState(1);
  const [ pageCursor, setPageCursor ] = React.useState<Record<number, string>>({ 1: "" });
  const [ isLastPage, setIsLastPage ] = React.useState(false);
  const [ totalRecords, setTotalRecords ] = React.useState(0);
  const [ facetResults, setFacetResults ] = React.useState<Record<string, Record<string, number>>>({});

  const { callApiMethod } = useApi();
  const { notifyError } = useAppContext();
  const { formatDate, formatBoolean } = useFormat();

  // Build placeholder context for resolving filter placeholders
  const placeholderContext = usePlaceholderContext(routeParams);

  // Reset pagination when filters or sort change
  // This prevents stale pagination cursors from being used with new filter sets
  // Without this, changing filters and then paginating would send old filter values to the API
  // Note: The fetch is triggered by useTable.tsx via fetchTrigger when appliedFilters/sort change
  React.useEffect(() => {
    setPageCursor({ 1: "" });
    setCurrentPage(1);
  }, [ appliedFilters, sort ]);

  const identifierColumns = React.useMemo(() => propertiesConfig.filter(property => property.isIdentifier), [ propertiesConfig ]);
  const formattingColumns = React.useMemo(() => propertiesConfig.filter(property =>
    [ 'date', 'datetime', 'time', 'boolean', 'switch', 'toggle', 'json' ]
      .includes(property.fieldType?.toLocaleLowerCase())
  ), [ propertiesConfig ]);

  const getSortString = () => {
    if (!sort.length) return '';
    return sort
      .map(s => s.field && s.order ? `${s.field as string}:${s.order === 'ascend' ? 'asc' : 'desc'}` : null)
      .filter(Boolean)
      .join(',');
  };

  const fetchRecords = React.useCallback(async (pageNumber: number = 1, forceCursor?: string, filtersOverride?: Record<string, any>) => {
    const apiUrl = replaceUrlParams(apiConfig.apiUrl, routeParams);
    const isSearchActive = isSearchMode;
    const sortString = getSortString();
    const currentPageCursor = forceCursor !== undefined ? forceCursor : pageCursor[ pageNumber ] || "";

    // Use filtersOverride if provided, otherwise use appliedFilters from state
    // filtersOverride is critical for segment changes: allows immediate fetch with new filters
    // without waiting for React's setState to complete (avoids stale closure issues)
    const effectiveFilters = filtersOverride !== undefined ? filtersOverride : appliedFilters;

    // Resolve all placeholders in filters before sending to API
    const resolvedFilters = resolveFilterPlaceholders(effectiveFilters, placeholderContext);

    const filterPayload = getFilterPayload(resolvedFilters, apiConfig.apiMethod);

    const payload = {
      ...filterPayload,
    };

    // Add non-filter pass-through params from URL (debug, trace, mock, etc.)
    // These are system params that bypass filter structure and go directly to API
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.forEach((value, key) => {
        // Skip infrastructure params (cursor, page, count, etc.)
        if (NON_FILTER_URL_PARAMS.includes(key as any)) {
          return;
        }

        // Skip filter params (already in appliedFilters and processed above)
        if (appliedFilters[ key ] || key.includes('.')) {
          return;
        }

        // This is a pass-through param (debug, trace, mock) - pass to API as-is
        payload[ key ] = value;
      });
    }

    // Column fetching strategy (controlled by user in Column Settings)
    // lazy: Only fetch visible columns (refetch when columns shown/hidden)
    // eager: Fetch all isListable columns upfront (default, better for frequent column toggling)
    if (fetchStrategy === 'lazy') {
      const identifierColumnKeys = identifierColumns.map(c => c.dataIndex);
      const attributes = Array.from(new Set([ ...visibleColumns, ...identifierColumnKeys ]));
      if (attributes.length > 0) {
        payload.attributes = attributes.join(',');
      }
    }
    // For eager fetching (default), omit attributes param to fetch all isListable columns

    if (isSearchActive) {
      payload.q = searchQuery;
      payload.page = pageNumber;
      payload.hitsPerPage = recordPerPage;
      if (sortString) {
        payload.sort = sortString;
      }
      if (facetedColumns.length > 0) {
        payload.facets = facetedColumns.join(',');
      }
    } else {
      payload.cursor = currentPageCursor;
      payload.count = recordPerPage;
      // Database mode: send order direction (DynamoDB sorts by index SK)
      // Priority: 1. User-selected sort, 2. apiConfig.defaultSort (string), 3. default 'asc'
      if (sort.length > 0 && sort[ 0 ].order) {
        payload.order = sort[ 0 ].order === 'ascend' ? 'asc' : 'desc';
      } else if (typeof apiConfig.defaultSort === 'string') {
        // Database mode defaultSort is just 'asc' | 'desc'
        payload.order = apiConfig.defaultSort;
      }
    }

    setIsLoading(true);

    try {
      const response: any = await callApiMethod({
        ...apiConfig,
        apiUrl,
        payload,
      });

      if (response?.status === 200) {
        const records = isSearchActive ? response.data.items
          : apiConfig.responseKey ? response.data[ apiConfig.responseKey ] : response.data;

        if (isSearchActive && response.data.facets) {
          setFacetResults(response.data.facets);
        }

        records.forEach((record: any) => {
          // Store raw record BEFORE any display formatting mutations
          // This preserves original API data types for evaluation (e.g., boolean false vs "No")
          // Only store if not already present (prevents overwriting with formatted data on re-renders)
          if (!record.__raw__) {
            record.__raw__ = { ...record };
          }

          formattingColumns.forEach((property) => {
            // Use getNestedValue to handle nested data paths
            const nestedValue = getNestedValue(record, property.dataIndex);

            if (nestedValue === null || nestedValue === undefined || nestedValue === '') {
              record[ property.dataIndex ] = '';
              return;
            }

            // Store the nested value in the record for the table to access
            record[ property.dataIndex ] = nestedValue;

            if ([ 'date', 'datetime', 'time' ].includes(property.fieldType?.toLocaleLowerCase())) {
              const itemValue = nestedValue.toString().startsWith('0') ?
                new Date(parseInt(nestedValue)).toISOString() :
                nestedValue;
              record[ property.dataIndex ] = formatDate(itemValue, property.fieldType?.toLocaleLowerCase() as any);
            } else if ([ 'boolean', 'switch', 'toggle' ].includes(property.fieldType?.toLocaleLowerCase())) {
              // Only format if the value is actually a boolean (not already formatted)
              // This prevents double-formatting when fetchRecords is called multiple times
              if (typeof nestedValue === 'boolean') {
                record[ property.dataIndex ] = formatBoolean(nestedValue);
              }
            } else if (property.fieldType?.toLocaleLowerCase() === 'json') {
              const itemValue = nestedValue;
              record[ property.dataIndex ] = typeof itemValue !== 'string' ? JSON.stringify(itemValue, null, 2) : itemValue;
            }
          });

          const identifiers = identifierColumns.map(column => ({
            [ column.dataIndex ]: getNestedValue(record, column.dataIndex)
          }));

          record[ recordIdentifierKey ] = JSON.stringify(identifiers);
        });

        setListRecords(records);
        setCurrentPage(pageNumber);

        if (isSearchActive) {
          setTotalRecords(response.data.total);
        } else {
          if (response.data?.cursor) {
            setPageCursor(prev => ({ ...prev, [ pageNumber + 1 ]: response.data.cursor }));
          }
          setIsLastPage(response.data?.cursor === null);
        }
      } else {
        notifyError(response?.error);
      }
    } catch (error) {
      // Use handleApiError to extract proper error message from API response
      const errorResult = handleApiError(error, 'Failed to fetch records');
      notifyError(errorResult.errorMessage);

      console.error('Error fetching records:', error);
      // Log additional error details for debugging
      if (error && typeof error === 'object') {
        console.error('Error details:', {
          message: error.message || 'Unknown error',
          response: error.response ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
          } : 'No response',
          request: error.request ? 'Request made but no response received' : 'No request made'
        });
      }
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);  // Mark initial load complete
    }
  }, [ apiConfig, routeParams, appliedFilters, searchQuery, sort, visibleColumns, facetedColumns, identifierColumns, formattingColumns, pageCursor, callApiMethod, notifyError, formatDate, formatBoolean, recordIdentifierKey, isSearchMode ]);

  return {
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
  };
}; 