import React from 'react';
import { StatWidget } from './widgets/StatWidget';
import { ChartWidget } from './widgets/ChartWidget';
import { ListWidget } from './widgets/ListWidget';
import { ActionWidget } from './widgets/ActionWidget';
import { IDashboardWidgetConfig } from '../pages/PostAuth/DashboardPage';
import { TimePeriodSelectorProps } from './widgets/TimePeriodSelector';

export const WidgetRenderer: React.FC<{
  widget: IDashboardWidgetConfig;
  timePeriodSelectorProps?: TimePeriodSelectorProps;
  dashboardTimePeriod?: { period: string; range: [ any, any ] };
}> = ({ widget, timePeriodSelectorProps, dashboardTimePeriod }) => {
  switch (widget.type) {
    case 'stat':
      return <StatWidget {...widget} dashboardTimePeriod={dashboardTimePeriod} />;
    case 'chart':
      return <ChartWidget {...widget} timePeriodSelectorProps={timePeriodSelectorProps} />;
    case 'list': {
      const { propertiesConfig = [], apiConfig = { apiUrl: '', apiMethod: 'GET' }, ...rest } = widget.options || {};
      return <ListWidget propertiesConfig={propertiesConfig} apiConfig={apiConfig} title={widget.title} {...rest} />;
    }
    case 'actions': {
      const { actions = [] } = widget.options || {};
      return <ActionWidget title={widget.title} actions={actions} />;
    }
    // Add more widget types here (table, etc.)
    default:
      return <div>Unknown widget type</div>;
  }
}; 