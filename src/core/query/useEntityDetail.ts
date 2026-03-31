import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';
import { useApi, type IApiConfig } from '../context/ApiContext';
import { substituteUrlParams, buildCacheIdentifiers, deriveEntityName } from '../utils';
import { queryKeys } from './queryKeys';

export interface UseEntityDetailOptions {
  /** API configuration (must include apiUrl pattern, e.g. '/admin/team/:id') */
  apiConfig: IApiConfig;
  /** Route parameters for URL substitution and cache key scoping */
  routeParams?: Record<string, any>;
  /** Primary record identifier (fallback for :id when not in routeParams) */
  identifier?: string | number;
  /** Entity name override. If omitted, derived from apiConfig.apiUrl */
  entityName?: string;
  /** Whether the query is enabled */
  enabled?: boolean;
  /** Stale time override in ms (default: from QueryClient — 30s) */
  staleTime?: number;
  /** Auto-refresh interval in ms (0 = disabled) */
  refetchInterval?: number | false;
}

export interface UseEntityDetailResult {
  /** The fetched record data (extracted via responseKey if configured) */
  data: any | undefined;
  /** Full API response data */
  rawResponse: any;
  /** Derived or provided entity name (for error messages, empty states, etc.) */
  entityName: string;
  /** True on first load (no cached data) */
  isLoading: boolean;
  /** True when refetching in the background */
  isFetching: boolean;
  /** Error if the query failed */
  error: unknown;
  /** Manually trigger a refetch */
  refetch: () => Promise<any>;
  /** Invalidate this specific detail query */
  invalidate: () => Promise<void>;
  /** Invalidate ALL detail queries for this entity */
  invalidateAll: () => Promise<void>;
}

/**
 * React Query wrapper for fetching a single entity record.
 * Used by Details.tsx (view mode), Form.tsx (edit mode), and RelatedRecordPeek.
 *
 * Internally handles:
 * - Entity name derivation from the API URL pattern
 * - URL parameter substitution (routeParams + identifier → resolved URL)
 * - Stable cache key construction (only URL-referenced params, not the full routeParams)
 * - Caching, deduplication, background refetch via TanStack Query
 * - Loading/error states and targeted cache invalidation
 */
export function useEntityDetail({
  apiConfig,
  routeParams,
  identifier,
  entityName: entityNameOverride,
  enabled = true,
  staleTime,
  refetchInterval,
}: UseEntityDetailOptions): UseEntityDetailResult {
  const { callApiMethod } = useApi();
  const queryClient = useQueryClient();

  const apiUrl = apiConfig.apiUrl;

  // Stabilize routeParams via JSON serialization — callers typically create a
  // new object literal on each render, but the values rarely change.
  const routeParamsKey = JSON.stringify(routeParams);
  const stableRouteParams = useMemo(
    () => routeParams || {},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ routeParamsKey ]
  );

  // ── Derived values (all from the URL pattern) ──
  const resolvedEntityName = useMemo(
    () => entityNameOverride || deriveEntityName(apiUrl),
    [ entityNameOverride, apiUrl ]
  );

  const resolvedApiUrl = useMemo(
    () => apiUrl ? substituteUrlParams(apiUrl, stableRouteParams, identifier) : '',
    [ apiUrl, stableRouteParams, identifier ]
  );

  const cacheIdentifiers = useMemo(
    () => buildCacheIdentifiers(apiUrl, stableRouteParams, identifier),
    [ apiUrl, stableRouteParams, identifier ]
  );

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
  const apiUrlRef = useRef(resolvedApiUrl);
  apiUrlRef.current = resolvedApiUrl;

  const queryKey = useMemo(
    () => queryKeys.entity(resolvedEntityName).detail(cacheIdentifiers),
    [ resolvedEntityName, cacheIdentifiers ]
  );

  // ── Stable queryFn ──
  // Empty deps → never recreated. Always reads latest values from refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const queryFn = useCallback(async () => {
    const response = await callApiMethod({
      ...apiConfigRef.current,
      apiUrl: apiUrlRef.current,
    });

    if (response.status >= 200 && response.status < 300) {
      return response.data;
    }

    throw response;
  }, []);

  const query: UseQueryResult<Record<string, any>> = useQuery({
    queryKey,
    queryFn,
    enabled: enabled && !!resolvedApiUrl,
    ...(staleTime !== undefined ? { staleTime } : {}),
    ...(refetchInterval !== undefined ? { refetchInterval } : {}),
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [ queryClient, queryKey ]
  );

  const invalidateAll = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.entity(resolvedEntityName).details() }),
    [ queryClient, resolvedEntityName ]
  );

  // Extract responseKey for stable memo dependency (avoids recomputation when
  // apiConfig object reference changes but responseKey stays the same)
  const responseKey = apiConfig.responseKey;
  const data = useMemo(() => {
    if (!query.data) return undefined;
    if (responseKey && query.data[ responseKey ]) {
      return query.data[ responseKey ];
    }
    return query.data;
  }, [ query.data, responseKey ]);

  return {
    data,
    rawResponse: query.data,
    entityName: resolvedEntityName,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    invalidate,
    invalidateAll,
  };
}
