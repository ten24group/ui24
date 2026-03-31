import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApi } from '../context/ApiContext';
import { queryKeys } from './queryKeys';
import type { IOptions } from '../types/field-config';

export interface UseFieldOptionsOptions {
  /** Entity name for cache key scoping */
  entityName: string;
  /** Field name for cache key */
  fieldName: string;
  /** API configuration for fetching options */
  apiConfig: {
    apiMethod: 'GET' | 'POST';
    apiUrl: string;
    responseKey: string;
    filters?: Record<string, any>;
    count?: number;
    disableSearch?: boolean;
  };
  /** Search term (triggers new fetch with search param) */
  search?: string;
  /** Cursor for pagination */
  cursor?: string;
  /** Dependency filters from cascading selects (e.g., parent field value) */
  dependencyFilters?: Record<string, unknown>;
  /** Whether the query is enabled */
  enabled?: boolean;
  /** Stale time override in ms (default: 5 min — options change rarely) */
  staleTime?: number;
}

export interface UseFieldOptionsResult {
  /** Raw options data from API (before mapping) */
  data: any[] | undefined;
  /** Full API response (includes cursor for pagination) */
  rawResponse: any;
  /** Next cursor for "Load More" */
  nextCursor: string | undefined;
  /** Whether more data is available */
  hasMore: boolean;
  /** True on first load */
  isLoading: boolean;
  /** True when refetching */
  isFetching: boolean;
  /** Error if the query failed */
  error: unknown;
  /** Manually trigger a refetch */
  refetch: () => Promise<any>;
  /** Invalidate options cache for this field */
  invalidate: () => Promise<void>;
  /** Invalidate ALL field options for this entity */
  invalidateAll: () => Promise<void>;
}

/**
 * React Query wrapper for fetching field options (select, radio, checkbox, etc.).
 * 
 * This is where caching delivers the most value — the same entity's options
 * are used across forms, tables (filters), and modals. Without caching, each
 * OptionSelector instance fires its own API call.
 * 
 * Default staleTime: 5 minutes (options change rarely).
 */
