import React from "react";
import { Table as AntTable, Spin, Button, Dropdown, Checkbox, Tooltip } from "antd";
import { ReloadOutlined, SettingOutlined, FilterOutlined } from '@ant-design/icons';
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
    hasActiveSorts,
    visibleColumns,
    setVisibleColumns,
    getRecords
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

  const columnOptions = propertiesConfig.map(p => ({ label: p.name, value: p.dataIndex }));

  const columnsDropdownMenu = {
    items: [
      {
        label: (
          <div style={{ padding: '8px' }}>
            <Checkbox.Group
              options={columnOptions}
              value={visibleColumns}
              onChange={(values) => setVisibleColumns(values as string[])}
              style={{ display: 'flex', flexDirection: 'column' }}
            />
          </div>
        ),
        key: '1',
      },
    ],
  };

  return (
    <React.Fragment>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, marginRight: '16px' }}>
          {apiConfig.useSearch && <Search onSearch={onSearch} />}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Tooltip title="Refresh Data">
            <Button icon={<ReloadOutlined />} onClick={() => getRecords(1, "")} />
          </Tooltip>
          <Tooltip title="Columns">
            <Dropdown menu={columnsDropdownMenu} trigger={[ 'click' ]}>
              <Button icon={<SettingOutlined />} />
            </Dropdown>
          </Tooltip>
          <Tooltip title="Filters">
            <Button icon={<FilterOutlined />} onClick={() => setShowFilters(!showFilters)} />
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


