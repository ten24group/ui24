import React from 'react';
import { StatWidget } from './widgets/StatWidget';
import { IDashboardWidgetConfig } from '../pages/PostAuth/DashboardPage';

export const WidgetRenderer: React.FC<{ widget: IDashboardWidgetConfig }> = ({ widget }) => {
  switch (widget.type) {
    case 'stat':
      return <StatWidget {...widget} />;
    // Add more widget types here (chart, table, etc.)
    default:
      return <div>Unknown widget type: {widget.type}</div>;
  }
}; 