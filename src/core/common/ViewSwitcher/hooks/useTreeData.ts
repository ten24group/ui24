/**
 * useTreeData — full-dataset fetching for the Tree layout.
 *
 * Trees need all records to build the parent-child hierarchy.
 * Fetches with a high count limit to get the full dataset.
 *
 * MUST be called with `enabled: true` only when the layout is in independent
 * data mode (config has apiConfig).
 */

import { useMemo } from 'react';
import { useEntityList } from '../../../query/useEntityList';
import type { IApiConfig } from '../../../context/ApiContext';
import { substituteUrlParams } from '../../../utils';

export interface UseTreeDataOptions {
  apiConfig: IApiConfig;
  appliedFilters: Record<string, unknown>;
  routeParams: Record<string, string>;
  entityName: string;
  maxRecords?: number;
  enabled: boolean;
}

export interface UseTreeDataResult {
  records: Record<string, unknown>[];
  isLoading: boolean;
  isFetching: boolean;
}

const EMPTY: Record<string, unknown>[] = [];

export function useTreeData(options: UseTreeDataOptions): UseTreeDataResult {
  const { apiConfig, appliedFilters, routeParams, entityName, maxRecords = 5000, enabled } = options;

  const routeParamsKey = JSON.stringify(routeParams);
  const resolvedUrl = useMemo(
    () => (enabled ? substituteUrlParams(apiConfig.apiUrl, routeParams) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ enabled, apiConfig.apiUrl, routeParamsKey ]
  );

  const payload = useMemo(() => ({
    ...appliedFilters,
    count: maxRecords,
  }), [ appliedFilters, maxRecords ]);

  const { data, isLoading, isFetching } = useEntityList({
    entityName: `${entityName}-tree`,
    apiConfig,
    apiUrl: resolvedUrl,
    payload,
    enabled,
  });

  const records = useMemo(
    () => (enabled && Array.isArray(data) ? data : EMPTY) as Record<string, unknown>[],
    [ enabled, data ]
  );

  return { records, isLoading: enabled && isLoading, isFetching: enabled && isFetching };
}
