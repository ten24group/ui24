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
}

export const ListWidget: React.FC<IListWidgetProps> = ({ title, dashboardTimePeriod, routeParams = {}, ...tableProps }) => {
  // Merge dashboard time period into routeParams for API URL substitution
  const effectiveRouteParams = useMemo(() => {
    if (!dashboardTimePeriod?.range) {
      return routeParams;
    }
    const [start, end] = dashboardTimePeriod.range;
    return {
      ...routeParams,
      startDate: start?.format?.('YYYY-MM-DDTHH:mm:ss') || start,
      endDate: end?.format?.('YYYY-MM-DDTHH:mm:ss') || end,
      period: dashboardTimePeriod.period,
    };
  }, [routeParams, dashboardTimePeriod]);

  return (
    <div className="list-widget-card">
      {title && <div className="list-widget-header">{title}</div>}
      <div className="list-widget-content">
        <Table {...tableProps} routeParams={effectiveRouteParams} />
      </div>
    </div>
  );
}; 