/**
 * useCalendarData — date-range-filtered data fetching for the Calendar layout.
 *
 * Fetches all events within the current view's date range (month or year).
 * Automatically refetches when the user navigates to a different month/year
 * because the date range changes → query key changes → TanStack Query refetches.
 *
 * Date format auto-detection:
 * Some entities store dates as zero-padded epoch timestamps (e.g., "00001769904000000")
 * instead of ISO strings. When the initial ISO-based filter returns no results but
 * the parent has data (hintHasData), the hook automatically retries with epoch-padded
 * format. The detected format is cached for the component's lifetime.
 *
 * MUST be called with `enabled: true` only when the layout is in independent
 * data mode (config has apiConfig). When `enabled` is false the hook is inert
 * — no network requests, no query keys registered.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { useEntityList } from '../../../query/useEntityList';
import type { IApiConfig } from '../../../context/ApiContext';
import { substituteUrlParams } from '../../../utils';

type DateStoreFormat = 'iso' | 'epoch-padded';

export interface UseCalendarDataOptions {
  apiConfig: IApiConfig;
  startDateField: string;
  currentDate: Dayjs;
  mode: 'month' | 'year';
  appliedFilters: Record<string, unknown>;
  routeParams: Record<string, string>;
  entityName: string;
  maxEvents?: number;
  enabled: boolean;
  /** Whether the parent table/data source has records (used for date format auto-detection) */
  hintHasData?: boolean;
}

export interface UseCalendarDataResult {
  records: Record<string, unknown>[];
  isLoading: boolean;
  isFetching: boolean;
}

const EMPTY: Record<string, unknown>[] = [];

/**
 * Detect zero-padded epoch timestamp: all digits, starts with '0'.
 * Matches the same heuristic used by useTableData for datetime formatting.
 */
export function isEpochPaddedDate(val: unknown): boolean {
  if (!val) return false;
  const str = String(val);
  return str.startsWith('0') && /^\d+$/.test(str);
}

/**
 * Normalize a raw date value to an ISO string.
 * Handles both ISO date strings and zero-padded epoch timestamps.
 */
export function normalizeRawDate(raw: unknown): string | null {
  if (!raw) return null;
  const str = String(raw);
  if (isEpochPaddedDate(str)) {
    const epoch = parseInt(str, 10);
    if (!isNaN(epoch) && epoch > 0) {
      return new Date(epoch).toISOString();
    }
  }
  return str;
}

function formatDateForFilter(date: Dayjs, format: DateStoreFormat): string {
  if (format === 'epoch-padded') {
    return date.valueOf().toString().padStart(20, '0');
  }
  return date.toISOString();
}

export function useCalendarData(options: UseCalendarDataOptions): UseCalendarDataResult {
  const {
    apiConfig,
    startDateField,
    currentDate,
    mode,
    appliedFilters,
    routeParams,
    entityName,
    maxEvents = 5000,
    enabled,
    hintHasData = false,
  } = options;

  const [ dateStoreFormat, setDateStoreFormat ] = useState<DateStoreFormat>('iso');
  const hasDetectedFormat = useRef(false);

  const resolvedUrl = useMemo(
    () => (enabled ? substituteUrlParams(apiConfig.apiUrl, routeParams) : ''),
    [ enabled, apiConfig.apiUrl, routeParams ]
  );

  const dateRange = useMemo(() => {
    const start = mode === 'year' ? currentDate.startOf('year') : currentDate.startOf('month');
    const end = mode === 'year' ? currentDate.endOf('year') : currentDate.endOf('month');
    return {
      gte: formatDateForFilter(start, dateStoreFormat),
      lte: formatDateForFilter(end, dateStoreFormat),
    };
  }, [ currentDate, mode, dateStoreFormat ]);

  const payload = useMemo(() => ({
    ...appliedFilters,
    [ `${startDateField}.gte` ]: dateRange.gte,
    [ `${startDateField}.lte` ]: dateRange.lte,
    count: maxEvents,
  }), [ appliedFilters, startDateField, dateRange, maxEvents ]);

  const { data, isLoading, isFetching } = useEntityList({
    entityName: `${entityName}-calendar`,
    apiConfig,
    apiUrl: resolvedUrl,
    payload,
    enabled,
  });

  const records = useMemo(
    () => (enabled && Array.isArray(data) ? data : EMPTY) as Record<string, unknown>[],
    [ enabled, data ]
  );

  // Auto-detect date storage format: if ISO filter returned empty but parent has data,
  // the date field likely uses epoch-padded storage. Switch format and TanStack Query
  // will refetch with the corrected filter.
  useEffect(() => {
    if (
      !hasDetectedFormat.current &&
      dateStoreFormat === 'iso' &&
      enabled &&
      !isLoading &&
      !isFetching &&
      Array.isArray(data) &&
      data.length === 0 &&
      hintHasData
    ) {
      hasDetectedFormat.current = true;
      setDateStoreFormat('epoch-padded');
    }

    // If we got data with the current format, mark as detected
    if (Array.isArray(data) && data.length > 0) {
      hasDetectedFormat.current = true;
    }
  }, [ dateStoreFormat, enabled, isLoading, isFetching, data, hintHasData ]);

  return { records, isLoading: enabled && isLoading, isFetching: enabled && isFetching };
}
