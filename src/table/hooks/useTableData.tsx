import React from 'react';
import { useApi } from '../../core/context';
import { useAppContext } from '../../core/context/AppContext';
import { SorterResult } from 'antd/es/table/interface';
import { ITablePropertiesConfig, ITableApiConfig } from '../type';
import { getNestedValue } from '../../core/utils';
import { handleApiError } from '../../core/utils/api-error-handler';
import { PASS_THROUGH_URL_PARAMS } from '../constants';
import { resolveFilterPlaceholders } from '../../core/utils/placeholderResolver';
import { usePlaceholderContext } from './usePlaceholderContext';
import { useFormat } from '../../core';
import { queryClient } from '../../core/query/QueryProvider';
import { queryKeys } from '../../core/query/queryKeys';

const replaceUrlParams = (url: string, params: Record<string, string> = {}) => {
  return url.replace(/:(\w+)/g, (_, param) => params[ param ] || `:${param}`);
};

const getFilterPayload = (filters: Record<string, any>, apiMethod: string = "GET") => {
  if (apiMethod === "GET") {
    let transformedFilters: Record<string, any> = {};

    for (let key in filters) {
      const value = filters[ key ];

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        for (let operator in value) {
          if (operator === 'eq') {
            if (Array.isArray(value[ operator ])) {
              transformedFilters[ key ] = value[ operator ].join(",");
            } else {
              transformedFilters[ key ] = value[ operator ];
            }
          } else {
            if (Array.isArray(value[ operator ])) {
              transformedFilters[ `${key}.${operator}` ] = value[ operator ].join(",");
            } else {
              transformedFilters[ `${key}.${operator}` ] = value[ operator ];
            }
          }
        }
      } else {
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
  apiConfig: ITableApiConfig;
  routeParams?: Record<string, string>;
  appliedFilters: Record<string, any>;
  searchQuery: string;
  sort: SorterResult<any>[];
  visibleColumns: string[];
  facetedColumns: string[];
  propertiesConfig: ITablePropertiesConfig[];
  recordIdentifierKey: string;
  isSearchMode: boolean;
  fetchStrategy?: 'eager' | 'lazy';
  pageSize: number;
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
  fetchStrategy = 'eager',
  pageSize,
}: IUseTableDataProps) => {
  const [ listRecords, setListRecords ] = React.useState([]);
  const [ isLoading, setIsLoading ] = React.useState(false);
  const [ isInitialLoad, setIsInitialLoad ] = React.useState(true);
  const [ currentPage, setCurrentPage ] = React.useState(1);
  const [ pageCursor, setPageCursor ] = React.useState<Record<number, string>>({ 1: "" });
  const [ isLastPage, setIsLastPage ] = React.useState(false);
  const [ totalRecords, setTotalRecords ] = React.useState(0);
  const [ facetResults, setFacetResults ] = React.useState<Record<string, Record<string, number>>>({});

  const { callApiMethod } = useApi();
  const { notifyError } = useAppContext();
  const { formatDate, formatBoolean } = useFormat();

  const placeholderContext = usePlaceholderContext(routeParams);

  // Reset pagination when filters, sort, or pageSize change
  React.useEffect(() => {
    setPageCursor({ 1: "" });
    setCurrentPage(1);
  }, [ appliedFilters, sort, pageSize ]);

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

  // Derive entity name from apiUrl for React Query cache keying
  const entityName = React.useMemo(() => {
    const url = apiConfig.apiUrl || '';
    const parts = url.split('/').filter(Boolean);
    const lastPart = parts[ parts.length - 1 ] || 'unknown';
    return lastPart.startsWith(':') ? (parts[ parts.length - 2 ] || 'unknown') : lastPart;
  }, [ apiConfig.apiUrl ]);

  // Keep callApiMethod in a ref so the fetchQuery callback always has the latest reference
  const callApiMethodRef = React.useRef(callApiMethod);
  callApiMethodRef.current = callApiMethod;

  const fetchRecords = React.useCallback(async (pageNumber: number = 1, forceCursor?: string, filtersOverride?: Record<string, any>, options?: { forceRefresh?: boolean }) => {
    const apiUrl = replaceUrlParams(apiConfig.apiUrl, routeParams);
    const isSearchActive = isSearchMode;
    const sortString = getSortString();
    const currentPageCursor = forceCursor !== undefined ? forceCursor : pageCursor[ pageNumber ] || "";

    const effectiveFilters = filtersOverride !== undefined ? filtersOverride : appliedFilters;
    const resolvedFilters = resolveFilterPlaceholders(effectiveFilters, placeholderContext);
    const filterPayload = getFilterPayload(resolvedFilters, apiConfig.apiMethod);

    const payload: Record<string, any> = {
      ...filterPayload,
    };

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.forEach((value, key) => {
        if (PASS_THROUGH_URL_PARAMS.includes(key as any)) {
          payload[ key ] = value;
        }
      });
    }

    if (fetchStrategy === 'lazy') {
      const identifierColumnKeys = identifierColumns.map(c => c.dataIndex);
      const attributes = Array.from(new Set([ ...visibleColumns, ...identifierColumnKeys ]));
      if (attributes.length > 0) {
        payload.attributes = attributes.join(',');
      }
    }

    if (isSearchActive) {
      payload.q = searchQuery;
      payload.page = pageNumber;
      payload.hitsPerPage = pageSize;
      if (sortString) {
        payload.sort = sortString;
      }
      if (facetedColumns.length > 0) {
        payload.facets = facetedColumns.join(',');
      }
    } else {
      payload.cursor = currentPageCursor;
      payload.count = pageSize;
      if (sort.length > 0 && sort[ 0 ].order) {
        payload.order = sort[ 0 ].order === 'ascend' ? 'asc' : 'desc';
      } else if (typeof apiConfig.defaultSort === 'string') {
        payload.order = apiConfig.defaultSort;
      }
    }

    setIsLoading(true);

    try {
      // Use queryClient.fetchQuery for imperative fetching with React Query caching.
      // This gives us deduplication and short-term caching while keeping the
      // imperative fetchRecords(page, cursor) interface the table expects.
      const cacheKey = queryKeys.entity(entityName).list({
        apiUrl,
        filters: payload,
        sort: payload.sort || payload.order,
        page: payload.page,
        cursor: payload.cursor,
        pageSize: payload.count || payload.hitsPerPage,
        search: payload.q,
        attributes: payload.attributes,
      });

      // When the user explicitly triggers a refresh (Refresh Data, Reset, auto-refresh timer),
      // invalidate the cache so fetchQuery always hits the server.
      if (options?.forceRefresh) {
        await queryClient.invalidateQueries({ queryKey: cacheKey });
      }

      const responseData = await queryClient.fetchQuery({
        queryKey: cacheKey,
        queryFn: async () => {
          const response: any = await callApiMethodRef.current({
            ...apiConfig,
            apiUrl,
            payload,
          });

          if (response?.status === 200) {
            return response.data;
          }

          throw response;
        },
        staleTime: 15 * 1000, // 15s — short for list data that changes often
      });

      const rawRecords = isSearchActive ? responseData.items
        : apiConfig.responseKey ? responseData[ apiConfig.responseKey ] : responseData;

      if (isSearchActive && responseData.facets) {
        setFacetResults(responseData.facets);
      }

      // Shallow-clone each record to avoid mutating React Query cached objects.
      // fetchQuery returns cached references within staleTime — mutating them in-place
      // causes already-formatted values (e.g. dates) to be re-formatted on the next
      // cache hit, producing garbled results.
      const records = (rawRecords || []).map((r: any) => ({ ...r }));

      records.forEach((record: any) => {
        record.__raw__ = { ...record };

        formattingColumns.forEach((property) => {
          const nestedValue = getNestedValue(record, property.dataIndex);

          if (nestedValue === null || nestedValue === undefined || nestedValue === '') {
            record[ property.dataIndex ] = '';
            return;
          }

          record[ property.dataIndex ] = nestedValue;

          if ([ 'date', 'datetime', 'time' ].includes(property.fieldType?.toLocaleLowerCase())) {
            const itemValue = nestedValue.toString().startsWith('0') ?
              new Date(parseInt(nestedValue)).toISOString() :
              nestedValue;
            record[ property.dataIndex ] = formatDate(itemValue, property.fieldType?.toLocaleLowerCase() as any);
          } else if ([ 'boolean', 'switch', 'toggle' ].includes(property.fieldType?.toLocaleLowerCase())) {
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
        setTotalRecords(responseData.total);
      } else {
        if (responseData?.cursor) {
          setPageCursor(prev => ({ ...prev, [ pageNumber + 1 ]: responseData.cursor }));
        }
        setIsLastPage(responseData?.cursor === null);
      }
    } catch (error) {
      const errorResult = handleApiError(error, 'Failed to fetch records');
      notifyError(errorResult.errorMessage);
      console.error('Error fetching records:', error);
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  }, [ apiConfig, routeParams, appliedFilters, searchQuery, sort, visibleColumns, facetedColumns, identifierColumns, formattingColumns, pageCursor, notifyError, formatDate, formatBoolean, recordIdentifierKey, isSearchMode, pageSize, entityName ]);

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
    pageSize
  };
};
