import React from 'react';
import { WidgetRenderer } from '../../dashboard/WidgetRenderer';
import { IStatWidgetProps } from '../../dashboard/widgets/StatWidget';

export type IDashboardWidgetConfig =
  | {
      type: 'stat';
      title?: string;
      dataConfig?: IStatWidgetProps['dataConfig'];
      options?: IStatWidgetProps['options'];
    };

export interface IDashboardPageConfig {
  widgets: IDashboardWidgetConfig[];
}

export const DashboardPage: React.FC<{ dashboardConfig: IDashboardPageConfig }> = ({ dashboardConfig }) => {
  if (!dashboardConfig || !dashboardConfig.widgets) {
    return <div> </div>;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
      {dashboardConfig.widgets.map((widget, idx) => (
        <div key={idx} style={{ flex: '1 1 320px', minWidth: 320, maxWidth: 480 }}>
          <WidgetRenderer widget={widget} />
        </div>
      ))}
    </div>
  );
}; 