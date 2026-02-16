import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useApi } from '../context/ApiContext';
import { queryKeys } from './queryKeys';

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
  enabled = true,
  staleTime = 5 * 60 * 1000, // 5 min default for options
}: UseFieldOptionsOptions): UseFieldOptionsResult {
  const { callApiMethod } = useApi();
  const queryClient = useQueryClient();

  const queryKey = useMemo(
    () => queryKeys.entity(entityName).fieldOptions({
      apiUrl: apiConfig.apiUrl,
      fieldName,
      search: search || undefined,
      cursor: cursor || undefined,
    }),
    [entityName, fieldName, apiConfig.apiUrl, search, cursor]
  );

  const query: UseQueryResult<any> = useQuery({
    queryKey,
    queryFn: async () => {
      const payload: Record<string, any> = { ...(apiConfig.filters || {}) };
      payload.count = apiConfig.count || 50;

      if (cursor) {
        payload.cursor = cursor;
      }

      if (apiConfig.disableSearch !== true && search) {
        payload.search = search;
      }

      const response = await callApiMethod({
        apiUrl: apiConfig.apiUrl,
        apiMethod: apiConfig.apiMethod,
        payload,
      });

      if (response.status === 200) {
        return response.data;
      }

      throw response;
    },
    enabled,
    staleTime,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  );

  const invalidateAll = useCallback(
    () => queryClient.invalidateQueries({
      queryKey: queryKeys.entity(entityName).allFieldOptions(),
    }),
    [queryClient, entityName]
  );

  const data = useMemo(() => {
    if (!query.data) return undefined;
    return query.data[apiConfig.responseKey] as any[] | undefined;
  }, [query.data, apiConfig.responseKey]);

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
