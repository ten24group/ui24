import React from "react";
import { Table } from "../../table/Table";
import { ITableConfig } from "../../table/type";
import './ListWidget.css';

export interface IListWidgetProps extends ITableConfig {
  title?: string;
}

export const ListWidget: React.FC<IListWidgetProps> = ({ title, ...tableProps }) => (
  <div className="list-widget-card">
    {title && <div className="list-widget-header">{title}</div>}
    <div className="list-widget-content">
      <Table {...tableProps} />
    </div>
  </div>
); 