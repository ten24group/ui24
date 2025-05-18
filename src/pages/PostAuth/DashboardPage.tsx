import React from 'react';
import { WidgetRenderer } from '../../dashboard/WidgetRenderer';
import { IStatWidgetProps } from '../../dashboard/widgets/StatWidget';
import { IChartWidgetProps } from '../../dashboard/widgets/ChartWidget';

export type IDashboardWidgetConfig =
  | ({
      type: 'stat';
      title?: string;
      dataConfig?: IStatWidgetProps['dataConfig'];
      options?: IStatWidgetProps['options'];
      colSpan?: number;
      maxWidth?: number | string;
      width?: number | string;
    })
  | ({
      type: 'chart';
      title?: string;
      dataConfig?: IChartWidgetProps['dataConfig'];
      options?: IChartWidgetProps['options'];
      colSpan?: number;
      maxWidth?: number | string;
      width?: number | string;
    });

export interface IDashboardPageConfig {
  widgets: IDashboardWidgetConfig[];
}

const COLUMN_COUNT = 4;

export const DashboardPage: React.FC<{ dashboardConfig: IDashboardPageConfig }> = ({ dashboardConfig }) => {
  if (!dashboardConfig || !dashboardConfig.widgets) {
    return <div> </div>;
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLUMN_COUNT}, 1fr)`,
        gap: 20,
        alignItems: 'stretch',
      }}
    >
      {dashboardConfig.widgets.map((widget, idx) => (
        <div
          key={idx}
          style={{
            gridColumn: `span ${widget.colSpan || 1}`,
            maxWidth: widget.maxWidth,
            minWidth: 320,
          }}
        >
          <WidgetRenderer widget={widget} />
        </div>
      ))}
    </div>
  );
}; 