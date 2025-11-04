import React, { useEffect, useMemo, useState } from "react";
import { Table as AntTable, Spin, Button, Dropdown, Tooltip, Badge, Space } from "antd";
import { ReloadOutlined, ColumnWidthOutlined, NodeExpandOutlined, ClearOutlined, SettingOutlined, SearchOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useTable } from "./useTable";
import { ITableConfig } from "./type";
import { Search } from './Search/Search';
import { ColumnSettings } from './ColumnSettings/ColumnSettings';
import { AppliedFiltersDisplay } from './AppliedFilters/AppliedFiltersDisplay';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '../core/common';
import { renderSingleAction } from '../core/utils/actionRenderer';
import { useEvaluationBatch } from '../core/hooks/useEvaluation';
import './Table.css';

export const Table = ({
  propertiesConfig,
  records = [], //not using as of now
  apiConfig,
  routeParams,
  defaultFilters,
  entityName,  // From backend config generation
  bulkActions,  // Actions shown when multiple rows selected
  rowSelection: rowSelectionConfig,  // Row selection configuration
  onDataChange,  // Callback to lift state to wrapper
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
    handleRefresh,
    handleReload,
    searchQuery,
    appliedFilters,  // NEW: Now exposed from useTable
    columnSettings,
    handleColumnSettingsChange,
    resetColumnSettings,
    isSearchMode,
    toggleSearchMode,
    canToggleSearchMode,
  } = useTable({
    propertiesConfig,
    apiConfig,
    routeParams,
    defaultFilters
  });

  const [ showFilters, setShowFilters ] = React.useState(false);
  
  // NEW: Track selected row keys
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Calculate selectedRecords only when selectedRowKeys change (not on data refetch)
  const selectedRecords = useMemo(() => 
    listRecords.filter(record => selectedRowKeys.includes(record[recordIdentifierKey])),
    [selectedRowKeys, listRecords, recordIdentifierKey]
  );
  
  // Lift table state to wrapper (if callback provided)
  useEffect(() => {
    if (!onDataChange) return;
    
    onDataChange({
      selectedRecords,
      selectedRowKeys,
      filters: appliedFilters,
      searchQuery,
      pageType: 'list',
      entityName
    });
  }, [selectedRecords, selectedRowKeys, appliedFilters, searchQuery, entityName, onDataChange]);

  // Extract visibility configs from bulk actions for batch evaluation
  const bulkActionsVisibilityConfigs = useMemo(() => 
    bulkActions ? bulkActions.map(action => action.visibility) : [],
    [bulkActions]
  );

  // Evaluate all bulk actions in batch
  const bulkActionsEvaluationResults = useEvaluationBatch(bulkActionsVisibilityConfigs, {
    selectedRecords,
    queryParams: routeParams,
  });

  // Merge evaluation results with actions and filter visible ones
  const visibleBulkActions = useMemo(() => {
    if (!bulkActions || bulkActions.length === 0) return [];
    
    return bulkActions
      .map((action, index) => ({
        ...action,
        _evaluated: bulkActionsEvaluationResults[index]
      }))
      .filter(action => action._evaluated?.visible !== false);
  }, [bulkActions, bulkActionsEvaluationResults]);

  // Row selection configuration for AntTable - using AntD's native row selection API
  const rowSelection = useMemo(() => {
    if (!rowSelectionConfig?.enabled) return undefined;
    
    return {
      type: 'checkbox' as const,
      selectedRowKeys,
      onChange: (selectedKeys: React.Key[], selectedRows: any[]) => {
        setSelectedRowKeys(selectedKeys);
      },
      getCheckboxProps: (record: any) => ({
        // Can add conditional disabling based on record properties if needed
        // disabled: record.someField === 'value',
      }),
    };
  }, [rowSelectionConfig, selectedRowKeys]);

  const renderPagination = () => {
    if (typeof Pagination === 'function') {
      return React.createElement(Pagination);
    }
    return Pagination;
  };

  return (
    <ErrorBoundary
      FallbackComponent={({
        error,
        resetErrorBoundary,
      }) => (
        <ErrorFallback
          error={new Error(`Error in table: ${error.message}`)}
          resetErrorBoundary={resetErrorBoundary}
        />
      )}
      onReset={() => {
        console.log("Table ErrorBoundary Reset");
        // Optionally, trigger a table data reload
        handleReload();
      }}
    >
      {/* Bulk Actions Toolbar (shown when rows are selected) */}
      {selectedRowKeys.length > 0 && visibleBulkActions.length > 0 && (
        <div style={{ 
          padding: '12px 16px', 
          background: '#e6f7ff', 
          borderRadius: '4px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontWeight: 500 }}>
            {selectedRowKeys.length} {selectedRowKeys.length === 1 ? 'item' : 'items'} selected
            <Button 
              type="link" 
              size="small"
              onClick={() => setSelectedRowKeys([])}
              style={{ marginLeft: '8px' }}
            >
              Clear selection
            </Button>
          </div>
          <Space>
            {visibleBulkActions.map((action, index) => {
              const rendered = renderSingleAction({
                action,
                key: `bulk-action-${index}`,
                isDropdownItem: false,
                isTableRowAction: false,
                isDisabled: action._evaluated?.enabled === false,
                disabledMessage: action._evaluated?.disabledMessage || '',
                routeParams,
                record: undefined,  // Bulk actions don't have a single record
                onSuccessCallback: handleReload,  // Refresh table after bulk action
              });
              return rendered as React.ReactNode;
            })}
          </Space>
        </div>
      )}

      <div className="table-toolbar">
        <div style={{ flex: 1 }}>
          {isSearchMode && <Search onSearch={onSearch} value={searchQuery} />}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canToggleSearchMode && (
            <Tooltip title={isSearchMode ? "Switch to Database Mode" : "Switch to Search Mode"}>
              <Button 
                icon={isSearchMode ? <DatabaseOutlined /> : <SearchOutlined />} 
                onClick={toggleSearchMode}
                type={isSearchMode ? "default" : "primary"}
              />
            </Tooltip>
          )}
          <Tooltip title="Reset">
            <Button icon={<ClearOutlined />} onClick={handleRefresh} />
          </Tooltip>
          <Tooltip title="Refresh Data">
            <Button icon={<ReloadOutlined />} onClick={handleReload} />
          </Tooltip>
          <Tooltip title="Column Settings">
            <Dropdown
              popupRender={() => (
                <ColumnSettings columns={columnSettings} onColumnChange={handleColumnSettingsChange} onReset={resetColumnSettings} />
              )}
              trigger={[ 'click' ]}
            >
              <Button icon={<SettingOutlined />} />
            </Dropdown>
          </Tooltip>
          <Tooltip title="View Applied Filters & Sorts">
            <Badge count={hasActiveFilters || hasActiveSorts ? (activeFiltersCount + activeSortsCount) : 0} color="blue">
              <Button disabled={!hasActiveFilters && !hasActiveSorts} icon={<NodeExpandOutlined />} onClick={() => setShowFilters(!showFilters)} />
            </Badge>
          </Tooltip>
        </div>
      </div>

      {showFilters && (
        <AppliedFiltersDisplay
          hasActiveFilters={hasActiveFilters}
          hasActiveSorts={hasActiveSorts}
          DisplayAppliedFilters={DisplayAppliedFilters}
          clearAllFilters={clearAllFilters}
          DisplayAppliedSorts={DisplayAppliedSorts}
          clearAllSorts={clearAllSorts}
        />
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
        rowSelection={rowSelection}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
        {renderPagination()}
      </div>
    </ErrorBoundary>
  );
};


