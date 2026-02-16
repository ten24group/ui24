import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
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

  const queryKey = useMemo(
    () => queryKeys.entity(entityName).detail(identifiers),
    [entityName, identifiers]
  );

  const query: UseQueryResult<any> = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await callApiMethod({
        ...apiConfig,
        apiUrl,
      });

      if (response.status >= 200 && response.status < 300) {
        return response.data;
      }

      throw response;
    },
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

  const data = useMemo(() => {
    if (!query.data) return undefined;
    const responseKey = (apiConfig as any).responseKey;
    if (responseKey && query.data[responseKey]) {
      return query.data[responseKey];
    }
    return query.data;
  }, [query.data, apiConfig]);

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
