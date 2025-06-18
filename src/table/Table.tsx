import React from "react";
import { Table as AntTable, Spin } from "antd";
import { useTable } from "./useTable";
import { ITableConfig } from "./type";
import { Search } from './Search/Search';

export const Table = ({
  propertiesConfig,
  records = [], //not using as of now
  apiConfig,
  paginationType = "default",
  routeParams,
}: ITableConfig) => {

  const { recordIdentifierKey, columns, listRecords, isLoading, Pagination, DisplayAppliedFilters, onSearch } = useTable({
    propertiesConfig,
    apiConfig,
    routeParams
  });

  return (
    <React.Fragment>
      {apiConfig.useSearch && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ width: '100%' }}>
            <Search onSearch={onSearch} />
          </div>
          <div style={{ marginTop: '10px' }}>
            <DisplayAppliedFilters />
          </div>
        </div>
      )}
      <AntTable
        scroll={{ x: true }}
        columns={columns}
        rowKey={recordIdentifierKey}
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
        {Pagination}
      </div>
    </React.Fragment>
  );
};


