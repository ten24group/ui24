import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useApi, type IApiConfig } from '../context/ApiContext';
import { queryKeys } from './queryKeys';

export interface UseEntityListOptions {
  /** Entity name for cache key scoping */
  entityName: string;
  /** API configuration for fetching list data */
  apiConfig: IApiConfig & {
    responseKey?: string;
    defaultSort?: string;
  };
  /** Resolved API URL (after route param substitution) */
  apiUrl: string;
  /** Request payload (filters, sort, cursor, count, search, etc.) */
  payload: Record<string, any>;
  /** Whether the query is enabled (e.g., wait for config to load) */
  enabled?: boolean;
  /** Stale time override in ms (default: 30s from QueryClient) */
  staleTime?: number;
  /** Auto-refresh interval in ms (0 = disabled). Replaces useAutoRefresh. */
  refetchInterval?: number | false;
}

export interface UseEntityListResult {
  /** Fetched records */
  data: any[] | undefined;
  /** Full API response data (includes cursor, facets, total, etc.) */
  rawResponse: any;
  /** True on first load (no cached data) */
  isLoading: boolean;
  /** True when refetching in the background (data still shown) */
  isFetching: boolean;
  /** Error if the query failed */
  error: unknown;
  /** Manually trigger a refetch */
  refetch: () => Promise<any>;
  /** Invalidate this entity's list cache (e.g., after mutation) */
  invalidate: () => Promise<void>;
}

/**
 * React Query wrapper for fetching entity list data.
 * Replaces the manual fetch logic in useTableData.tsx.
 * 
 * The caller (useTableData) is responsible for:
 * - Building the payload (filters, sort, pagination, search)
 * - Resolving the API URL (route param substitution)
 * - Processing the response (formatting dates, booleans, identifiers)
 * 
 * This hook handles:
 * - Caching, deduplication, background refetch
 * - Loading/error states
 * - Cache invalidation after mutations
 */
export function useEntityList({
  entityName,
  apiConfig,
  apiUrl,
  payload,
  enabled = true,
  staleTime,
  refetchInterval,
}: UseEntityListOptions): UseEntityListResult {
  const { callApiMethod } = useApi();
  const queryClient = useQueryClient();

  const queryKey = useMemo(
    () => queryKeys.entity(entityName).list({
      apiUrl,
      filters: payload.filters || payload,
      sort: payload.sort || payload.order,
      page: payload.page,
      cursor: payload.cursor,
      pageSize: payload.count || payload.hitsPerPage,
      search: payload.q,
      attributes: payload.attributes,
    }),
    [entityName, apiUrl, payload]
  );

  const query: UseQueryResult<any> = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await callApiMethod({
        ...apiConfig,
        apiUrl,
        payload,
      });

      if (response.status >= 200 && response.status < 300) {
        return response.data;
      }

      throw response;
    },
    enabled,
    ...(staleTime !== undefined ? { staleTime } : {}),
    ...(refetchInterval !== undefined ? { refetchInterval } : {}),
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.entity(entityName).lists() }),
    [queryClient, entityName]
  );

  const records = useMemo(() => {
    if (!query.data) return undefined;
    const responseKey = apiConfig.responseKey;
    if (responseKey && query.data[responseKey]) {
      return query.data[responseKey];
    }
    // Search mode returns items
    if (query.data.items) {
      return query.data.items;
    }
    return query.data;
  }, [query.data, apiConfig.responseKey]);

  return {
    data: records,
    rawResponse: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    invalidate,
  };
}
