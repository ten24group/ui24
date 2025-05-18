import React from 'react';
import { StatWidget } from './widgets/StatWidget';
import { ChartWidget } from './widgets/ChartWidget';
import { IDashboardWidgetConfig } from '../pages/PostAuth/DashboardPage';

export const WidgetRenderer: React.FC<{ widget: IDashboardWidgetConfig }> = ({ widget }) => {
  switch (widget.type) {
    case 'stat':
      return <StatWidget {...widget} />;
    case 'chart':
      return <ChartWidget {...widget} />;
    // Add more widget types here (table, etc.)
    default:
      return <div>Unknown widget type</div>;
  }
}; 