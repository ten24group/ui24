import React from 'react';
import { Button, Checkbox, Space, Tooltip, Divider } from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { HolderOutlined, VerticalAlignTopOutlined, VerticalAlignBottomOutlined, VerticalLeftOutlined, VerticalRightOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './ColumnSettings.css';

interface ColumnSetting {
  key: string;
  title: string;
  visible: boolean;
  fixed?: 'left' | 'right' | boolean | string;
  isIdentifier?: boolean;
}

interface ColumnSettingsProps {
  columns: ColumnSetting[];
  onColumnChange: (columns: ColumnSetting[]) => void;
  onReset: () => void;
}

interface SortableItemProps {
  id: string;
  col: ColumnSetting;
  handleVisibilityChange: (key: string, visible: boolean) => void;
  handlePinChange: (key: string, fixed: 'left' | 'right' | undefined) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ id, col, handleVisibilityChange, handlePinChange }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="column-settings-item">
      <Space>
        <HolderOutlined className="drag-handle" {...listeners} />
        <Checkbox
          checked={col.visible}
          onChange={(e) => handleVisibilityChange(col.key, e.target.checked)}
        >
          {col.title}
        </Checkbox>
      </Space>
      <Space>
        <Tooltip title="Pin to left">
          <Button
            size="small"
            type={col.fixed === 'left' ? "primary" : "text"}
            icon={<VerticalRightOutlined />}
            onClick={() => handlePinChange(col.key, col.fixed === 'left' ? undefined : 'left')}
          />
        </Tooltip>
        <Tooltip title="Pin to right">
          <Button
            size="small"
            type={col.fixed === 'right' ? "primary" : "text"}
            icon={<VerticalLeftOutlined />}
            onClick={() => handlePinChange(col.key, col.fixed === 'right' ? undefined : 'right')}
          />
        </Tooltip>
      </Space>
    </div>
  );
};

export const ColumnSettings: React.FC<ColumnSettingsProps> = ({ columns, onColumnChange, onReset }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const configurableColumns = columns.filter(c => !c.isIdentifier);

  const handleVisibilityChange = (key: string, visible: boolean) => {
    const newColumns = columns.map(c => c.key === key ? { ...c, visible } : c);
    onColumnChange(newColumns);
  };

  const handlePinChange = (key: string, fixed: 'left' | 'right' | undefined) => {
    const newColumns = columns.map(c => c.key === key ? { ...c, fixed } : c);
    onColumnChange(newColumns);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = configurableColumns.findIndex((c) => c.key === active.id);
      const newIndex = configurableColumns.findIndex((c) => c.key === over.id);
      const reorderedConfigurable = arrayMove(configurableColumns, oldIndex, newIndex);

      let configurableIndex = 0;
      const newFullList = columns.map(col => {
        if (!col.isIdentifier) {
          return reorderedConfigurable[ configurableIndex++ ];
        }
        return col;
      });
      onColumnChange(newFullList);
    }
  };

  const handleSelectAll = (e: CheckboxChangeEvent) => {
    const allVisible = e.target.checked;
    const newColumns = columns.map(c => ({ ...c, visible: allVisible }));
    onColumnChange(newColumns);
  }

  const allColumnsChecked = configurableColumns.every(c => c.visible);
  const someColumnsChecked = configurableColumns.some(c => c.visible) && !allColumnsChecked;


  return (
    <div className="column-settings-container">
      <div className="column-settings-header">
        <Checkbox
          checked={allColumnsChecked}
          indeterminate={someColumnsChecked}
          onChange={handleSelectAll}
        >
          All Columns
        </Checkbox>
        <Button type="link" onClick={onReset}>Reset</Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={configurableColumns.map(c => c.key)} strategy={verticalListSortingStrategy}>
          <div className="column-settings-body">
            {configurableColumns.map(col => (
              <SortableItem
                key={col.key}
                id={col.key}
                col={col}
                handleVisibilityChange={handleVisibilityChange}
                handlePinChange={handlePinChange}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}; 