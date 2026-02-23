/**
 * DragSortTable — wraps Ant Design Table with @dnd-kit drag-to-reorder rows (#62).
 *
 * Usage: wrap <AntTable> components + body rows with DndContext + SortableContext.
 * Provides a DragHandle component for the drag handle column.
 */

import React, { useCallback } from 'react';
import { MenuOutlined } from '@ant-design/icons';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Drag Handle column cell ──────────────────────────────────────────────────

interface DragHandleProps {
  id: string | number;
}

export const DragHandleCell: React.FC<DragHandleProps> = ({ id }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: String(id) });
  return (
    <span
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
        color: '#bbb',
        fontSize: 16,
        padding: '0 4px',
        touchAction: 'none',
      }}
    >
      <MenuOutlined />
    </span>
  );
};

// ── Sortable body row ────────────────────────────────────────────────────────

interface SortableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  'data-row-key': string;
}

export const SortableRow: React.FC<SortableRowProps> = (props) => {
  const id = props[ 'data-row-key' ];
  const { attributes, listeners: _listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <tr
      {...props}
      ref={setNodeRef}
      style={{
        ...props.style,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 999 : undefined,
        position: isDragging ? 'relative' : undefined,
      }}
    />
  );
};

// ── DragSortWrapper ──────────────────────────────────────────────────────────

interface DragSortWrapperProps {
  /** Stable IDs for all rows — must match each row's key */
  rowIds: string[];
  /** Called when user completes a drag. Provides new ordered ID array. */
  onOrderChange: (newIds: string[]) => void;
  /** When false, renders children without any DnD context (pass-through). Default: true */
  enabled?: boolean;
  children: React.ReactNode;
}

export const DragSortWrapper: React.FC<DragSortWrapperProps> = ({
  rowIds,
  onOrderChange,
  enabled = true,
  children,
}) => {
  // Hooks must be called unconditionally (Rules of Hooks).
  // When disabled, sensors and handler are still created but unused.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // Prevent accidental drags
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = rowIds.indexOf(String(active.id));
        const newIndex = rowIds.indexOf(String(over.id));
        if (oldIndex !== -1 && newIndex !== -1) {
          onOrderChange(arrayMove(rowIds, oldIndex, newIndex));
        }
      }
    },
    [ rowIds, onOrderChange ]
  );

  if (!enabled) return <>{children}</>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
};
