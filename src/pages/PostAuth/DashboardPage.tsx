import React from 'react';
import { WidgetRenderer } from '../../dashboard/WidgetRenderer';
import { IStatWidgetProps } from '../../dashboard/widgets/StatWidget';
import { IChartWidgetProps } from '../../dashboard/widgets/ChartWidget';
import { IListWidgetProps } from '../../dashboard/widgets/ListWidget';
import { IDescriptionWidgetProps } from '../../dashboard/widgets/DescriptionWidget';
import { TimePeriodSelector, TimePeriod } from '../../dashboard/widgets/TimePeriodSelector';
import dayjs from 'dayjs';
import { useUi24Config } from '../../core/context';
import { IDetailsConfig } from '../../detail/Details';
import { IForm } from '../../core/forms/formConfig';
import { IModalConfig } from '../../modal/Modal';

export type DefaultTimePeriod = {
  period: TimePeriod;
  range?: [ string, string ]; // ISO strings
};

export type IDashboardWidgetConfig = {
  colSpan?: number;
  maxWidth?: number | string;
  width?: number | string;
} & (
    | {
      type: 'stat';
      title?: string;
      dataConfig?: IStatWidgetProps[ 'dataConfig' ];
      options?: IStatWidgetProps[ 'options' ];
      showTimePeriodSelector?: boolean;
      defaultTimePeriod?: DefaultTimePeriod;
      timezone?: string;
    }
    | {
      type: 'chart';
      title?: string;
      dataConfig?: IChartWidgetProps[ 'dataConfig' ];
      options?: IChartWidgetProps[ 'options' ];
      showTimePeriodSelector?: boolean;
      defaultTimePeriod?: DefaultTimePeriod;
      timezone?: string;
    }
    | {
      type: 'list';
      title?: string;
      options?: Partial<IListWidgetProps>;
    }
    | {
      type: 'actions';
      title?: string;
      options?: {
        actions: Array<{ label: string; url: string }>;
      };
    }
    | {
      type: 'detail';
      title?: string;
      options?: IDetailsConfig & {
        layout?: 'horizontal' | 'vertical';
        maxFields?: number;
      };
    }
    | {
      type: 'form';
      title?: string;
      options?: IForm & {
        compact?: boolean;
        submitButtonText?: string;
      };
    }
    | {
      type: 'modal';
      title?: string;
      options?: {
        triggers: Array<{
          label: string;
          icon?: string;
          modalConfig: IModalConfig;
          buttonType?: 'primary' | 'default' | 'dashed' | 'text';
          color?: string;
        }>;
        layout?: 'grid' | 'list';
      };
    }
    | {
      type: 'progress';
      title?: string;
      options?: {
        progressType: 'circle' | 'line' | 'dashboard';
        value: number;
        total?: number;
        status?: 'normal' | 'exception' | 'active' | 'success';
        showPercent?: boolean;
        strokeColor?: string;
        label?: string;
        description?: string;
      };
    }
    | {
      type: 'control';
      title?: string;
      options?: {
        controls: Array<{
          label: string;
          type: 'toggle' | 'button' | 'select' | 'slider';
          value?: any;
          options?: Array<{ label: string; value: any }>;
          onChange?: (value: any) => void;
          disabled?: boolean;
        }>;
        layout?: 'vertical' | 'horizontal';
      };
    }
    | {
      type: 'timeline';
      title?: string;
      options?: {
        events: Array<{
          timestamp: string;
          title: string;
          description?: string;
          type?: 'info' | 'success' | 'warning' | 'error';
          color?: string;
        }>;
        mode?: 'left' | 'alternate' | 'right';
        reverse?: boolean;
        maxEvents?: number;
      };
    }
    | {
      type: 'description';
      title?: string;
      dataConfig?: IDescriptionWidgetProps['dataConfig'];
      options?: IDescriptionWidgetProps['options'];
    }
);

export interface IDashboardPageConfig {
  widgets: IDashboardWidgetConfig[];
  showTimePeriodSelector?: boolean;
  defaultTimePeriod?: DefaultTimePeriod;
  timezone?: string;
}

const COLUMN_COUNT = 4;

