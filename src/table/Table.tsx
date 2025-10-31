import React, { useEffect, useMemo, useState } from "react";
import { Table as AntTable, Spin, Button, Dropdown, Tooltip, Badge } from "antd";
import { ReloadOutlined, ColumnWidthOutlined, NodeExpandOutlined, ClearOutlined, SettingOutlined, SearchOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useTable } from "./useTable";
import { ITableConfig } from "./type";
import { Search } from './Search/Search';
import { ColumnSettings } from './ColumnSettings/ColumnSettings';
import { AppliedFiltersDisplay } from './AppliedFilters/AppliedFiltersDisplay';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '../core/common';
import { OnDataChangeCallback } from '../core/types/pageData';
import './Table.css';

export const Table = ({
  propertiesConfig,
  records = [], //not using as of now
  apiConfig,
  routeParams,
  defaultFilters,
  entityName,  // From backend config generation
  onDataChange,  // For lifting state
  onDataRefresh,  // Standard: Register refresh handler
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
  
  // CRITICAL FIX: Track previous values to prevent infinite loops
  const prevStateRef = React.useRef<string>('');
  
  // Register refresh handler with parent
  useEffect(() => {
    if (onDataRefresh) {
      onDataRefresh(handleReload);
    }
  }, [onDataRefresh, handleReload]);
  
  // Lift table state to parent (debouncing handled by parent)
  // Don't depend on listRecords to avoid re-lifting on data refetch
  useEffect(() => {
    if (!onDataChange) return;
    
    // Serialize current state for comparison
    const currentState = JSON.stringify({
      selectedCount: selectedRecords.length,
      selectedIds: selectedRowKeys,
      filters: appliedFilters,
      searchQuery,
      entityName
    });
    
    // Only lift state if it actually changed
    if (currentState === prevStateRef.current) {
      return;
    }
    
    prevStateRef.current = currentState;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Table] Lifting state', {
        selectedCount: selectedRecords.length,
        hasFilters: Object.keys(appliedFilters).length > 0,
        hasSearch: !!searchQuery
      });
    }
    
    onDataChange({
      selectedRecords,  // Memoized, only changes when selection changes
      filters: appliedFilters,
      searchQuery,
      pageType: 'list',
      entityName
    });
  }, [selectedRecords, selectedRowKeys, appliedFilters, searchQuery, entityName, onDataChange]);

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
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
        {renderPagination()}
      </div>
    </ErrorBoundary>
  );
};