export function useFieldOptions({
  entityName,
  fieldName,
  apiConfig,
  search = '',
  cursor = '',
  dependencyFilters,
  enabled = true,
  staleTime = 5 * 60 * 1000, // 5 min default for options
}: UseFieldOptionsOptions): UseFieldOptionsResult {
  const { callApiMethod } = useApi();
  const queryClient = useQueryClient();

  // ── Refs for queryFn closure stability ──
  // queryFn must be a stable reference (useCallback with empty deps) because
  // TanStack Query v5's observer calls setOptions() when queryFn identity changes.
  // With React 19's useSyncExternalStore, identity changes cascade into re-renders.
  // Refs let queryFn always read the LATEST values without changing its own identity.
  //
  // Note: callApiMethod is already stable (ref-wrapped useCallback in ApiContext),
  // so it doesn't need a ref here — only props/derived values that change each render.
  const apiConfigRef = useRef(apiConfig);
  apiConfigRef.current = apiConfig;
  const searchRef = useRef(search);
  searchRef.current = search;
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const dependencyFiltersRef = useRef(dependencyFilters);
  dependencyFiltersRef.current = dependencyFilters;

  // Stabilize object refs via JSON serialization so the queryKey doesn't
  // change on every render due to new object references from parent.
  const filtersKey = apiConfig.filters ? JSON.stringify(apiConfig.filters) : '';
  const depsKey = dependencyFilters ? JSON.stringify(dependencyFilters) : '';

  const queryKey = useMemo(
    () => queryKeys.entity(entityName).fieldOptions({
      apiUrl: apiConfig.apiUrl,
      fieldName,
      search: search || undefined,
      cursor: cursor || undefined,
      ...(filtersKey ? { filters: JSON.parse(filtersKey) } : {}),
      ...(depsKey ? { deps: JSON.parse(depsKey) } : {}),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ entityName, fieldName, apiConfig.apiUrl, filtersKey, search, cursor, depsKey ]
  );

  // ── Stable queryFn ──
  // Empty deps → never recreated. Always reads latest values from refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const queryFn = useCallback(async () => {
    const cfg = apiConfigRef.current;
    const payload: Record<string, any> = { ...(cfg.filters || {}), ...(dependencyFiltersRef.current || {}) };
    payload.count = cfg.count || 50;

    if (cursorRef.current) {
      payload.cursor = cursorRef.current;
    }

    if (cfg.disableSearch !== true && searchRef.current) {
      payload.search = searchRef.current;
    }

    const response = await callApiMethod({
      apiUrl: cfg.apiUrl,
      apiMethod: cfg.apiMethod,
      payload,
    });

    if (response.status >= 200 && response.status < 300) {
      return response.data;
    }

    throw response;
  }, []);

  // Guard: never fire if apiUrl is empty — prevents broken requests from
  // misconfigured fields or render cycles where config hasn't settled yet.
  const queryEnabled = enabled && !!apiConfig.apiUrl;

  const query: UseQueryResult<Record<string, any>> = useQuery({
    queryKey,
    queryFn,
    enabled: queryEnabled,
    staleTime,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [ queryClient, queryKey ]
  );

  const invalidateAll = useCallback(
    () => queryClient.invalidateQueries({
      queryKey: queryKeys.entity(entityName).allFieldOptions(),
    }),
    [ queryClient, entityName ]
  );

  const data = useMemo((): any[] | undefined => {
    if (!query.data) return undefined;
    const result = query.data[ apiConfig.responseKey ];
    return Array.isArray(result) ? result : undefined;
  }, [ query.data, apiConfig.responseKey ]);

  const nextCursor = query.data?.cursor || undefined;
  const hasMore = !!nextCursor;

  return {
    data,
    rawResponse: query.data,
    nextCursor,
    hasMore,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    invalidate,
    invalidateAll,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// useInfiniteFieldOptions — accumulating wrapper over useFieldOptions
// ────────────────────────────────────────────────────────────────────────────

export interface UseInfiniteFieldOptionsOptions {
  /** Entity name for cache key scoping */
  entityName: string;
  /** Field name for cache key */
  fieldName: string;
  /** API configuration (same as useFieldOptions) */
  apiConfig: UseFieldOptionsOptions[ 'apiConfig' ];
  /** Dependency filters from cascading selects */
  dependencyFilters?: Record<string, unknown>;
  /** Whether the query is enabled */
  enabled?: boolean;
  /** Transform a raw record into a label/value option */
  mapOption?: (record: any) => IOptions;
  /** Debounce delay for search in ms. @default 500 */
  searchDebounce?: number;
}

export interface UseInfiniteFieldOptionsResult {
  /** Accumulated, deduped, sorted options */
  options: IOptions[];
  /** Whether more data is available for load-more */
  hasMore: boolean;
  /** True on first page load */
  isLoading: boolean;
  /** True when any fetch is in-flight */
  isFetching: boolean;
  /** Current search input value (pre-debounce) */
  searchTerm: string;
  /** Load next page of options */
  loadMore: () => void;
  /** Update search term (debounced internally) */
  search: (term: string) => void;
  /** Reset cursor, search, and accumulated data */
  reset: () => void;
  /** Refetch current page */
  refetch: () => Promise<any>;
  /** Invalidate cache for current query */
  invalidate: () => Promise<void>;
  /** Invalidate ALL field option caches for this entity, then reset */
  invalidateAll: () => Promise<void>;
}

/**
 * Accumulating wrapper over `useFieldOptions` for cursor-paginated option loading.
 *
 * Handles:
 * - "Load More" cursor pagination with automatic result accumulation
 * - Debounced search that resets cursor and accumulated results
 * - Deduplication by `value` and alphabetical sorting by `label`
 * - Dependency filter resets (cascading selects)
 *
 * @example
 * const { options, hasMore, isLoading, loadMore, search } = useInfiniteFieldOptions({
 *   entityName: 'team',
 *   fieldName: 'teamId',
 *   apiConfig: { apiUrl: '/api/teams', apiMethod: 'GET', responseKey: 'data' },
 *   mapOption: (r) => ({ label: r.teamName, value: r.teamId }),
 * });
 */
export function useInfiniteFieldOptions({
  entityName,
  fieldName,
  apiConfig,
  dependencyFilters,
  enabled = true,
  mapOption,
  searchDebounce = 500,
}: UseInfiniteFieldOptionsOptions): UseInfiniteFieldOptionsResult {
  const [ cursor, setCursor ] = useState('');
  const [ searchTerm, setSearchTerm ] = useState('');
  const [ debouncedSearch, setDebouncedSearch ] = useState('');
  const [ accumulatedRaw, setAccumulatedRaw ] = useState<any[]>([]);
  const isLoadingMoreRef = useRef(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Delegate single-page fetch to useFieldOptions ──
  const {
    data,
    nextCursor,
    hasMore: pageHasMore,
    isLoading,
    isFetching,
    refetch,
    invalidate,
    invalidateAll: baseInvalidateAll,
  } = useFieldOptions({
    entityName,
    fieldName,
    apiConfig,
    search: debouncedSearch,
    cursor,
    dependencyFilters,
    enabled,
  });

  // ── Accumulate when new data arrives ──
  useEffect(() => {
    if (!data) return;

    if (isLoadingMoreRef.current) {
      setAccumulatedRaw(prev => [ ...prev, ...data ]);
      isLoadingMoreRef.current = false;
    } else {
      setAccumulatedRaw(data);
    }
  }, [ data ]);

  // ── Map, deduplicate, sort ──
  const options = useMemo((): IOptions[] => {
    const mapped: IOptions[] = mapOption
      ? accumulatedRaw
        .filter((r): r is Record<string, any> => typeof r === 'object' && r !== null)
        .map(mapOption)
      : accumulatedRaw.filter(
        (opt): opt is IOptions =>
          typeof opt === 'object' && opt !== null && 'label' in opt && 'value' in opt,
      );

    // Deduplicate by value
    const uniqueMap = new Map<string | number, IOptions>();
    mapped.forEach(opt => uniqueMap.set(opt.value, opt));

    // Sort alphabetically by label
    return Array.from(uniqueMap.values()).sort((a, b) => {
      const labelA = String(a.label || a.value || '').toLowerCase();
      const labelB = String(b.label || b.value || '').toLowerCase();
      return labelA.localeCompare(labelB);
    });
  }, [ accumulatedRaw, mapOption ]);

  // ── Load more (next page) ──
  const loadMore = useCallback(() => {
    if (nextCursor && pageHasMore && !isFetching) {
      isLoadingMoreRef.current = true;
      setCursor(nextCursor);
    }
  }, [ nextCursor, pageHasMore, isFetching ]);

  // ── Debounced search ──
  const search = useCallback((term: string) => {
    setSearchTerm(term);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      isLoadingMoreRef.current = false;
      setDebouncedSearch(term);
      setCursor('');
    }, searchDebounce);
  }, [ searchDebounce ]);

  // ── Reset all internal state ──
  const reset = useCallback(() => {
    isLoadingMoreRef.current = false;
    setCursor('');
    setSearchTerm('');
    setDebouncedSearch('');
    setAccumulatedRaw([]);
  }, []);

  // ── Reset when dependency filters ACTUALLY change (cascading selects) ──
  //
  // Uses a ref to track the last-seen depFilterKey value. This correctly
  // handles two problematic cases without a hasMounted flag:
  //
  // 1. Initial mount: prevRef starts as undefined → skip, just record the key.
  //
  // 2. React Strict Mode double-invoke: Strict Mode re-runs all effects with
  //    the SAME deps. After the first invocation prevRef = depFilterKey, so the
  //    second invocation sees no change and also skips — no spurious reset().
  //
  // 3. Real filter change (cascading select): new depFilterKey ≠ prevRef → reset().
  //
  // Without this guard, when a modal re-opens React Query returns cached data
  // immediately. The [data] effect populates accumulatedRaw, then this effect
  // fires (as it always does on mount), calls reset(), and wipes the options —
  // leaving the dropdown empty even though the cache is warm.
  const depFilterKey = dependencyFilters ? JSON.stringify(dependencyFilters) : '';
  const prevDepFilterKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevDepFilterKeyRef.current === undefined || prevDepFilterKeyRef.current === depFilterKey) {
      prevDepFilterKeyRef.current = depFilterKey;
      return;
    }
    prevDepFilterKeyRef.current = depFilterKey;
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ depFilterKey ]);

  // ── Cleanup debounce timer ──
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // ── InvalidateAll: invalidate cache + reset local state ──
  const invalidateAll = useCallback(async () => {
    await baseInvalidateAll();
    reset();
  }, [ baseInvalidateAll, reset ]);

  return {
    options,
    hasMore: pageHasMore,
    isLoading,
    isFetching,
    searchTerm,
    loadMore,
    search,
    reset,
    refetch,
    invalidate,
    invalidateAll,
  };
}
