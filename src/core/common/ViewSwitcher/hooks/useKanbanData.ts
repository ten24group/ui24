/**
 * useKanbanColumnData — per-column independent data fetching for the Kanban layout.
 *
 * Uses a simple count-based "Load More" strategy:
 * - Initial load fetches `pageSize` records
 * - "Load More" increases the requested count by `pageSize` and refetches
 * - TanStack Query caches by the full payload (including count), so each
 *   "page" is a distinct cache entry
 *
 * This avoids manual cursor accumulation bugs. The backend returns N records
 * in a single response; increasing N to get more records is simple and correct.
 */

import { useState, useMemo, useCallback } from 'react';
import { useEntityList } from '../../../query/useEntityList';
import type { IApiConfig } from '../../../context/ApiContext';
import { substituteUrlParams } from '../../../utils';

export interface KanbanColumnDataResult {
  records: Record<string, unknown>[];
  isLoading: boolean;
  isFetching: boolean;
  hasMore: boolean;
  loadMore: () => void;
  totalLoaded: number;
}

export function useKanbanColumnData(options: {
  apiConfig: IApiConfig;
  groupByField: string;
  columnValue: string;
  pageSize: number;
  appliedFilters: Record<string, unknown>;
  routeParams: Record<string, string>;
  entityName: string;
  enabled: boolean;
}): KanbanColumnDataResult {
  const { apiConfig, groupByField, columnValue, pageSize, appliedFilters, routeParams, entityName, enabled } = options;

  const [ requestedCount, setRequestedCount ] = useState(pageSize);

  const routeParamsKey = JSON.stringify(routeParams);
  const resolvedUrl = useMemo(
    () => (enabled ? substituteUrlParams(apiConfig.apiUrl, routeParams) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ enabled, apiConfig.apiUrl, routeParamsKey ]
  );

  const payload = useMemo(() => ({
    ...appliedFilters,
    [ groupByField ]: columnValue,
    count: requestedCount,
  }), [ appliedFilters, groupByField, columnValue, requestedCount ]);

  const { data, rawResponse, isLoading, isFetching } = useEntityList({
    entityName: `${entityName}-kanban-${columnValue}`,
    apiConfig,
    apiUrl: resolvedUrl,
    payload,
    enabled,
  });

  const records = useMemo(
    () => (enabled && Array.isArray(data) ? data : []) as Record<string, unknown>[],
    [ enabled, data ]
  );

  const hasMore = rawResponse?.cursor != null && rawResponse.cursor !== '';

  const loadMore = useCallback(() => {
    if (!hasMore || isFetching) return;
    setRequestedCount(prev => prev + pageSize);
  }, [ hasMore, isFetching, pageSize ]);

  return {
    records,
    isLoading: enabled && isLoading,
    isFetching: enabled && isFetching,
    hasMore,
    loadMore,
    totalLoaded: records.length,
  };
}
