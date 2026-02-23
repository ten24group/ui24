/**
 * useMapData — full-dataset fetching for the Map layout.
 *
 * Maps need all records with valid coordinates to render markers.
 * Fetches with a high count limit to get the full dataset.
 *
 * MUST be called with `enabled: true` only when the layout is in independent
 * data mode (config has apiConfig).
 */

import { useMemo } from 'react';
import { useEntityList } from '../../../query/useEntityList';
import type { IApiConfig } from '../../../context/ApiContext';
import { substituteUrlParams } from '../../../utils';

export interface UseMapDataOptions {
  apiConfig: IApiConfig;
  appliedFilters: Record<string, unknown>;
  routeParams: Record<string, string>;
  entityName: string;
  maxRecords?: number;
  enabled: boolean;
}

export interface UseMapDataResult {
  records: Record<string, unknown>[];
  isLoading: boolean;
  isFetching: boolean;
}

const EMPTY: Record<string, unknown>[] = [];

export function useMapData(options: UseMapDataOptions): UseMapDataResult {
  const { apiConfig, appliedFilters, routeParams, entityName, maxRecords = 5000, enabled } = options;

  const resolvedUrl = useMemo(
    () => (enabled ? substituteUrlParams(apiConfig.apiUrl, routeParams) : ''),
    [ enabled, apiConfig.apiUrl, routeParams ]
  );

  const payload = useMemo(() => ({
    ...appliedFilters,
    count: maxRecords,
  }), [ appliedFilters, maxRecords ]);

  const { data, isLoading, isFetching } = useEntityList({
    entityName: `${entityName}-map`,
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
