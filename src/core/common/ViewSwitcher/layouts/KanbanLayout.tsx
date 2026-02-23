/**
 * KanbanLayout — embedded kanban view for the unified ViewSwitcher (#119).
 *
 * Data strategy:
 * 1. If config has its own apiConfig → per-column independent fetching
 * 2. If parentApiConfig is provided → per-column independent fetching using parent's API
 * 3. If config has static data → use that
 * 4. Fallback to shared records from parent
 *
 * Independent mode: each column fetches its own data filtered by groupByField,
 * with count-based "Load More" pagination.
 *
 * Supports drag-and-drop between columns (with optional API persistence),
 * enriched card rendering (tags, avatars, status badges, date, actions),
 * and card click navigation.
 */

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Card, Tag, Empty, Typography, Button, Avatar, Badge, Spin, Divider } from 'antd';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HolderOutlined, LoadingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { KanbanViewConfig, KanbanCardConfig } from '../types';
import { useKanbanColumnData } from '../hooks/useKanbanData';
import type { IApiConfig } from '../../../context/ApiContext';

// ─── Props ──────────────────────────────────────────────────────────────────────

export interface KanbanLayoutProps {
  /** Shared records from parent (last resort fallback) */
  records?: Record<string, unknown>[];
  config: KanbanViewConfig;
  recordIdentifierKey: string;
  onRecordClick?: (record: Record<string, unknown>) => void;
  onMoveRecord?: (recordId: string, newColumnValue: string) => Promise<void>;
  /** Parent table's API config — used for independent fetching when config has no apiConfig */
  parentApiConfig?: IApiConfig;
  /** Parent table's applied filters — forwarded to independent column queries */
  appliedFilters?: Record<string, unknown>;
  /** Route params for URL substitution */
  routeParams?: Record<string, string>;
  /** Entity name for cache key scoping */
  entityName?: string;
}

// ─── Kanban Card ────────────────────────────────────────────────────────────────

