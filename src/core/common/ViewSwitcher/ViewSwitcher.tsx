import React from 'react';
import { Tooltip, Button, Space } from 'antd';
import {
  UnorderedListOutlined,
  AppstoreOutlined,
  ProjectOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import type { ViewType } from './types';

const VIEW_META: Record<ViewType, { icon: React.ReactNode; label: string }> = {
  'table': { icon: <UnorderedListOutlined />, label: 'Table' },
  'card-grid': { icon: <AppstoreOutlined />, label: 'Card Grid' },
  'kanban': { icon: <ProjectOutlined />, label: 'Kanban' },
  'calendar': { icon: <CalendarOutlined />, label: 'Calendar' },
  'map': { icon: <EnvironmentOutlined />, label: 'Map' },
  'tree': { icon: <ApartmentOutlined />, label: 'Tree' },
};

interface ViewSwitcherProps {
  available: ViewType[];
  active: ViewType;
  onChange: (view: ViewType) => void;
}

/**
 * Toolbar with icon buttons for each available view type.
 * Highlights the active view.
 */
export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ available, active, onChange }) => {
  if (available.length <= 1) return null;

  return (
    <Space.Compact>
      {available.map(view => {
        const meta = VIEW_META[ view ];
        if (!meta) return null;
        return (
          <Tooltip key={view} title={meta.label}>
            <Button
              icon={meta.icon}
              type={active === view ? 'primary' : 'default'}
              onClick={() => onChange(view)}
            />
          </Tooltip>
        );
      })}
    </Space.Compact>
  );
};
