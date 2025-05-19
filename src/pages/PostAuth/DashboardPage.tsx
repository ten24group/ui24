import React from 'react';
import { WidgetRenderer } from '../../dashboard/WidgetRenderer';
import { IStatWidgetProps } from '../../dashboard/widgets/StatWidget';
import { IChartWidgetProps } from '../../dashboard/widgets/ChartWidget';
import { IListWidgetProps } from '../../dashboard/widgets/ListWidget';
import { TimePeriodSelector, TimePeriod } from '../../dashboard/widgets/TimePeriodSelector';
import dayjs from 'dayjs';
import { useUi24Config } from '../../core/context';

export type DefaultTimePeriod = {
  period: TimePeriod;
  range?: [string, string]; // ISO strings
};

export type IDashboardWidgetConfig =
  | ({
      type: 'stat';
      title?: string;
      dataConfig?: IStatWidgetProps['dataConfig'];
      options?: IStatWidgetProps['options'];
      colSpan?: number;
      maxWidth?: number | string;
      width?: number | string;
      showTimePeriodSelector?: boolean;
      defaultTimePeriod?: DefaultTimePeriod;
      timezone?: string;
    })
  | ({
      type: 'chart';
      title?: string;
      dataConfig?: IChartWidgetProps['dataConfig'];
      options?: IChartWidgetProps['options'];
      colSpan?: number;
      maxWidth?: number | string;
      width?: number | string;
      showTimePeriodSelector?: boolean;
      defaultTimePeriod?: DefaultTimePeriod;
      timezone?: string;
    })
  | ({
      type: 'list';
      title?: string;
      options?: Partial<IListWidgetProps>;
      colSpan?: number;
      maxWidth?: number | string;
      width?: number | string;
    });

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
        range: [dayjsTz(defaultTimePeriod.range[0]), dayjsTz(defaultTimePeriod.range[1])] as [dayjs.Dayjs, dayjs.Dayjs],
      };
    }
    // Use period to compute range
    const now = dayjsTz();
    let range: [dayjs.Dayjs, dayjs.Dayjs];
    switch (defaultTimePeriod.period) {
      case 'today':
        range = [now.startOf('day'), now.endOf('day')];
        break;
      case 'week':
        range = [now.startOf('week'), now.endOf('week')];
        break;
      case 'month':
        range = [now.startOf('month'), now.endOf('month')];
        break;
      case 'year':
        range = [now.startOf('year'), now.endOf('year')];
        break;
      default:
        range = [now.startOf('month'), now.endOf('month')];
    }
    return { period: defaultTimePeriod.period, range };
  }
  // Default fallback
  const now = dayjsTz();
  return {
    period: 'month' as TimePeriod,
    range: [now.startOf('month'), now.endOf('month')] as [dayjs.Dayjs, dayjs.Dayjs],
  };
}

export const DashboardPage: React.FC<{ dashboardConfig: IDashboardPageConfig }> = ({ dashboardConfig }) => {
  const { selectConfig } = useUi24Config();
  const formatConfigTz = selectConfig(config => {
    return config.formatConfig?.timezone;
  });
  const resolvedDashboardTz = dashboardConfig?.timezone || formatConfigTz;

  const [dashboardTimePeriod, setDashboardTimePeriod] = React.useState(() => getInitialTimePeriod(dashboardConfig?.defaultTimePeriod, resolvedDashboardTz));
  // Per-widget time period state (keyed by widget index)
  const [widgetTimePeriods, setWidgetTimePeriods] = React.useState<Record<number, { period: TimePeriod; range: [dayjs.Dayjs, dayjs.Dayjs] }>>(() => {
    const initial: Record<number, { period: TimePeriod; range: [dayjs.Dayjs, dayjs.Dayjs] }> = {};
    dashboardConfig?.widgets?.forEach((widget, idx) => {
      if (widget.type === 'chart' && widget.showTimePeriodSelector && widget.defaultTimePeriod) {
        const widgetTz = widget.timezone || dashboardConfig?.timezone || formatConfigTz;
        initial[idx] = getInitialTimePeriod(widget.defaultTimePeriod, widgetTz);
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
            widgetTimePeriod = widgetTimePeriods[idx] || getInitialTimePeriod(widget.defaultTimePeriod, widgetTz);
          } else {
            widgetTimePeriod = widgetTimePeriods[idx];
            widgetTz = dashboardConfig?.timezone || formatConfigTz;
          }
          const setWidgetTimePeriod = (val: { period: TimePeriod; range: [dayjs.Dayjs, dayjs.Dayjs] }) =>
            setWidgetTimePeriods(prev => ({ ...prev, [idx]: val }));

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