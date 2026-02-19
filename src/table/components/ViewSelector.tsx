import React, { useState } from 'react';
import { Dropdown, Button, Input, Space, Typography, Divider, Popconfirm } from 'antd';
import { AppstoreOutlined, SaveOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import type { SavedView, TableViewState } from '../hooks/useTableViews';
import type { MenuProps } from 'antd';

const { Text } = Typography;

interface ViewSelectorProps {
  views: SavedView[];
  activeViewId: string | null;
  onLoad: (viewId: string) => TableViewState | undefined;
  onSave: (name: string) => SavedView;
  onDelete: (viewId: string) => void;
  allowUserViews?: boolean;
}

export const ViewSelector: React.FC<ViewSelectorProps> = ({
  views,
  activeViewId,
  onLoad,
  onSave,
  onDelete,
  allowUserViews = true,
}) => {
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) return;
    onSave(name);
    setSaveName('');
    setShowSaveInput(false);
  };

  const menuItems: MenuProps['items'] = [
    ...(views.length > 0 ? views.map(view => ({
      key: view.id,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 180 }}>
          <span>
            {activeViewId === view.id && <CheckOutlined style={{ marginRight: 6, color: '#1677ff' }} />}
            {view.name}
            {view.isPreset && <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>(preset)</Text>}
          </span>
          {!view.isPreset && (
            <Popconfirm
              title="Delete this view?"
              onConfirm={(e) => { e?.stopPropagation(); onDelete(view.id); }}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
                style={{ padding: '0 4px' }}
              />
            </Popconfirm>
          )}
        </div>
      ),
      onClick: () => onLoad(view.id),
    })) : [{
      key: 'empty',
      label: <Text type="secondary">No saved views</Text>,
      disabled: true,
    }]),
    ...(allowUserViews ? [
      { key: 'divider', type: 'divider' as const },
      {
        key: 'save-current',
        label: showSaveInput ? (
          <Space onClick={(e) => e.stopPropagation()}>
            <Input
              size="small"
              placeholder="View name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onPressEnter={handleSave}
              autoFocus
              style={{ width: 140 }}
            />
            <Button size="small" type="primary" icon={<SaveOutlined />} onClick={handleSave} disabled={!saveName.trim()}>
              Save
            </Button>
          </Space>
        ) : (
          <span><SaveOutlined style={{ marginRight: 6 }} />Save Current View</span>
        ),
        onClick: () => { if (!showSaveInput) setShowSaveInput(true); },
      },
    ] : []),
  ];

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['click']}
      onOpenChange={(open) => { if (!open) setShowSaveInput(false); }}
    >
      <Button icon={<AppstoreOutlined />} size="small">
        Views{activeViewId ? ` (1)` : ''}
      </Button>
    </Dropdown>
  );
};
