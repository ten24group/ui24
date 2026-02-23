/**
 * CalendarLayout — embedded calendar view for the unified ViewSwitcher (#119).
 *
 * Data strategy:
 * 1. If config has its own apiConfig → use that (independent fetching)
 * 2. If parentApiConfig is provided (from the parent Table) → use that (independent fetching)
 * 3. If config has static data → use that
 * 4. Fallback to shared records from parent
 *
 * Independent fetching uses date-range filters so only events in the visible
 * month/year are loaded. Navigating to a different month/year changes the
 * filter → TanStack Query refetches automatically.
 *
 * Date normalization:
 * Some backends store dates as zero-padded epoch timestamps (e.g., "00001769904000000")
 * instead of ISO strings. This component auto-detects the format via `normalizeRawDate`
 * and `useCalendarData`'s format detection, ensuring correct event grouping and filtering.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Calendar, Badge, Card, Modal, List, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { CalendarViewConfig } from '../types';
import { useCalendarData, normalizeRawDate } from '../hooks/useCalendarData';
import type { IApiConfig } from '../../../context/ApiContext';

type CalendarMode = 'month' | 'year';
type BadgeStatus = 'success' | 'warning' | 'error' | 'default' | 'processing';

export interface CalendarLayoutProps {
  /** Shared records from parent (last resort fallback) */
  records?: Record<string, unknown>[];
  config: CalendarViewConfig;
  recordIdentifierKey: string;
  onRecordClick?: (record: Record<string, unknown>) => void;
  /** Parent table's API config — used for independent fetching when config has no apiConfig */
  parentApiConfig?: IApiConfig;
  /** Parent table's applied filters — forwarded to independent query */
  appliedFilters?: Record<string, unknown>;
  /** Route params for URL substitution */
  routeParams?: Record<string, string>;
  /** Entity name for cache key scoping */
  entityName?: string;
}

