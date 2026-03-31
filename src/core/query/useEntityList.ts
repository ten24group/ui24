import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';
import { useApi, type IApiConfig } from '../context/ApiContext';
import { queryKeys } from './queryKeys';

/**
 * Configuration for useEntityList.
 *
 * Uses a generic for apiConfig so callers can pass richer types
 * (e.g., ITableApiConfig with `defaultSort: SortConfig`) without type-narrowing
 * issues. This hook only reads fields defined on IApiConfig (apiUrl, apiMethod,
 * responseKey, headers, etc.) — extra fields are transparently forwarded to the
 * API call via callApiMethod.
 */
export interface UseEntityListOptions<TApiConfig extends IApiConfig = IApiConfig> {
  /** Entity name for React Query cache key scoping (e.g., 'user', 'order') */
  entityName: string;
  /** API configuration — accepts IApiConfig or any subtype (e.g., ITableApiConfig) */
  apiConfig: TApiConfig;
  /** Resolved API URL (after route param substitution, e.g., '/admin/users') */
  apiUrl: string;
  /** Request payload (filters, sort, cursor, count, search, facets, attributes, etc.) */
  payload: Record<string, any>;
  /** Whether the query is enabled (default: true). Set false to defer fetching until ready. */
  enabled?: boolean;
  /** Stale time override in ms (default: inherited from QueryClient, typically 30s) */
  staleTime?: number;
  /** Auto-refresh interval in ms (0 or false = disabled). Replaces useAutoRefresh pattern. */
  refetchInterval?: number | false;
}

export interface UseEntityListResult {
  /** Fetched records (extracted via responseKey or common response patterns) */
  data: any[] | undefined;
  /** Full API response data (includes cursor, facets, total, etc.) */
  rawResponse: any;
  /** True on first load when no cached data exists yet */
  isLoading: boolean;
  /** True when refetching in the background (stale data still shown) */
  isFetching: boolean;
  /** Error if the query failed */
  error: unknown;
  /** Manually trigger a refetch (bypasses staleTime) */
  refetch: () => Promise<any>;
  /** Invalidate this entity's list cache (e.g., after a mutation). All mounted queries auto-refetch. */
  invalidate: () => Promise<void>;
  /** Timestamp (ms since epoch) of when the query data was last updated */
  dataUpdatedAt: number;
}

/**
 * Centralized React Query hook for fetching entity list data.
 *
 * Separation of concerns:
 * - **Caller (useTableData)** is responsible for:
 *   - Building the request payload (filters, sort, pagination, search, facets)
 *   - Resolving the API URL (route param substitution)
 *   - Processing the response (formatting dates/booleans, building identifiers)
 *
 * - **This hook** handles:
 *   - Caching, deduplication, and background refetch via TanStack Query
 *   - Loading/error state management
 *   - Cache invalidation after mutations (via `invalidate()`)
 *   - Record extraction from response (via `responseKey` or common patterns)
 *
 * Stability guarantees (critical for avoiding infinite re-render loops):
 * - `callApiMethod` is stable (provided by ApiContext's ref-wrapped useCallback)
 * - `queryFn` is stable (useCallback with empty deps, reads latest values from refs)
 * - `queryKey` changes only when payload *content* changes (JSON serialization comparison)
 *
 * The refs inside this hook are NOT workarounds — they are a required integration
 * pattern for TanStack Query v5 + React 19. TanStack Query's observer calls
 * `setOptions()` whenever `queryFn` identity changes, which triggers a
 * `useSyncExternalStore` notification. Combined with antd Table's class-component
 * `componentDidUpdate` scroll handler, this produces infinite re-render cascades.
 * A stable `queryFn` (via useCallback + refs) avoids this entirely.
 */
export function useEntityList<TApiConfig extends IApiConfig = IApiConfig>({
  entityName,
  apiConfig,
  apiUrl,
  payload,
  enabled = true,
  staleTime,
  refetchInterval,
}: UseEntityListOptions<TApiConfig>): UseEntityListResult {
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
  const apiConfigRef = useRef<TApiConfig>(apiConfig);
  apiConfigRef.current = apiConfig;
  const apiUrlRef = useRef(apiUrl);
  apiUrlRef.current = apiUrl;
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  // ── Content-based query key ──
  // JSON-serialize payload for content-based comparison so that the queryKey
  // only changes when the actual request parameters change, not when the
  // payload object reference changes (which happens on every parent render).
  const payloadJson = JSON.stringify(payload);

  const queryKey = useMemo(
    () => {
      return queryKeys.entity(entityName).list({
        apiUrl,
        filters: payload.filters || payload,
        sort: payload.sort || payload.order,
        page: payload.page,
        cursor: payload.cursor,
        pageSize: payload.count || payload.hitsPerPage,
        search: payload.q,
        attributes: payload.attributes,
      });
    },
    // payloadJson is the content-based key — when it changes, payload has new values
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ entityName, apiUrl, payloadJson ]
  );

  // ── Stable queryFn ──
  // Empty deps → never recreated. Always reads latest values from refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const queryFn = useCallback(async () => {
    const response = await callApiMethod({
      ...apiConfigRef.current,
      apiUrl: apiUrlRef.current,
      payload: payloadRef.current,
    });

    if (response.status >= 200 && response.status < 300) {
      return response.data;
    }

    throw response;
  }, []);

  const query: UseQueryResult<Record<string, any>> = useQuery({
    queryKey,
    queryFn,
    enabled,
    staleTime: staleTime ?? undefined,
    refetchInterval: refetchInterval ?? undefined,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.entity(entityName).lists() }),
    [ queryClient, entityName ]
  );

  // ── Extract records from response ──
  // Uses responseKey from apiConfig, falls back to common response patterns
  // (response.items for search, or raw response for simple list endpoints).
  const responseKey = apiConfig.responseKey;
  const records = useMemo(() => {
    if (!query.data) return undefined;
    if (responseKey && query.data[ responseKey ]) {
      return query.data[ responseKey ];
    }
    if (query.data.items) {
      return query.data.items;
    }
    return query.data;
  }, [ query.data, responseKey ]);

  return {
    data: records,
    rawResponse: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    invalidate,
    dataUpdatedAt: query.dataUpdatedAt,
  };
}