const KanbanCard: React.FC<{
  record: Record<string, unknown>;
  cardConfig: KanbanCardConfig;
  idKey: string;
  allowDrag: boolean;
  onClick?: (record: Record<string, unknown>) => void;
}> = ({ record, cardConfig, idKey, allowDrag, onClick }) => {
  const id = String(record[ idKey ] ?? '');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        background: '#fff',
        borderRadius: 6,
        border: '1px solid #f0f0f0',
        padding: '8px 10px',
        marginBottom: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      {allowDrag && (
        <span
          {...attributes}
          {...listeners}
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
            color: '#ccc',
            fontSize: 14,
            padding: '2px 0',
            flexShrink: 0,
            touchAction: 'none',
          }}
        >
          <HolderOutlined />
        </span>
      )}

      {cardConfig.avatarField && record[ cardConfig.avatarField ] != null && (
        <Avatar
          src={String(record[ cardConfig.avatarField ])}
          size={32}
          style={{ flexShrink: 0, marginTop: 2 }}
        />
      )}

      <div
        style={{ flex: 1, minWidth: 0, cursor: onClick ? 'pointer' : 'default' }}
        onClick={() => onClick?.(record)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {cardConfig.statusField && cardConfig.statusMapping && (
            <Badge
              color={cardConfig.statusMapping[ String(record[ cardConfig.statusField ] ?? '') ]?.color ?? '#d9d9d9'}
              style={{ flexShrink: 0 }}
            />
          )}
          <Typography.Text strong ellipsis style={{ display: 'block', fontSize: 13, flex: 1 }}>
            {String(record[ cardConfig.titleField ] ?? id)}
          </Typography.Text>
        </div>

        {cardConfig.descriptionField && record[ cardConfig.descriptionField ] != null && (
          <Typography.Text
            type="secondary"
            ellipsis
            style={{ fontSize: 12, display: 'block', marginTop: 2 }}
          >
            {String(record[ cardConfig.descriptionField ])}
          </Typography.Text>
        )}

        {cardConfig.dateField && record[ cardConfig.dateField ] != null && (
          <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 3 }}>
            {dayjs(String(record[ cardConfig.dateField ])).format('MMM D, YYYY')}
          </Typography.Text>
        )}

        {(cardConfig.summaryFields ?? []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {cardConfig.summaryFields!.map((field) => {
              const val = record[ field ];
              if (val == null || val === '') return null;
              return <Tag key={field} style={{ fontSize: 11, margin: 0 }}>{String(val)}</Tag>;
            })}
          </div>
        )}

        {(cardConfig.tagFields ?? []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {cardConfig.tagFields!.map(({ field, colorMapping }) => {
              const val = record[ field ];
              if (val == null || val === '') return null;
              const color = colorMapping?.[ String(val) ];
              return <Tag key={field} color={color} style={{ fontSize: 11, margin: 0 }}>{String(val)}</Tag>;
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Droppable Column ───────────────────────────────────────────────────────────

const DroppableColumn: React.FC<{ colKey: string; children: React.ReactNode }> = ({ colKey, children }) => {
  const { setNodeRef } = useDroppable({ id: colKey });
  return <div ref={setNodeRef} style={{ minHeight: 40 }}>{children}</div>;
};

// ─── Independent Column (fetches its own data) ─────────────────────────────────

const IndependentColumn: React.FC<{
  colDef: { value: string; label: string; color?: string; wipLimit?: number };
  config: KanbanViewConfig;
  apiConfig: IApiConfig;
  idKey: string;
  appliedFilters: Record<string, unknown>;
  routeParams: Record<string, string>;
  entityName: string;
  onRecordClick?: (record: Record<string, unknown>) => void;
}> = ({ colDef, config, apiConfig, idKey, appliedFilters, routeParams, entityName, onRecordClick }) => {
  const { records, isLoading, isFetching, hasMore, loadMore, totalLoaded } = useKanbanColumnData({
    apiConfig,
    groupByField: config.groupByField,
    columnValue: colDef.value,
    pageSize: config.columnPageSize ?? 20,
    appliedFilters,
    routeParams,
    entityName,
    enabled: true,
  });

  const colIds = useMemo(() => records.map(r => String(r[ idKey ] ?? '')), [ records, idKey ]);

  return (
    <div style={{ width: 280, flexShrink: 0 }}>
      <div
        style={{
          background: colDef.color ?? '#f0f0f0',
          borderRadius: '6px 6px 0 0',
          padding: '8px 12px',
          fontWeight: 600,
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{colDef.label}</span>
        <Tag style={{ marginLeft: 8, fontSize: 11 }}>{totalLoaded}</Tag>
      </div>
      <Card
        size="small"
        style={{
          background: '#fafafa',
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          minHeight: 180,
        }}
        styles={{ body: { padding: 10 } }}
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin indicator={<LoadingOutlined />} />
          </div>
        ) : (
          <>
            <SortableContext items={colIds} strategy={verticalListSortingStrategy}>
              <DroppableColumn colKey={colDef.value}>
                {colIds.length === 0 && (
                  <Empty description="No items" styles={{ image: { height: 32 } }} style={{ padding: '12px 0' }} />
                )}
                {records.map((rec) => {
                  const recId = String(rec[ idKey ] ?? '');
                  return (
                    <KanbanCard
                      key={recId}
                      record={rec}
                      cardConfig={config.card}
                      idKey={idKey}
                      allowDrag={config.allowDrag !== false}
                      onClick={onRecordClick}
                    />
                  );
                })}
              </DroppableColumn>
            </SortableContext>
            {hasMore && (
              <Button
                type="text"
                size="small"
                loading={isFetching}
                onClick={loadMore}
                style={{ width: '100%', marginTop: 4, fontSize: 12, color: '#666' }}
              >
                Load More
              </Button>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

// ─── Main Layout ────────────────────────────────────────────────────────────────

export const KanbanLayout: React.FC<KanbanLayoutProps> = React.memo(({
  records: sharedRecords,
  config,
  recordIdentifierKey,
  onRecordClick,
  onMoveRecord,
  parentApiConfig,
  appliedFilters = {},
  routeParams = {},
  entityName = 'entity',
}) => {
  const { columns, groupByField } = config;
  const idKey = config.idField || recordIdentifierKey;

  const effectiveApiConfig: IApiConfig | null = config.apiConfig ?? parentApiConfig ?? null;
  const useIndependentData = effectiveApiConfig != null;

  const effectiveRecords = config.data ?? sharedRecords ?? [];

  // ── Shared-mode state (client-side column grouping) ──
  const [ columnOrder, setColumnOrder ] = useState<Record<string, string[]>>({});
  const [ activeId, setActiveId ] = useState<string | null>(null);
  const dragStartColRef = useRef<string | null>(null);

  useEffect(() => {
    if (useIndependentData) return;
    const initial: Record<string, string[]> = {};
    for (const col of columns) initial[ col.value ] = [];
    for (const rec of effectiveRecords) {
      const col = String(rec[ groupByField ] ?? '');
      if (Object.prototype.hasOwnProperty.call(initial, col)) {
        initial[ col ].push(String(rec[ idKey ] ?? ''));
      }
    }
    setColumnOrder(initial);
  }, [ effectiveRecords, columns, groupByField, idKey, useIndependentData ]);

  const recordMap = useMemo(() => {
    if (useIndependentData) return new Map<string, Record<string, unknown>>();
    const m = new Map<string, Record<string, unknown>>();
    for (const rec of effectiveRecords) m.set(String(rec[ idKey ] ?? ''), rec);
    return m;
  }, [ effectiveRecords, idKey, useIndependentData ]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const draggedId = String(event.active.id);
    setActiveId(draggedId);
    for (const [ col, ids ] of Object.entries(columnOrder)) {
      if (ids.includes(draggedId)) { dragStartColRef.current = col; break; }
    }
  }, [ columnOrder ]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const draggedId = String(active.id);
    const overId = String(over.id);
    if (draggedId === overId) return;

    setColumnOrder((prev) => {
      let sourceCol: string | undefined;
      for (const [ col, ids ] of Object.entries(prev)) {
        if (ids.includes(draggedId)) { sourceCol = col; break; }
      }
      let targetCol: string | undefined;
      for (const [ col, ids ] of Object.entries(prev)) {
        if (ids.includes(overId) || overId === col) { targetCol = col; break; }
      }
      if (!sourceCol || !targetCol || sourceCol === targetCol) return prev;
      const next = { ...prev };
      next[ sourceCol ] = next[ sourceCol ].filter((id) => id !== draggedId);
      next[ targetCol ] = [ ...(next[ targetCol ] ?? []), draggedId ];
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    const draggedId = String(active.id);
    const originalCol = dragStartColRef.current;
    dragStartColRef.current = null;

    if (!over) {
      if (originalCol) {
        setColumnOrder((prev) => {
          let currentCol: string | undefined;
          for (const [ col, ids ] of Object.entries(prev)) {
            if (ids.includes(draggedId)) { currentCol = col; break; }
          }
          if (!currentCol || currentCol === originalCol) return prev;
          const next = { ...prev };
          next[ currentCol ] = next[ currentCol ].filter((id) => id !== draggedId);
          next[ originalCol ] = [ ...(next[ originalCol ] ?? []), draggedId ];
          return next;
        });
      }
      return;
    }

    const overId = String(over.id);
    let finalCol: string | undefined;
    for (const [ col, ids ] of Object.entries(columnOrder)) {
      if (ids.includes(draggedId)) { finalCol = col; break; }
    }

    if (finalCol && finalCol === originalCol && draggedId !== overId) {
      setColumnOrder((prev) => {
        if (!finalCol) return prev;
        const items = [ ...(prev[ finalCol ] ?? []) ];
        const fromIndex = items.indexOf(draggedId);
        const toIndex = items.indexOf(overId);
        if (fromIndex === -1 || toIndex === -1) return prev;
        items.splice(fromIndex, 1);
        items.splice(toIndex, 0, draggedId);
        return { ...prev, [ finalCol ]: items };
      });
      return;
    }

    if (originalCol && finalCol && originalCol !== finalCol && onMoveRecord) {
      try {
        await onMoveRecord(draggedId, finalCol);
      } catch {
        setColumnOrder((prev) => {
          const next = { ...prev };
          if (finalCol) next[ finalCol ] = next[ finalCol ].filter((id) => id !== draggedId);
          next[ originalCol ] = [ ...(next[ originalCol ] ?? []), draggedId ];
          return next;
        });
      }
    }
  }, [ columnOrder, onMoveRecord ]);

  const activeRecord = activeId != null ? recordMap.get(activeId) : null;

  // ── Independent mode: render columns that each fetch their own data ──
  if (useIndependentData) {
    return (
      <div style={{ overflowX: 'auto', padding: '16px 0' }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', minWidth: 'max-content' }}>
            {columns.map((col) => (
              <IndependentColumn
                key={col.value}
                colDef={col}
                config={config}
                apiConfig={effectiveApiConfig!}
                idKey={idKey}
                appliedFilters={appliedFilters}
                routeParams={routeParams}
                entityName={entityName}
                onRecordClick={onRecordClick}
              />
            ))}
          </div>
        </DndContext>
      </div>
    );
  }

  // ── Shared mode: use parent's listRecords ──
  return (
    <div style={{ overflowX: 'auto', padding: '16px 0' }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', minWidth: 'max-content' }}>
          {columns.map((col) => {
            const colIds = columnOrder[ col.value ] ?? [];
            return (
              <div key={col.value} style={{ width: 280, flexShrink: 0 }}>
                <div
                  style={{
                    background: col.color ?? '#f0f0f0',
                    borderRadius: '6px 6px 0 0',
                    padding: '8px 12px',
                    fontWeight: 600,
                    fontSize: 13,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{col.label}</span>
                  <Tag style={{ marginLeft: 8, fontSize: 11 }}>{colIds.length}</Tag>
                </div>
                <Card
                  size="small"
                  style={{
                    background: '#fafafa',
                    borderTop: 'none',
                    borderRadius: '0 0 6px 6px',
                    minHeight: 180,
                  }}
                  styles={{ body: { padding: 10 } }}
                >
                  <DroppableColumn colKey={col.value}>
                    <SortableContext items={colIds} strategy={verticalListSortingStrategy}>
                      {colIds.length === 0 && (
                        <Empty description="No items" styles={{ image: { height: 32 } }} style={{ padding: '12px 0' }} />
                      )}
                      {colIds.map((id) => {
                        const rec = recordMap.get(id);
                        if (!rec) return null;
                        return (
                          <KanbanCard
                            key={id}
                            record={rec}
                            cardConfig={config.card}
                            idKey={idKey}
                            allowDrag={config.allowDrag !== false}
                            onClick={onRecordClick}
                          />
                        );
                      })}
                    </SortableContext>
                  </DroppableColumn>
                </Card>
              </div>
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeRecord != null ? (
            <div
              style={{
                background: '#fff',
                borderRadius: 6,
                border: '1px solid #d9d9d9',
                padding: '6px 10px',
                boxShadow: '0 4px 12px rgba(0,0,0,.15)',
                width: 260,
                opacity: 0.95,
              }}
            >
              <Typography.Text strong ellipsis style={{ display: 'block', fontSize: 13 }}>
                {String(activeRecord[ config.card.titleField ] ?? activeId ?? '')}
              </Typography.Text>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
});
