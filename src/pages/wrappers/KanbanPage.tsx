/**
 * KanbanPage — config-driven Kanban board view (#46).
 *
 * Features:
 * - Groups records by `groupField` into swimlane columns
 * - Drag-to-reorder within a column via a dedicated drag handle (not the whole card)
 * - Drag-to-move between columns — persists via `onMoveApiConfig`
 * - Per-card "⋯" action dropdown (`cardActions`) for Edit, Delete, custom API calls
 * - Per-column "Add" button that navigates to `onAddNavigateTo` with the column key pre-filled
 * - Card body click navigates to `onClickNavigateTo`
 */

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  Card,
  Spin,
  Alert,
  Tag,
  Empty,
  Typography,
  Button,
  Dropdown,
  Modal,
} from 'antd';
import type { MenuProps } from 'antd';
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
import {
  HolderOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { PageHeader, IPageHeader } from '../PostAuth/PageHeader/PageHeader';
import { useEntityList } from '../../core/query/useEntityList';
import { useApi } from '../../core/context/ApiContext';
import type { IApiConfig } from '../../core/context/ApiContext';
import { useCoreNavigator } from '../../routes/Navigation';
import { substituteUrlParams } from '../../core/utils';
import { useNewEvaluationContext } from '../../core/context/NewEvaluationContext';
import { conditionEvaluator } from '../../core/utils/ConditionEvaluator';
import type { Condition } from '../../core/types/evaluation';

// ─── Config Types ─────────────────────────────────────────────────────────────

export interface IKanbanCardAction {
  label: string;
  icon?: string;
  action: 'navigate' | 'api';
  /** URL for navigate actions — supports `:id` / `:idField` placeholders */
  url?: string;
  /** API config for api actions — URL supports `:id` / `:idField` placeholders */
  apiConfig?: IApiConfig;
  /** Confirmation prompt before executing the action */
  confirmMessage?: string;
  /** Condition evaluated per-card to show/hide this action */
  visibility?: Condition;
}

export interface IKanbanColumn {
  key: string;
  label: string;
  color?: string;
}

export interface IKanbanPageConfig {
  entityName?: string;
  apiConfig: IApiConfig;
  groupField: string;
  idField: string;
  titleField: string;
  descriptionField?: string;
  columns: IKanbanColumn[];
  /**
   * API called when a card is moved to a different column.
   * Payload: `{ id, [groupField]: newColumnKey }`. URL supports `:id` placeholder.
   */
  onMoveApiConfig?: IApiConfig;
  /** Navigate here on card body click. Supports `:id` / `:idField` placeholders. */
  onClickNavigateTo?: string;
  /** Per-card action buttons shown in a "⋯" dropdown */
  cardActions?: IKanbanCardAction[];
  /**
   * Navigate here when "Add card" button is clicked in a column.
   * The column key is appended as `?[groupField]=<colKey>`.
   */
  onAddNavigateTo?: string;
}

interface KanbanPageProps
  extends IKanbanPageConfig,
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

function substituteId(pattern: string, id: string, idField: string): string {
  return pattern.replace(':id', id).replace(`:${idField}`, id);
}

// ─── Draggable Kanban Card ─────────────────────────────────────────────────────

interface KanbanCardProps {
  record: Record<string, unknown>;
  titleField: string;
  descriptionField?: string;
  idField: string;
  cardActions?: IKanbanCardAction[];
  onClickNavigateTo?: string;
}

const KanbanCard: React.FC<KanbanCardProps> = ({
  record,
  titleField,
  descriptionField,
  idField,
  cardActions,
  onClickNavigateTo,
}) => {
  const navigate = useCoreNavigator();
  const { callApiMethod } = useApi();
  const evalCtx = useNewEvaluationContext();

  const id = String(record[idField] ?? '');

  // The drag is activated by the handle only — card body handles clicks normally.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  // Build visible action menu items (filtered by visibility condition)
  const visibleActions = useMemo(() => {
    if (!cardActions?.length) return [];
    return cardActions.filter((a) => {
      if (!a.visibility) return true;
      return conditionEvaluator.evaluateSync(a.visibility, { ...evalCtx, record }) !== false;
    });
  }, [cardActions, evalCtx, record]);

  const handleActionClick = useCallback(
    async (action: IKanbanCardAction) => {
      if (action.action === 'navigate' && action.url) {
        navigate(substituteId(action.url, id, idField));
        return;
      }
      if (action.action === 'api' && action.apiConfig) {
        const execute = async () => {
          const url = substituteId(action.apiConfig!.apiUrl, id, idField);
          await callApiMethod({ ...action.apiConfig!, apiUrl: url });
        };
        if (action.confirmMessage) {
          Modal.confirm({
            title: action.confirmMessage,
            onOk: execute,
          });
        } else {
          await execute();
        }
      }
    },
    [id, idField, navigate, callApiMethod]
  );

  const menuItems: MenuProps['items'] = visibleActions.map((a) => ({
    key: a.label,
    label: a.label,
    onClick: (info) => {
      info.domEvent.stopPropagation();
      handleActionClick(a);
    },
  }));

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
        padding: '6px 8px',
        marginBottom: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
      }}
    >
      {/* Drag handle — only this area activates the drag sensor */}
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

      {/* Card body — click navigates */}
      <div
        style={{ flex: 1, minWidth: 0, cursor: onClickNavigateTo ? 'pointer' : 'default' }}
        onClick={() => {
          if (onClickNavigateTo) {
            navigate(substituteId(onClickNavigateTo, id, idField));
          }
        }}
      >
        <Typography.Text strong ellipsis style={{ display: 'block', fontSize: 13 }}>
          {String(record[titleField] ?? id)}
        </Typography.Text>
        {descriptionField && record[descriptionField] != null && (
          <Typography.Text
            type="secondary"
            ellipsis
            style={{ fontSize: 12, display: 'block', marginTop: 2 }}
          >
            {String(record[descriptionField])}
          </Typography.Text>
        )}
      </div>

      {/* Per-card action menu */}
      {menuItems.length > 0 && (
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button
            type="text"
            size="small"
            icon={<MoreOutlined />}
            style={{ flexShrink: 0, padding: '0 2px', color: '#999' }}
            onClick={(e) => e.stopPropagation()}
          />
        </Dropdown>
      )}
    </div>
  );
};

