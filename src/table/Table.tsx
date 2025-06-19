import React from "react";
import { Table as AntTable, Spin, Button, Dropdown, Checkbox, Tooltip, Badge } from "antd";
import { ReloadOutlined, SyncOutlined, SettingOutlined, FilterOutlined, ColumnWidthOutlined, EyeOutlined, NodeExpandOutlined, ClearOutlined } from '@ant-design/icons';
import { useTable } from "./useTable";
import { ITableConfig } from "./type";
import { Search } from './Search/Search';
import { ColumnSettings } from './ColumnSettings/ColumnSettings';
import './Table.css';

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
    activeFiltersCount,
    clearAllFilters,
    DisplayAppliedSorts,
    clearAllSorts,
    hasActiveSorts,
    activeSortsCount,
    visibleColumns,
    setVisibleColumns,
    handleRefresh,
    handleReload,
    selectableColumns,
    searchQuery,
    columnSettings,
    handleColumnSettingsChange,
    resetColumnSettings,
  } = useTable({
    propertiesConfig,
    apiConfig,
    routeParams
  });

  const [ showFilters, setShowFilters ] = React.useState(false);

  const renderPagination = () => {
    if (typeof Pagination === 'function') {
      return React.createElement(Pagination);
    }
    return Pagination;
  };

  return (
    <React.Fragment>
      <div className="table-toolbar">
        <div style={{ flex: 1 }}>
          {apiConfig.useSearch && <Search onSearch={onSearch} value={searchQuery} />}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Tooltip title="Reset">
            <Button icon={<ClearOutlined />} onClick={handleRefresh} />
          </Tooltip>
          <Tooltip title="Refresh Data">
            <Button icon={<ReloadOutlined />} onClick={handleReload} />
          </Tooltip>
          <Tooltip title="Column Settings">
            <Dropdown
              overlay={<ColumnSettings columns={columnSettings} onColumnChange={handleColumnSettingsChange} onReset={resetColumnSettings} />}
              trigger={[ 'click' ]}
            >
              <Button icon={<ColumnWidthOutlined />} />
            </Dropdown>
          </Tooltip>
          <Tooltip title="View Applied Filters & Sorts">
            <Badge count={hasActiveFilters || hasActiveSorts ? (activeFiltersCount + activeSortsCount) : 0} color="blue">
              <Button icon={<NodeExpandOutlined />} onClick={() => setShowFilters(!showFilters)} />
            </Badge>
          </Tooltip>
        </div>
      </div>

      {showFilters && (
        <div style={{ marginBottom: '10px', padding: '10px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
          {(hasActiveFilters || hasActiveSorts) && (
            <div>
              {hasActiveFilters &&
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: hasActiveSorts ? '10px' : '0' }}>
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
          {(!hasActiveFilters && !hasActiveSorts) && (
            <div>
              active filters and sorts will be displayed here!
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


