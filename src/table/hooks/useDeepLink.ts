import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { ITableConfig } from '../type';

type DeepLinkConfig = NonNullable<ITableConfig['deepLink']>;
type DeepLinkSlice = NonNullable<DeepLinkConfig['include']>[number];

interface DeepLinkState {
  filters?: Record<string, unknown>;
  sort?: Array<{ field: string; order: string }>;
  page?: number;
  search?: string;
  segment?: string;
}

function shouldInclude(config: DeepLinkConfig, slice: DeepLinkSlice): boolean {
  if (!config.include) return true;
  return config.include.includes(slice);
}

function prefixKey(key: string, prefix?: string): string {
  return prefix ? `${prefix}.${key}` : key;
}

/**
 * Serializes table state to URL search params (state -> URL).
 * Uses react-router navigate with replace to avoid polluting browser history.
 */
export function useDeepLink(
  config: DeepLinkConfig | undefined,
  state: DeepLinkState
): void {
  const navigate = useNavigate();
  const location = useLocation();
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (!config?.enabled) return;

    // Skip the initial mount to avoid overwriting URL params on page load
    // (those params are read by getInitialFiltersFromUrl in useTable)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const params = new URLSearchParams(location.search);
    const prefix = config.prefix;

    // Clear all deep-link params first (to handle removed filters)
    const keysToRemove: string[] = [];
    params.forEach((_val, key) => {
      if (prefix && key.startsWith(`${prefix}.`)) {
        keysToRemove.push(key);
      } else if (!prefix && ['sort', 'page', 'q', 'segment'].includes(key)) {
        keysToRemove.push(key);
      }
    });

    // Also remove filter params without prefix
    if (!prefix && state.filters) {
      Object.keys(state.filters).forEach(k => keysToRemove.push(k));
    }

    keysToRemove.forEach(k => params.delete(k));

    // Serialize filters
    if (shouldInclude(config, 'filters') && state.filters) {
      Object.entries(state.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(prefixKey(key, prefix), String(value));
        }
      });
    }

    // Serialize sort
    if (shouldInclude(config, 'sort') && state.sort && state.sort.length > 0) {
      const sortStr = state.sort
        .map(s => `${s.field}:${s.order === 'ascend' ? 'asc' : 'desc'}`)
        .join(',');
      params.set(prefixKey('sort', prefix), sortStr);
    }

    // Serialize page
    if (shouldInclude(config, 'page') && state.page && state.page > 1) {
      params.set(prefixKey('page', prefix), String(state.page));
    }

    // Serialize search
    if (shouldInclude(config, 'search') && state.search) {
      params.set(prefixKey('q', prefix), state.search);
    }

    // Serialize segment
    if (shouldInclude(config, 'segment') && state.segment) {
      params.set(prefixKey('segment', prefix), state.segment);
    }

    const newSearch = params.toString();
    const currentSearch = location.search.replace(/^\?/, '');

    if (newSearch !== currentSearch) {
      navigate(
        { pathname: location.pathname, search: newSearch ? `?${newSearch}` : '' },
        { replace: true }
      );
    }
  }, [config, state.filters, state.sort, state.page, state.search, state.segment, navigate, location.pathname]);
}