// ─── DroppableColumn ─────────────────────────────────────────────────────────
// Makes each column body a droppable zone so empty columns can receive cards.

const DroppableColumn: React.FC<{ colKey: string; children: React.ReactNode }> = ({ colKey, children }) => {
  const { setNodeRef } = useDroppable({ id: colKey });
  return <div ref={setNodeRef} style={{ minHeight: 40 }}>{children}</div>;
};

// ─── KanbanPage Component ──────────────────────────────────────────────────────

export const KanbanPage: React.FC<KanbanPageProps> = ({
  entityName,
  apiConfig,
  groupField,
  idField,
  titleField,
  descriptionField,
  columns,
  onMoveApiConfig,
  onClickNavigateTo,
  cardActions,
  onAddNavigateTo,
  pageHeaderActions,
  pageTitle,
  breadcrumbs,
  routeParams = {},
  cardStyle: _cardStyle,
}) => {
  const navigate = useCoreNavigator();
  const { callApiMethod } = useApi();

  const resolvedUrl = useMemo(
    () => substituteUrlParams(apiConfig.apiUrl, routeParams),
    [apiConfig.apiUrl, routeParams]
  );

  const { data, isLoading, error } = useEntityList({
    entityName: entityName ?? 'kanban',
    apiConfig,
    apiUrl: resolvedUrl,
    payload: extractObjectPayload(apiConfig.payload),
  });

  const allRecords = useMemo(
    () => (Array.isArray(data) ? (data as Record<string, unknown>[]) : []),
    [data]
  );

  const [columnOrder, setColumnOrder] = useState<Record<string, string[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  // Track where the drag STARTED so handleDragEnd can know the original column
  // even after onDragOver has already moved the card to its new column in state.
  const dragStartColRef = useRef<string | null>(null);

  useEffect(() => {
    const initial: Record<string, string[]> = {};
    for (const col of columns) initial[col.key] = [];
    for (const rec of allRecords) {
      const col = String(rec[groupField] ?? '');
      if (Object.prototype.hasOwnProperty.call(initial, col)) {
        initial[col].push(String(rec[idField] ?? ''));
      }
    }
    setColumnOrder(initial);
  }, [allRecords, columns, groupField, idField]);

  const recordMap = useMemo(() => {
    const m = new Map<string, Record<string, unknown>>();
    for (const rec of allRecords) m.set(String(rec[idField] ?? ''), rec);
    return m;
  }, [allRecords, idField]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const draggedId = String(event.active.id);
      setActiveId(draggedId);
      // Capture the source column before any onDragOver moves happen
      for (const [col, ids] of Object.entries(columnOrder)) {
        if (ids.includes(draggedId)) {
          dragStartColRef.current = col;
          break;
        }
      }
    },
    [columnOrder]
  );

  // Move card to target column during drag for live visual feedback.
  // This is required for cross-column drops AND to make empty columns droppable.
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const draggedId = String(active.id);
      const overId = String(over.id);
      if (draggedId === overId) return;

      setColumnOrder((prev) => {
        // Find which column currently holds the dragged card
        let sourceCol: string | undefined;
        for (const [col, ids] of Object.entries(prev)) {
          if (ids.includes(draggedId)) { sourceCol = col; break; }
        }

        // `overId` can be either a card ID (dropping near a card) or a column key
        // (dropping on the empty droppable zone of a column)
        let targetCol: string | undefined;
        for (const [col, ids] of Object.entries(prev)) {
          if (ids.includes(overId) || overId === col) { targetCol = col; break; }
        }

        if (!sourceCol || !targetCol || sourceCol === targetCol) return prev;

        // Move card from source to end of target column
        const next = { ...prev };
        next[sourceCol] = next[sourceCol].filter((id) => id !== draggedId);
        next[targetCol] = [...(next[targetCol] ?? []), draggedId];
        return next;
      });
    },
    []
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      const draggedId = String(active.id);
      const originalCol = dragStartColRef.current;
      dragStartColRef.current = null;

      if (!over) {
        // Drag cancelled (dropped outside) — roll back to original column
        if (originalCol) {
          setColumnOrder((prev) => {
            let currentCol: string | undefined;
            for (const [col, ids] of Object.entries(prev)) {
              if (ids.includes(draggedId)) { currentCol = col; break; }
            }
            if (!currentCol || currentCol === originalCol) return prev;
            const next = { ...prev };
            next[currentCol] = next[currentCol].filter((id) => id !== draggedId);
            next[originalCol] = [...(next[originalCol] ?? []), draggedId];
            return next;
          });
        }
        return;
      }

      const overId = String(over.id);

      // Determine where the card ended up after onDragOver moves
      let finalCol: string | undefined;
      for (const [col, ids] of Object.entries(columnOrder)) {
        if (ids.includes(draggedId)) { finalCol = col; break; }
      }

      // Same-column reorder: onDragOver doesn't reorder within a column,
      // so we do the final index-based sort here.
      if (finalCol && finalCol === originalCol && draggedId !== overId) {
        setColumnOrder((prev) => {
          if (!finalCol) return prev;
          const items = [...(prev[finalCol] ?? [])];
          const fromIndex = items.indexOf(draggedId);
          const toIndex = items.indexOf(overId);
          if (fromIndex === -1 || toIndex === -1) return prev;
          items.splice(fromIndex, 1);
          items.splice(toIndex, 0, draggedId);
          return { ...prev, [finalCol]: items };
        });
        return;
      }

      // Cross-column move: already reflected in state by onDragOver — persist to API
      if (originalCol && finalCol && originalCol !== finalCol && onMoveApiConfig) {
        const url = substituteId(onMoveApiConfig.apiUrl, draggedId, idField);
        try {
          await callApiMethod({
            ...onMoveApiConfig,
            apiUrl: url,
            payload: { id: draggedId, [groupField]: finalCol },
          });
        } catch {
          // Roll back the optimistic UI move on failure
          setColumnOrder((prev) => {
            const next = { ...prev };
            if (finalCol) next[finalCol] = next[finalCol].filter((id) => id !== draggedId);
            next[originalCol] = [...(next[originalCol] ?? []), draggedId];
            return next;
          });
        }
      }
    },
    [columnOrder, onMoveApiConfig, callApiMethod, groupField, idField]
  );

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Spin />
      </div>
    );
  }

  if (error) {
    return <Alert type="error" message="Failed to load kanban data" style={{ margin: 16 }} />;
  }

  const activeRecord = activeId != null ? recordMap.get(activeId) : null;

  return (
    <>
      <PageHeader
        pageHeaderActions={pageHeaderActions}
        pageTitle={pageTitle}
        breadcrumbs={breadcrumbs}
        routeParams={routeParams}
      />

      <div style={{ overflowX: 'auto', padding: '16px 0' }}>
          <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', minWidth: 'max-content' }}>
            {columns.map((col) => {
              const colIds = columnOrder[col.key] ?? [];
              return (
                <div key={col.key} style={{ width: 272, flexShrink: 0 }}>
                  {/* Column header */}
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

                  {/* Column body */}
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
                    {/* DroppableColumn makes the column body a valid drop target
                        even when the SortableContext is empty (no cards yet). */}
                    <DroppableColumn colKey={col.key}>
                    <SortableContext items={colIds} strategy={verticalListSortingStrategy}>
                      {colIds.length === 0 && (
                        <Empty
                          description="No items"
                          imageStyle={{ height: 32 }}
                          style={{ padding: '12px 0' }}
                        />
                      )}
                      {colIds.map((id) => {
                        const rec = recordMap.get(id);
                        if (!rec) return null;
                        return (
                          <KanbanCard
                            key={id}
                            record={rec}
                            titleField={titleField}
                            descriptionField={descriptionField}
                            idField={idField}
                            cardActions={cardActions}
                            onClickNavigateTo={onClickNavigateTo}
                          />
                        );
                      })}
                    </SortableContext>
                    </DroppableColumn>

                    {/* "Add card" button at the bottom of each column */}
                    {onAddNavigateTo && (
                      <Button
                        type="dashed"
                        size="small"
                        icon={<PlusOutlined />}
                        block
                        style={{ marginTop: 8, color: '#888' }}
                        onClick={() => {
                          const url = `${onAddNavigateTo}?${encodeURIComponent(groupField)}=${encodeURIComponent(col.key)}`;
                          navigate(url);
                        }}
                      >
                        Add
                      </Button>
                    )}
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Drag overlay — renders a ghost of the dragged card while dragging */}
          <DragOverlay dropAnimation={null}>
            {activeRecord != null ? (
              <div
                style={{
                  background: '#fff',
                  borderRadius: 6,
                  border: '1px solid #d9d9d9',
                  padding: '6px 10px',
                  boxShadow: '0 4px 12px rgba(0,0,0,.15)',
                  width: 252,
                  opacity: 0.95,
                  display: 'flex',
                  gap: 6,
                  alignItems: 'flex-start',
                }}
              >
                <HolderOutlined style={{ color: '#ccc', fontSize: 14, paddingTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Typography.Text strong ellipsis style={{ display: 'block', fontSize: 13 }}>
                    {String(activeRecord[titleField] ?? activeId ?? '')}
                  </Typography.Text>
                  {descriptionField && activeRecord[descriptionField] != null && (
                    <Typography.Text
                      type="secondary"
                      ellipsis
                      style={{ fontSize: 12, display: 'block', marginTop: 2 }}
                    >
                      {String(activeRecord[descriptionField])}
                    </Typography.Text>
                  )}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </>
  );
};