function getInitialTimePeriod(defaultTimePeriod?: DefaultTimePeriod, timezone?: string) {
  const dayjsTz = (d?: string | number | Date) => timezone ? dayjs(d).tz(timezone) : dayjs(d);
  if (defaultTimePeriod) {
    if (defaultTimePeriod.period === 'custom' && defaultTimePeriod.range) {
      return {
        period: 'custom' as TimePeriod,
        range: [ dayjsTz(defaultTimePeriod.range[ 0 ]), dayjsTz(defaultTimePeriod.range[ 1 ]) ] as [ dayjs.Dayjs, dayjs.Dayjs ],
      };
    }
    // Use period to compute range
    const now = dayjsTz();
    let range: [ dayjs.Dayjs, dayjs.Dayjs ];
    switch (defaultTimePeriod.period) {
      case 'today':
        range = [ now.startOf('day'), now.endOf('day') ];
        break;
      case 'week':
        range = [ now.startOf('week'), now.endOf('week') ];
        break;
      case 'month':
        range = [ now.startOf('month'), now.endOf('month') ];
        break;
      case 'year':
        range = [ now.startOf('year'), now.endOf('year') ];
        break;
      default:
        range = [ now.startOf('month'), now.endOf('month') ];
    }
    return { period: defaultTimePeriod.period, range };
  }
  // Default fallback
  const now = dayjsTz();
  return {
    period: 'month' as TimePeriod,
    range: [ now.startOf('month'), now.endOf('month') ] as [ dayjs.Dayjs, dayjs.Dayjs ],
  };
}

export const DashboardPage: React.FC<{ dashboardConfig: IDashboardPageConfig }> = ({ dashboardConfig }) => {
  const { selectConfig } = useUi24Config();
  const formatConfigTz = selectConfig(config => {
    return config.formatConfig?.timezone;
  });
  const resolvedDashboardTz = dashboardConfig?.timezone || formatConfigTz;

  const [ dashboardTimePeriod, setDashboardTimePeriod ] = React.useState(() => getInitialTimePeriod(dashboardConfig?.defaultTimePeriod, resolvedDashboardTz));
  // Per-widget time period state (keyed by widget index)
  const [ widgetTimePeriods, setWidgetTimePeriods ] = React.useState<Record<number, { period: TimePeriod; range: [ dayjs.Dayjs, dayjs.Dayjs ] }>>(() => {
    const initial: Record<number, { period: TimePeriod; range: [ dayjs.Dayjs, dayjs.Dayjs ] }> = {};
    dashboardConfig?.widgets?.forEach((widget, idx) => {
      if (widget.type === 'chart' && widget.showTimePeriodSelector && widget.defaultTimePeriod) {
        const widgetTz = widget.timezone || dashboardConfig?.timezone || formatConfigTz;
        initial[ idx ] = getInitialTimePeriod(widget.defaultTimePeriod, widgetTz);
      }
    });
    return initial;
  });

  if (!dashboardConfig || !dashboardConfig.widgets) {
    return <div> </div>;
  }

  return (
    <>
      {dashboardConfig?.showTimePeriodSelector && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <TimePeriodSelector value={dashboardTimePeriod} onChange={setDashboardTimePeriod} timezone={resolvedDashboardTz} />
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLUMN_COUNT}, 1fr)`,
          gap: 20,
          alignItems: 'stretch',
        }}
      >
        {dashboardConfig?.widgets?.map((widget, idx) => {
          // Per-widget time period state
          let widgetTimePeriod;
          let widgetTz;
          if ((widget.type === 'chart' || widget.type === 'stat') && 'defaultTimePeriod' in widget) {
            widgetTz = widget.timezone || dashboardConfig?.timezone || formatConfigTz;
            widgetTimePeriod = widgetTimePeriods[ idx ] || getInitialTimePeriod(widget.defaultTimePeriod, widgetTz);
          } else {
            widgetTimePeriod = widgetTimePeriods[ idx ];
            widgetTz = dashboardConfig?.timezone || formatConfigTz;
          }
          const setWidgetTimePeriod = (val: { period: TimePeriod; range: [ dayjs.Dayjs, dayjs.Dayjs ] }) =>
            setWidgetTimePeriods(prev => ({ ...prev, [ idx ]: val }));

          let timePeriodSelectorProps = undefined;
          let chartDashboardTimePeriod = undefined;
          if (widget.type === 'chart') {
            if (widget.showTimePeriodSelector) {
              timePeriodSelectorProps = {
                value: widgetTimePeriod,
                onChange: setWidgetTimePeriod,
                timezone: widgetTz,
              };
            } else if (dashboardConfig?.showTimePeriodSelector) {
              chartDashboardTimePeriod = dashboardTimePeriod;
            }
          }

          return (
            <div
              key={idx}
              style={{
                gridColumn: `span ${widget.colSpan || 1}`,
                maxWidth: widget.maxWidth,
                minWidth: 320,
              }}
            >
              <WidgetRenderer
                widget={widget}
                timePeriodSelectorProps={timePeriodSelectorProps}
                dashboardTimePeriod={chartDashboardTimePeriod || dashboardTimePeriod}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}; 