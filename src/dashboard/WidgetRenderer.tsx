import React from 'react';
import { StatWidget } from './widgets/StatWidget';
import { ChartWidget } from './widgets/ChartWidget';
import { ListWidget } from './widgets/ListWidget';
import { ActionWidget } from './widgets/ActionWidget';
import { DetailWidget } from './widgets/DetailWidget';
import { FormWidget } from './widgets/FormWidget';
import { ModalWidget } from './widgets/ModalWidget';
import { ProgressWidget } from './widgets/ProgressWidget';
import { ControlWidget } from './widgets/ControlWidget';
import { TimelineWidget } from './widgets/TimelineWidget';
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
    case 'detail': {
      if (!widget.options?.propertiesConfig) {
        return <div>Detail widget requires propertiesConfig</div>;
      }
      return <DetailWidget title={widget.title} {...widget.options} />;
    }
    case 'form': {
      if (!widget.options?.propertiesConfig) {
        return <div>Form widget requires propertiesConfig</div>;
      }
      return <FormWidget title={widget.title} {...widget.options} />;
    }
    case 'modal': {
      const { triggers = [], layout = 'grid' } = widget.options || {};
      return <ModalWidget title={widget.title} triggers={triggers} layout={layout} />;
    }
    case 'progress': {
      if (typeof widget.options?.value !== 'number' || !widget.options?.progressType) {
        return <div>Progress widget requires value and progressType</div>;
      }
      return <ProgressWidget title={widget.title} {...widget.options} />;
    }
    case 'control': {
      const { controls = [], layout = 'vertical' } = widget.options || {};
      return <ControlWidget title={widget.title} controls={controls} layout={layout} />;
    }
    case 'timeline': {
      const { events = [], mode = 'left', reverse = false, maxEvents = 10 } = widget.options || {};
      return <TimelineWidget title={widget.title} events={events} mode={mode} reverse={reverse} maxEvents={maxEvents} />;
    }
    default:
      return <div>Unknown widget type</div>;
  }
}; 