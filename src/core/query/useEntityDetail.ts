import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';
import { useApi, type IApiConfig } from '../context/ApiContext';
import { queryKeys } from './queryKeys';

export interface UseEntityDetailOptions {
  /** Entity name for cache key scoping */
  entityName: string;
  /** API configuration for fetching detail data */
  apiConfig: IApiConfig;
  /** Resolved API URL (after route param + identifier substitution) */
  apiUrl: string;
  /** Record identifiers for cache key */
  identifiers: Record<string, string>;
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
 * Used by both Details.tsx (view mode) and Form.tsx (edit mode).
 * 
 * The caller is responsible for:
 * - Resolving the API URL (substituteUrlParams)
 * - Building identifiers for cache keying
 * - Formatting the response data for display
 * 
 * This hook handles:
 * - Caching, deduplication, background refetch
 * - Loading/error states
 * - Targeted cache invalidation
 */
export function useEntityDetail({
  entityName,
  apiConfig,
  apiUrl,
  identifiers,
  enabled = true,
  staleTime,
  refetchInterval,
}: UseEntityDetailOptions): UseEntityDetailResult {
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
  const apiUrlRef = useRef(apiUrl);
  apiUrlRef.current = apiUrl;

  const queryKey = useMemo(
    () => queryKeys.entity(entityName).detail(identifiers),
    [entityName, identifiers]
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
    enabled: enabled && !!apiUrl,
    ...(staleTime !== undefined ? { staleTime } : {}),
    ...(refetchInterval !== undefined ? { refetchInterval } : {}),
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  );

  const invalidateAll = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.entity(entityName).details() }),
    [queryClient, entityName]
  );

  // Extract responseKey for stable memo dependency (avoids recomputation when
  // apiConfig object reference changes but responseKey stays the same)
  const responseKey = apiConfig.responseKey;
  const data = useMemo(() => {
    if (!query.data) return undefined;
    if (responseKey && query.data[responseKey]) {
      return query.data[responseKey];
    }
    return query.data;
  }, [query.data, responseKey]);

  return {
    data,
    rawResponse: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    invalidate,
    invalidateAll,
  };
}
