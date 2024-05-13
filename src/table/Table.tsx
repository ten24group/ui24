import React from "react";
import { Table as AntTable, Spin } from "antd";

import { useTable } from "./useTable";
import { ITableConfig } from "./type";

export const Table = ({
  propertiesConfig,
  records = [], //not using as of now
  apiConfig,
  paginationType = "default",
}: ITableConfig) => {
  
  const { columns, listRecords, isLoading, Pagination, DisplayAppliedFilters } = useTable({
    propertiesConfig,
    apiConfig
  });

  return (
    <React.Fragment>
      <DisplayAppliedFilters />
      <AntTable
        scroll={{ x: true }}
        columns={columns}
        dataSource={listRecords}
        pagination={false}
        loading={{
          indicator: (
            <div>
              <Spin />
            </div>
          ),
          spinning: isLoading,
        }}
      />
      { Pagination }
    </React.Fragment>
  );
};


