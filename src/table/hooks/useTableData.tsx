import React from 'react';
import { useAppContext } from '../../core/context/AppContext';
import { SorterResult } from 'antd/es/table/interface';
import { ITablePropertiesConfig, ITableApiConfig } from '../type';
import { getNestedValue, deriveEntityName, substituteUrlParams } from '../../core/utils';
import { handleApiError } from '../../core/utils/api-error-handler';
import { PASS_THROUGH_URL_PARAMS } from '../constants';
import { resolveFilterPlaceholders } from '../../core/utils/placeholderResolver';
import { usePlaceholderContext } from './usePlaceholderContext';
import { useFormat } from '../../core';
import { useEntityList } from '../../core/query/useEntityList';
import { getTracer, SpanStatusCode, type Span } from '../../core/telemetry';


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
  /** Starting page number (optional, defaults to 1) */
  initialPage?: number;
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
  initialPage,
}: IUseTableDataProps) => {
  // ── Pagination state (accumulated across pages, not derivable from a single response) ──
  const [ currentPage, setCurrentPage ] = React.useState(initialPage || 1);
  const [ pageCursor, setPageCursor ] = React.useState<Record<number, string>>({ 1: "" });
  const [ isLastPage, setIsLastPage ] = React.useState(false);
  const [ totalRecords, setTotalRecords ] = React.useState(0);

  // ── Component-level loading flag with minimum display time ──
  // The skeleton must be visible long enough for the user to perceive it (≥300ms).
  // With warm TanStack Query cache, data returns instantly on mount, so a naive
  // flag would flip in one frame (16ms) — invisible. This approach guarantees the
  // skeleton renders for at least MIN_SKELETON_MS, matching Detail/Form page UX
  // where processing takes multiple render cycles.
  const [ hasReceivedData, setHasReceivedData ] = React.useState(false);
  const mountTimeRef = React.useRef(Date.now());

  // ── Stable hooks (after root-cause fixes to providers) ──
  const { notifyError } = useAppContext();
  const { formatDate, formatBoolean } = useFormat();
  const placeholderContext = usePlaceholderContext(routeParams);

  // Skip reset effect on first mount — initial state already correct
  const isFirstMount = React.useRef(true);

  // Tracks the last-processed rawResponse to avoid redundant pagination state updates.
  // Declared here (before the reset effect) because the reset effect needs to clear it
  // when mode/filter changes occur, ensuring the next response is always processed.
  const prevRawResponseRef = React.useRef<Record<string, unknown> | null>(null);

  // Reset pagination when filters, sort, pageSize, or search mode change.
  // isSearchMode is included because switching between database/search endpoints
  // invalidates the cursor state (database cursors are meaningless for search, and vice versa).
  // Also clears prevRawResponseRef so the pagination side-effect processes the
  // next response from the new query (prevents stale ref from blocking updates).
  React.useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    setPageCursor({ 1: "" });
    setCurrentPage(1);
    setIsLastPage(false);
    setTotalRecords(0);
    prevRawResponseRef.current = null;
  }, [ appliedFilters, sort, pageSize, isSearchMode ]);

  const currentCursor = pageCursor[ currentPage ] || '';

  // ── Derived column configs (stable when propertiesConfig is stable) ──
  const identifierColumns = React.useMemo(
    () => propertiesConfig.filter(property => property.isIdentifier),
    [ propertiesConfig ]
  );

  const formattingColumns = React.useMemo(
    () => propertiesConfig.filter(property =>
      [ 'date', 'datetime', 'time', 'boolean', 'switch', 'toggle', 'json' ]
        .includes(property.fieldType?.toLowerCase())
    ),
    [ propertiesConfig ]
  );

  const getSortString = React.useCallback(() => {
    if (!sort.length) return '';
    return sort
      .map(s => s.field && s.order ? `${s.field as string}:${s.order === 'ascend' ? 'asc' : 'desc'}` : null)
      .filter(Boolean)
      .join(',');
  }, [ sort ]);

  const entityName = React.useMemo(
    () => deriveEntityName(apiConfig.apiUrl),
    [ apiConfig.apiUrl ]
  );

  // ── Reactive API URL ──
  const apiUrl = React.useMemo(
    () => substituteUrlParams(apiConfig.apiUrl, routeParams),
    [ apiConfig.apiUrl, routeParams ]
  );

  // ── Build request payload reactively ──
  const payload = React.useMemo(() => {
    const resolvedFilters = resolveFilterPlaceholders(appliedFilters, placeholderContext);
    const filterPayload = getFilterPayload(resolvedFilters, apiConfig.apiMethod);

    const p: Record<string, any> = {
      ...filterPayload,
    };

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.forEach((value, key) => {
        if ((PASS_THROUGH_URL_PARAMS as readonly string[]).includes(key)) {
          p[ key ] = value;
        }
      });
    }

    if (fetchStrategy === 'lazy') {
      const identifierColumnKeys = identifierColumns.map(c => c.dataIndex);
      const attributes = Array.from(new Set([ ...visibleColumns, ...identifierColumnKeys ]));
      if (attributes.length > 0) {
        p.attributes = attributes.join(',');
      }
    }

    const sortString = getSortString();

    if (isSearchMode) {
      p.q = searchQuery;
      p.page = currentPage;
      p.hitsPerPage = pageSize;
      if (sortString) {
        p.sort = sortString;
      }
      if (facetedColumns.length > 0) {
        p.facets = facetedColumns.join(',');
      }
    } else {
      p.cursor = currentCursor;
      p.count = pageSize;
      if (sort.length > 0 && sort[ 0 ].order) {
        p.order = sort[ 0 ].order === 'ascend' ? 'asc' : 'desc';
      } else if (typeof apiConfig.defaultSort === 'string') {
        p.order = apiConfig.defaultSort;
      }
    }

    return p;
  }, [ appliedFilters, placeholderContext, apiConfig.apiMethod, apiConfig.defaultSort,
    fetchStrategy, identifierColumns, visibleColumns, isSearchMode, searchQuery,
    currentPage, pageSize, sort, facetedColumns, currentCursor, getSortString ]);

  // ── Centralized data fetching via useEntityList ──
  const {
    data: rawRecords,
    rawResponse,
    isFetching: queryIsFetching,
    error,
    invalidate,
    dataUpdatedAt,
  } = useEntityList({
    entityName,
    apiConfig,
    apiUrl,
    payload,
    staleTime: 15_000,
  });

  // ── Telemetry: span per table fetch ──
  // Tracks fetch duration from queryIsFetching=true to false using a stable ref.
  // OTel API is a no-op when no SDK is registered (dev-only), so this is safe in prod.
  const fetchSpanRef = React.useRef<Span | null>(null);
  React.useEffect(() => {
    if (queryIsFetching) {
      if (!fetchSpanRef.current) {
        const span = getTracer('ui24/table').startSpan('table.fetch', {
          attributes: {
            'entity.name': entityName,
            'api.url': apiUrl,
            'fetch.mode': isSearchMode ? 'search' : 'list',
            'fetch.strategy': fetchStrategy,
            'page.number': currentPage,
            'page.size': pageSize,
          },
        });
        fetchSpanRef.current = span;
      }
    } else {
      const span = fetchSpanRef.current;
      if (span) {
        if (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
          span.setAttribute('error.message', String(error));
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }
        span.end();
        fetchSpanRef.current = null;
      }
    }
  }, [ queryIsFetching, error, entityName, apiUrl, isSearchMode, fetchStrategy, currentPage, pageSize ]);

  // ── Process records: formatting, identifiers (derived via useMemo, no setState) ──
  const listRecords = React.useMemo(() => {
    if (!rawResponse) return [];

    const sourceRecords = isSearchMode
      ? (rawResponse.items || [])
      : (rawRecords || []);

    if (!Array.isArray(sourceRecords)) return [];

    return sourceRecords.map((record: any) => {
      // Shallow clone to avoid mutating cached objects
      const processed: any = { ...record };
      processed.__raw__ = { ...record };

      formattingColumns.forEach((property) => {
        const nestedValue = getNestedValue(processed, property.dataIndex);

        if (nestedValue === null || nestedValue === undefined || nestedValue === '') {
          processed[ property.dataIndex ] = '';
          return;
        }

        processed[ property.dataIndex ] = nestedValue;

        if ([ 'date', 'datetime', 'time' ].includes(property.fieldType?.toLowerCase())) {
          const itemValue = nestedValue.toString().startsWith('0')
            ? new Date(parseInt(nestedValue)).toISOString()
            : nestedValue;
          processed[ property.dataIndex ] = formatDate(itemValue, property.fieldType?.toLowerCase() as 'date' | 'datetime' | 'time');
        } else if ([ 'boolean', 'switch', 'toggle' ].includes(property.fieldType?.toLowerCase())) {
          if (typeof nestedValue === 'boolean') {
            processed[ property.dataIndex ] = formatBoolean(nestedValue);
          }
        } else if (property.fieldType?.toLowerCase() === 'json') {
          processed[ property.dataIndex ] = typeof nestedValue !== 'string'
            ? JSON.stringify(nestedValue, null, 2)
            : nestedValue;
        }
      });

      const identifiers = identifierColumns.map(column => ({
        [ column.dataIndex ]: getNestedValue(processed, column.dataIndex)
      }));
      processed[ recordIdentifierKey ] = JSON.stringify(identifiers);

      return processed;
    });
  }, [ rawResponse, rawRecords, isSearchMode, formattingColumns, identifierColumns,
    recordIdentifierKey, formatDate, formatBoolean ]);

  // ── Mark data as received (drives skeleton → table transition) ──
  // Ensures the skeleton is visible for a minimum duration so users perceive it.
  // Cold cache (slow API): skeleton shows while fetching, disappears when data arrives.
  // Warm cache (instant data): skeleton shows for MIN_SKELETON_MS then disappears.
  // Error case: API returns 500 — rawResponse stays null, so we must also check
  // `error` here. Without this, hasReceivedData never flips, isInitialLoad stays
  // true forever, and the skeleton keeps shimmering instead of the error state showing.
  const MIN_SKELETON_MS = 300;
  React.useEffect(() => {
    const hasTerminated = !!rawResponse || !!error;
    if (!hasTerminated || hasReceivedData) return;

    const elapsed = Date.now() - mountTimeRef.current;
    if (elapsed >= MIN_SKELETON_MS) {
      setHasReceivedData(true);
    } else {
      const timer = setTimeout(() => setHasReceivedData(true), MIN_SKELETON_MS - elapsed);
      return () => clearTimeout(timer);
    }
  }, [ rawResponse, error, hasReceivedData ]);

  // ── Pagination side-effect: update cursor map from response ──
  React.useEffect(() => {
    if (!rawResponse || rawResponse === prevRawResponseRef.current) return;
    prevRawResponseRef.current = rawResponse;

    if (isSearchMode) {
      setTotalRecords(rawResponse.total || 0);
    } else {
      if (rawResponse.cursor) {
        setPageCursor(prev => {
          if (prev[ currentPage + 1 ] === rawResponse.cursor) return prev;
          return { ...prev, [ currentPage + 1 ]: rawResponse.cursor };
        });
      }
      setIsLastPage(!rawResponse.cursor || (listRecords.length) < pageSize);
    }
  }, [ rawResponse, listRecords.length, isSearchMode, currentPage, pageSize ]);

  // ── Error notification ──
  React.useEffect(() => {
    if (error) {
      const errorResult = handleApiError(error, 'Failed to fetch records');
      notifyError(errorResult.errorMessage);
      console.error('Error fetching records:', error);
    }
  }, [ error, notifyError ]);

  // ── Facets (derived) ──
  const facetResults = React.useMemo(() => {
    if (!rawResponse?.facets) return {};
    return rawResponse.facets;
  }, [ rawResponse ]);

  // ── fetchRecords: sets state to trigger reactive refetch via payload change ──
  // When pagination calls fetchRecords(page, cursor), it sets the cursor and page
  // synchronously. The payload memo recomputes → queryKey changes → useQuery refetches.
  // When forceRefresh is requested (manual reload), we invalidate the cache AFTER
  // updating state, so both updates batch into a single render and the refetch uses
  // the correct (new) query key.
  //
  // Note: filters are NOT passed here — they flow reactively through `appliedFilters`
  // prop → payload memo → queryKey. Callers should `setAppliedFilters()` before calling
  // this function; React batches both state updates into a single render.
  const fetchRecords = React.useCallback(async (
    pageNumber: number = 1,
    forceCursor?: string,
    options?: { forceRefresh?: boolean }
  ) => {
    if (forceCursor !== undefined) {
      setPageCursor(prev => ({ ...prev, [ pageNumber ]: forceCursor }));
    }
    setCurrentPage(pageNumber);
    // Invalidate AFTER state updates so React batches them into one render.
    // The subsequent re-render computes a new queryKey (with updated page/cursor),
    // and the invalidated cache ensures a fresh fetch for that key.
    if (options?.forceRefresh) {
      await invalidate();
    }
  }, [ invalidate ]);

  return {
    listRecords,
    // isFetching = true during ANY fetch (initial, refetch, pagination, reload).
    // This drives the antd Table's spinning overlay indicator.
    isLoading: queryIsFetching,
    // Component-level flag: false until the first API response arrives after mount.
    // Unlike TanStack Query's isLoading (which is false when cache is warm), this
    // resets on every mount, ensuring the skeleton always shows during navigation
    // between entities — matching the behavior of detail and form pages.
    isInitialLoad: !hasReceivedData,
    currentPage,
    pageCursor,
    isLastPage,
    totalRecords,
    facetResults,
    fetchRecords,
    pageSize,
    dataUpdatedAt: dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null,
    error,
  };
};
