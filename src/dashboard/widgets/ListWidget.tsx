import React, { useMemo } from "react";
import { Table } from "../../table/Table";
import { ITableConfig } from "../../table/type";
import './ListWidget.css';

interface DashboardTimePeriod {
  period: string;
  range: [any, any];
}

export interface IListWidgetProps extends ITableConfig {
  title?: string;
  dashboardTimePeriod?: DashboardTimePeriod;
  dashboardCurrency?: string;
}

export const ListWidget: React.FC<IListWidgetProps & { routeParams?: Record<string, any> }> = ({ title, dashboardTimePeriod, dashboardCurrency, routeParams = {}, ...tableProps }) => {
  // Merge dashboard time period into routeParams for API URL substitution
  const effectiveRouteParams = useMemo(() => {
    const merged = { ...routeParams };

    if (dashboardTimePeriod?.range) {
      const [start, end] = dashboardTimePeriod.range;
      merged.startDate = start?.format?.('YYYY-MM-DDTHH:mm:ss') || start;
      merged.endDate = end?.format?.('YYYY-MM-DDTHH:mm:ss') || end;
      merged.period = dashboardTimePeriod.period;
    }

    if (dashboardCurrency) {
      merged.currency = dashboardCurrency;
    }

    return merged;
  }, [routeParams, dashboardTimePeriod, dashboardCurrency]);

  return (
    <div className="list-widget-card">
      {title && <div className="list-widget-header">{title}</div>}
      <div className="list-widget-content">
        <Table {...tableProps} routeParams={effectiveRouteParams} />
      </div>
    </div>
  );
}; 