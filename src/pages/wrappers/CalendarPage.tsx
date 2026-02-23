/**
 * CalendarPage — config-driven calendar / event view (#45).
 *
 * Features:
 * - Renders event records on an antd Calendar with per-day badges
 * - Clicking an **event badge** → navigates to `onEventClickNavigateTo`
 * - Clicking an **empty date** → navigates to `onCreateNavigateTo` with `?date=YYYY-MM-DD`
 * - `onDateClickNavigateTo` overrides everything — navigates for any date regardless of events
 * - Modal shows all events when a date with events is clicked (and no override URL is set)
 * - Supports status-based badge colours via `statusMap`
 */

import React, { useMemo, useState } from 'react';
import { Calendar, Badge, Card, Spin, Alert, Modal, List, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { PageHeader, IPageHeader } from '../PostAuth/PageHeader/PageHeader';
import { useEntityList } from '../../core/query/useEntityList';
import type { IApiConfig } from '../../core/context/ApiContext';
import { useCoreNavigator } from '../../routes/Navigation';
import { substituteUrlParams } from '../../core/utils';

// ─── Config Types ─────────────────────────────────────────────────────────────

export interface ICalendarPageConfig {
  entityName?: string;
  apiConfig: IApiConfig;
  /** Field on the record that contains the event date (ISO string or YYYY-MM-DD) */
  dateField: string;
  /** Field used as the event badge title on the calendar cell */
  titleField: string;
  /** Field used as the event unique identifier */
  idField?: string;
  /** Optional field for event type/status — drives badge colour via statusMap */
  statusField?: string;
  /** Maps status field values → antd Badge statuses */
  statusMap?: Record<string, 'success' | 'warning' | 'error' | 'default' | 'processing'>;
  /**
   * Navigate here when an event badge is clicked.
   * Supports `:id` / `:idField` placeholders.
   */
  onEventClickNavigateTo?: string;
  /**
   * Navigate here when an **empty** date cell is clicked (for creating a new event).
   * The selected date is appended as `?date=YYYY-MM-DD` so the create form can pre-fill it.
   * Takes priority over the event list modal for dates with events when BOTH are configured.
   */
  onCreateNavigateTo?: string;
  /**
   * Navigate here when **any** date cell is clicked, regardless of whether it has events.
   * Overrides both `onCreateNavigateTo` (empty date) and the event list modal.
   * Supports `:date` (YYYY-MM-DD) placeholder.
   */
  onDateClickNavigateTo?: string;
  defaultMode?: 'month' | 'year';
}

interface CalendarPageProps
  extends ICalendarPageConfig,
    Pick<IPageHeader, 'pageHeaderActions' | 'pageTitle' | 'breadcrumbs'> {
  routeParams?: Record<string, string | number | undefined>;
  cardStyle?: React.CSSProperties;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractObjectPayload(
  payload: IApiConfig['payload']
): Record<string, unknown> {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    !(payload instanceof FormData)
  ) {
    return payload;
  }
  return {};
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CalendarPage: React.FC<CalendarPageProps> = ({
  entityName,
  apiConfig,
  dateField,
  titleField,
  statusField,
  statusMap = {},
  onDateClickNavigateTo,
  onEventClickNavigateTo,
  onCreateNavigateTo,
  idField = 'id',
  defaultMode = 'month',
  pageHeaderActions,
  pageTitle,
  breadcrumbs,
  routeParams = {},
  cardStyle,
}) => {
  const navigate = useCoreNavigator();

  const [ calendarMode, setCalendarMode ] = useState<'month' | 'year'>(defaultMode);
  const [ calendarValue, setCalendarValue ] = useState<Dayjs>(dayjs());

  const [modalState, setModalState] = useState<{
    dateKey: string;
    events: Record<string, unknown>[];
  } | null>(null);

  const resolvedUrl = useMemo(
    () => substituteUrlParams(apiConfig.apiUrl, routeParams),
    [apiConfig.apiUrl, routeParams]
  );

  const { data, isLoading, error } = useEntityList({
    entityName: entityName ?? 'calendar',
    apiConfig,
    apiUrl: resolvedUrl,
    payload: extractObjectPayload(apiConfig.payload),
  });

  const records = useMemo(
    () => (Array.isArray(data) ? (data as Record<string, unknown>[]) : []),
    [data]
  );

  // Build YYYY-MM-DD → records map
  const eventsByDate = useMemo(() => {
    const m = new Map<string, Record<string, unknown>[]>();
    for (const rec of records) {
      const dateRaw = rec[dateField];
      if (!dateRaw) continue;
      const dateKey = dayjs(String(dateRaw)).format('YYYY-MM-DD');
      if (!m.has(dateKey)) m.set(dateKey, []);
      m.get(dateKey)!.push(rec);
    }
    return m;
  }, [records, dateField]);

  // Render event badges inside a calendar cell
  const cellRender = (value: Dayjs) => {
    const dateKey = value.format('YYYY-MM-DD');
    const events = eventsByDate.get(dateKey) ?? [];
    if (events.length === 0) return null;

    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {events.slice(0, 3).map((ev, i) => {
          const statusValue = statusField
            ? (statusMap[String(ev[statusField] ?? '')] ?? 'default')
            : 'default';
          return (
            <li
              key={i}
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 11,
                cursor: onEventClickNavigateTo ? 'pointer' : 'default',
              }}
              onClick={(e) => {
                // Event badge click → navigate to event detail
                if (onEventClickNavigateTo) {
                  e.stopPropagation();
                  const id = String(ev[idField] ?? '');
                  navigate(
                    onEventClickNavigateTo
                      .replace(':id', id)
                      .replace(`:${idField}`, id)
                  );
                }
              }}
            >
              <Badge status={statusValue} text={String(ev[titleField] ?? '(no title)')} />
            </li>
          );
        })}
        {events.length > 3 && (
          <li style={{ fontSize: 11, color: '#999' }}>+{events.length - 3} more</li>
        )}
      </ul>
    );
  };

  // Handle clicking a date cell.
  // The antd v5 Calendar onSelect fires for month/year panel navigation too
  // (source: 'month' | 'year'). We guard against those here.
  const handleDateSelect = (date: Dayjs, info?: { source?: string }) => {
    // Only react to actual date-cell clicks, not header panel navigation
    if (info?.source !== 'date') return;

    const dateKey = date.format('YYYY-MM-DD');

    // Priority 1: explicit date click override navigates for any date
    if (onDateClickNavigateTo) {
      navigate(onDateClickNavigateTo.replace(':date', dateKey));
      return;
    }

    const events = eventsByDate.get(dateKey) ?? [];

    if (events.length > 0) {
      // Date has events → show modal listing them (user can create from modal footer)
      setModalState({ dateKey, events });
    } else if (onCreateNavigateTo) {
      // Empty date → navigate to create URL with the date pre-filled
      navigate(`${onCreateNavigateTo}?date=${encodeURIComponent(dateKey)}`);
    }
  };

  const modalTitle =
    modalState != null
      ? dayjs(modalState.dateKey).format('MMMM D, YYYY')
      : '';

  return (
    <>
      <PageHeader
        pageHeaderActions={pageHeaderActions}
        pageTitle={pageTitle}
        breadcrumbs={breadcrumbs}
        routeParams={routeParams}
      />

      {isLoading && <Spin style={{ marginTop: 24, display: 'block' }} />}
      {!isLoading && error && (
        <Alert type="error" message="Failed to load calendar events" style={{ margin: 16 }} />
      )}
      {!isLoading && !error && (
        <Card style={{ marginTop: 16, ...cardStyle }}>
          <Calendar
            mode={calendarMode}
            value={calendarValue}
            cellRender={cellRender}
            onSelect={handleDateSelect}
            onPanelChange={(value, newMode) => {
              setCalendarValue(value);
              setCalendarMode(newMode);
            }}
          />
        </Card>
      )}

      {/* Day events modal */}
      <Modal
        title={modalTitle}
        open={modalState != null}
        onCancel={() => setModalState(null)}
        footer={
          onCreateNavigateTo
            ? [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    const dateKey = modalState?.dateKey ?? dayjs().format('YYYY-MM-DD');
                    navigate(`${onCreateNavigateTo}?date=${encodeURIComponent(dateKey)}`);
                    setModalState(null);
                  }}
                >
                  Create event
                </Button>,
              ]
            : null
        }
      >
        <List
          dataSource={modalState?.events ?? []}
          renderItem={(ev) => (
            <List.Item
              onClick={() => {
                if (onEventClickNavigateTo) {
                  const id = String(ev[idField] ?? '');
                  navigate(
                    onEventClickNavigateTo
                      .replace(':id', id)
                      .replace(`:${idField}`, id)
                  );
                  setModalState(null);
                }
              }}
              style={{ cursor: onEventClickNavigateTo ? 'pointer' : 'default' }}
            >
              <List.Item.Meta
                title={String(ev[titleField] ?? '(no title)')}
                description={
                  statusField != null ? String(ev[statusField] ?? '') : undefined
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
};
