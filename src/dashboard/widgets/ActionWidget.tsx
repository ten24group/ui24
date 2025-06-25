import React from 'react';
import { Link } from '../../core/common';
import { Icon } from '../../core/common';
import './ActionWidget.css';

export interface IActionConfig {
  label: string;
  url: string;
  icon?: string;
  description?: string;
  color?: string;
}

export interface IActionWidgetProps {
  title?: string;
  subtitle?: string;
  actions: IActionConfig[];
}

const getDefaultIcon = (label: string): string => {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes('search') || lowerLabel.includes('find')) return 'search';
  if (lowerLabel.includes('view') || lowerLabel.includes('detail')) return 'view';
  if (lowerLabel.includes('edit') || lowerLabel.includes('update')) return 'edit';
  if (lowerLabel.includes('delete') || lowerLabel.includes('remove')) return 'delete';
  if (lowerLabel.includes('add') || lowerLabel.includes('create') || lowerLabel.includes('new')) return 'plus';
  if (lowerLabel.includes('export')) return 'export';
  if (lowerLabel.includes('import')) return 'import';
  if (lowerLabel.includes('settings') || lowerLabel.includes('config')) return 'settings';
  if (lowerLabel.includes('list') || lowerLabel.includes('records')) return 'appStore';
  return 'appStore'; // default fallback
};

const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    const r = parseInt(result[ 1 ], 16);
    const g = parseInt(result[ 2 ], 16);
    const b = parseInt(result[ 3 ], 16);
    return `${r}, ${g}, ${b}`;
  }
  return '24, 144, 255'; // default blue
};

export const ActionWidget: React.FC<IActionWidgetProps> = ({ title, subtitle, actions }) => (
  <div className="action-widget-card">
    <div className="action-widget-header">
      {title && <div className="action-widget-title">{title}</div>}
      {subtitle && <div className="action-widget-subtitle">{subtitle}</div>}
    </div>
    <div className="action-widget-content">
      {actions.map((action, idx) => {
        const iconName = action.icon || getDefaultIcon(action.label);
        const accentColor = action.color || '#1890ff';
        const accentRgb = hexToRgb(accentColor);

        return (
          <div
            key={idx}
            className="action-widget-tile"
            style={{
              '--accent-color': accentColor,
              '--accent-rgb': accentRgb
            } as React.CSSProperties}
          >
            <Link url={action.url} className="action-widget-link">
              <div className="action-widget-tile-content">
                <div className="action-widget-icon">
                  <Icon iconName={iconName} />
                </div>
                <div className="action-widget-label">{action.label}</div>
                {action.description && (
                  <div className="action-widget-description">{action.description}</div>
                )}
                <div className="action-widget-arrow">→</div>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  </div>
); 