/**
 * TablePage Wrapper - Owns table state and provides TableStateContext.
 * Renders PageHeader and the existing Table component with state management.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { TableStateProvider } from '../../core/context/TableStateContext';
import { Table } from '../../table/Table';
import { ITableConfig } from '../../table/type';
import { PageHeader, IPageHeader } from '../PostAuth/PageHeader/PageHeader';

interface TablePageProps extends Omit<ITableConfig, 'onDataChange' | 'onDataRefresh'>, Pick<IPageHeader, 'pageHeaderActions' | 'pageTitle' | 'breadcrumbs'> {
  routeParams?: Record<string, string>;
}

export const TablePage: React.FC<TablePageProps> = ({
  pageHeaderActions,
  pageTitle,
  breadcrumbs,
  routeParams = {},
  ...tableProps
}) => {
  // 1. Wrapper owns state
  const [selectedRecords, setSelectedRecords] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<(string | number)[]>([]);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // 2. Build TableStateContext value (memoized)
  const tableState = useMemo(() => ({
    selectedRecords,
    selectedRowKeys,
    filters,
    searchQuery
  }), [selectedRecords, selectedRowKeys, filters, searchQuery]);
  
  // 3. Create onDataChange callback that updates our state
  const handleDataChange = useCallback((data: { selectedRecords?: any[]; filters?: Record<string, any>; searchQuery?: string; pageType?: string; entityName?: string }) => {
    if (data.selectedRecords !== undefined) {
      setSelectedRecords(data.selectedRecords);
    }
    if (data.filters !== undefined) {
      setFilters(data.filters);
    }
    if (data.searchQuery !== undefined) {
      setSearchQuery(data.searchQuery);
    }
  }, []);
  
  return (
    <TableStateProvider value={tableState}>
      <div className="table-page">
        {/* PageHeader has access to TableStateContext */}
        <PageHeader
          pageHeaderActions={pageHeaderActions}
          pageTitle={pageTitle}
          breadcrumbs={breadcrumbs}
          routeParams={routeParams}
        />
        
        {/* Table component - pass through onDataChange to capture state */}
        <Table
          {...tableProps}
          routeParams={routeParams}
          onDataChange={handleDataChange}
        />
      </div>
    </TableStateProvider>
  );
};

