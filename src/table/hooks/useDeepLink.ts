import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { ITableConfig } from '../type';

type DeepLinkConfig = NonNullable<ITableConfig[ 'deepLink' ]>;
type DeepLinkSlice = NonNullable<DeepLinkConfig[ 'include' ]>[ number ];

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
  // Capture the original pathname at mount time to avoid updating URL
  // during navigation transitions (when pathname has already changed to the target page)
  const ownPathname = useRef(location.pathname);

  useEffect(() => {
    if (!config?.enabled) return;

    // Skip the initial mount to avoid overwriting URL params on page load
    // (those params are read by getInitialFiltersFromUrl in useTable)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Don't update URL if we're navigating away (pathname changed from our page)
    if (location.pathname !== ownPathname.current) return;

    const params = new URLSearchParams(location.search);
    const prefix = config.prefix;

    // Clear all deep-link params first (to handle removed filters)
    const keysToRemove: string[] = [];
    params.forEach((_val, key) => {
      if (prefix && key.startsWith(`${prefix}.`)) {
        keysToRemove.push(key);
      } else if (!prefix && [ 'sort', 'page', 'q', 'segment' ].includes(key)) {
        keysToRemove.push(key);
      }
    });

    // Also remove filter params without prefix (handles both plain keys and operator-format keys)
    if (!prefix && state.filters) {
      const filterFields = Object.keys(state.filters);
      params.forEach((_val, key) => {
        const baseField = key.split('.')[ 0 ];
        if (filterFields.includes(baseField) && !keysToRemove.includes(key)) {
          keysToRemove.push(key);
        }
      });
    }

    keysToRemove.forEach(k => params.delete(k));

    // Serialize filters using operator-format keys that getInitialFiltersFromUrl can parse back.
    // Internal filter state is always operator format: { field: { eq: 'value' } }
    if (shouldInclude(config, 'filters') && state.filters) {
      Object.entries(state.filters).forEach(([ field, value ]) => {
        if (value === undefined || value === null || value === '') return;

        if (typeof value === 'object' && !Array.isArray(value)) {
          // Operator object: { eq: 'active' } → field.eq=active
          Object.entries(value as Record<string, unknown>).forEach(([ op, opVal ]) => {
            if (opVal === undefined || opVal === null || opVal === '') return;
            const serialized = Array.isArray(opVal) ? JSON.stringify(opVal) : String(opVal);
            params.set(prefixKey(`${field}.${op}`, prefix), serialized);
          });
        } else {
          // Plain value (shouldn't happen in normal flow, but handle gracefully)
          const serialized = Array.isArray(value) ? JSON.stringify(value) : String(value);
          params.set(prefixKey(field, prefix), serialized);
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
  }, [ config, state.filters, state.sort, state.page, state.search, state.segment, navigate, location.pathname ]);
}
