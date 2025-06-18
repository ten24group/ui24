import React from "react";
import { Table as AntTable, Spin, Button } from "antd";
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

  const {
    recordIdentifierKey,
    columns,
    listRecords,
    isLoading,
    Pagination,
    DisplayAppliedFilters,
    onSearch,
    handleTableChange,
    hasActiveFilters,
    clearAllFilters,
    DisplayAppliedSorts,
    clearAllSorts,
    hasActiveSorts
  } = useTable({
    propertiesConfig,
    apiConfig,
    routeParams
  });

  const renderPagination = () => {
    if (typeof Pagination === 'function') {
      return React.createElement(Pagination);
    }
    return Pagination;
  };

  return (
    <React.Fragment>
      {apiConfig.useSearch && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ width: '100%' }}>
            <Search onSearch={onSearch} />
          </div>
          {(hasActiveFilters || hasActiveSorts) && (
            <div style={{ marginTop: '10px' }}>
              {hasActiveFilters &&
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <DisplayAppliedFilters />
                  <Button type="link" size="small" onClick={clearAllFilters} style={{ padding: 0, height: 'auto' }}>
                    Clear Filters
                  </Button>
                </div>
              }
              {hasActiveSorts &&
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <DisplayAppliedSorts />
                  <Button type="link" size="small" onClick={clearAllSorts} style={{ padding: 0, height: 'auto' }}>
                    Clear Sorts
                  </Button>
                </div>
              }
            </div>
          )}
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
        onChange={handleTableChange}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
        {renderPagination()}
      </div>
    </React.Fragment>
  );
};