export const CalendarLayout: React.FC<CalendarLayoutProps> = React.memo(({
  records: sharedRecords,
  config,
  recordIdentifierKey,
  onRecordClick,
  parentApiConfig,
  appliedFilters = {},
  routeParams = {},
  entityName = 'entity',
}) => {
  const { startDateField, titleField, colorField, colorMapping = {} } = config;
  const idKey = config.idField || recordIdentifierKey;
  const initialMode: CalendarMode = config.defaultMode === 'year' ? 'year' : 'month';

  const effectiveApiConfig: IApiConfig | null = config.apiConfig ?? parentApiConfig ?? null;
  const useIndependentData = effectiveApiConfig != null;

  const [ mode, setMode ] = useState<CalendarMode>(initialMode);
  const [ selectedDate, setSelectedDate ] = useState<Dayjs>(dayjs());

  const [ modalState, setModalState ] = useState<{
    dateKey: string;
    events: Record<string, unknown>[];
  } | null>(null);

  const hintHasData = (sharedRecords?.length ?? 0) > 0;

  const independentResult = useCalendarData({
    apiConfig: effectiveApiConfig ?? { apiUrl: '', apiMethod: 'GET' },
    startDateField,
    currentDate: selectedDate,
    mode,
    appliedFilters,
    routeParams,
    entityName,
    maxEvents: config.maxEvents,
    enabled: useIndependentData,
    hintHasData,
  });

  const effectiveRecords = useMemo(() => {
    if (useIndependentData) return independentResult.records;
    return config.data ?? sharedRecords ?? [];
  }, [ useIndependentData, independentResult.records, config.data, sharedRecords ]);

  const isLoading = useIndependentData && independentResult.isLoading;

  // ── Event grouping ──
  // Uses normalizeRawDate to handle both ISO strings and epoch-padded timestamps
  const eventsByDate = useMemo(() => {
    const m = new Map<string, Record<string, unknown>[]>();
    for (const rec of effectiveRecords) {
      const dateRaw = rec[ startDateField ];
      if (!dateRaw) continue;
      const normalized = normalizeRawDate(dateRaw);
      if (!normalized) continue;
      const dateKey = dayjs(normalized).format('YYYY-MM-DD');
      if (!m.has(dateKey)) m.set(dateKey, []);
      m.get(dateKey)!.push(rec);
    }
    return m;
  }, [ effectiveRecords, startDateField ]);

  const eventsByMonth = useMemo(() => {
    const m = new Map<string, Record<string, unknown>[]>();
    for (const rec of effectiveRecords) {
      const dateRaw = rec[ startDateField ];
      if (!dateRaw) continue;
      const normalized = normalizeRawDate(dateRaw);
      if (!normalized) continue;
      const monthKey = dayjs(normalized).format('YYYY-MM');
      if (!m.has(monthKey)) m.set(monthKey, []);
      m.get(monthKey)!.push(rec);
    }
    return m;
  }, [ effectiveRecords, startDateField ]);

  const resolveBadgeStatus = useCallback((record: Record<string, unknown>): BadgeStatus => {
    if (!colorField) return 'default';
    const val = String(record[ colorField ] ?? '');
    const mapped = colorMapping[ val ];
    if (mapped === 'success' || mapped === 'warning' || mapped === 'error' || mapped === 'processing' || mapped === 'default') {
      return mapped;
    }
    return 'default';
  }, [ colorField, colorMapping ]);

  const dateCellRender = useCallback((value: Dayjs) => {
    const dateKey = value.format('YYYY-MM-DD');
    const events = eventsByDate.get(dateKey) ?? [];
    if (events.length === 0) return null;

    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {events.slice(0, 3).map((ev, i) => (
          <li
            key={String(ev[ idKey ] ?? i)}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 11,
              cursor: onRecordClick ? 'pointer' : 'default',
            }}
            onClick={(e) => {
              if (onRecordClick) {
                e.stopPropagation();
                onRecordClick(ev);
              }
            }}
          >
            <Badge status={resolveBadgeStatus(ev)} text={String(ev[ titleField ] ?? '(no title)')} />
          </li>
        ))}
        {events.length > 3 && (
          <li style={{ fontSize: 11, color: '#999' }}>+{events.length - 3} more</li>
        )}
      </ul>
    );
  }, [ eventsByDate, idKey, titleField, onRecordClick, resolveBadgeStatus ]);

  const monthCellRender = useCallback((value: Dayjs) => {
    const monthKey = value.format('YYYY-MM');
    const events = eventsByMonth.get(monthKey) ?? [];
    if (events.length === 0) return null;

    const statusCounts = new Map<BadgeStatus, number>();
    for (const ev of events) {
      const status = resolveBadgeStatus(ev);
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    }

    return (
      <div>
        {Array.from(statusCounts.entries()).map(([ status, count ]) => (
          <div key={status} style={{ fontSize: 11 }}>
            <Badge status={status} text={`${count} event${count !== 1 ? 's' : ''}`} />
          </div>
        ))}
      </div>
    );
  }, [ eventsByMonth, resolveBadgeStatus ]);

  const cellRender: React.ComponentProps<typeof Calendar>[ 'cellRender' ] = useCallback(
    (current: Dayjs, info: { type: string }) => {
      if (info.type === 'date') return dateCellRender(current);
      if (info.type === 'month') return monthCellRender(current);
      return null;
    },
    [ dateCellRender, monthCellRender ]
  );

  const handlePanelChange = useCallback((value: Dayjs, newMode: CalendarMode) => {
    setSelectedDate(value);
    setMode(newMode);
  }, []);

  const handleDateSelect = useCallback((date: Dayjs, info?: { source?: string }) => {
    // Always sync selectedDate so that clicking an overflow date (prev/next month
    // in the grid) updates the date range filter and triggers a refetch.
    setSelectedDate(date);

    if (info?.source !== 'date') return;
    const dateKey = date.format('YYYY-MM-DD');
    const events = eventsByDate.get(dateKey) ?? [];
    if (events.length > 0) {
      setModalState({ dateKey, events });
    }
  }, [ eventsByDate ]);

  const modalTitle = modalState != null
    ? dayjs(modalState.dateKey).format('MMMM D, YYYY')
    : '';

  return (
    <>
      <Card style={{ marginTop: 8, position: 'relative' }}>
        {isLoading && (
          <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 1 }}>
            <Spin indicator={<LoadingOutlined />} size="small" />
          </div>
        )}
        <Calendar
          mode={mode}
          value={selectedDate}
          cellRender={cellRender}
          onSelect={handleDateSelect}
          onPanelChange={handlePanelChange}
        />
      </Card>

      <Modal
        title={modalTitle}
        open={modalState != null}
        onCancel={() => setModalState(null)}
        footer={null}
      >
        <List
          dataSource={modalState?.events ?? []}
          renderItem={(ev) => (
            <List.Item
              onClick={() => {
                if (onRecordClick) {
                  onRecordClick(ev);
                  setModalState(null);
                }
              }}
              style={{ cursor: onRecordClick ? 'pointer' : 'default' }}
            >
              <List.Item.Meta
                title={String(ev[ titleField ] ?? '(no title)')}
                description={
                  colorField != null ? String(ev[ colorField ] ?? '') : undefined
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
});
