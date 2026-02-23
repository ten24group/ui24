/**
 * Table-level dynamic context (changes on selection/filter).
 * Provided by TablePage wrapper, available to table components.
 * 
 * Uses use-context-selector for selective subscription.
 */
import { createContext, useContextSelector } from 'use-context-selector';
import React, { ReactNode } from 'react';
import { useDevToolsReport } from '../devtools/store/snapshot';
import { useEntityName } from './PageStaticContext';

export interface TableStateContextValue {
  selectedRecords: any[];
  selectedRowKeys: (string | number)[];
  filters: Record<string, any>;
  searchQuery: string;
}

export const TableStateContext = createContext<TableStateContextValue | null>(null);

export const TableStateProvider = ({
  children,
  value
}: {
  children: ReactNode;
  value: TableStateContextValue;
}) => {
  const entityName = useEntityName();
  useDevToolsReport('table', entityName ? `Table: ${entityName}` : 'Table', value);

  return (
    <TableStateContext.Provider value={value}>
      {children}
    </TableStateContext.Provider>
  );
};

// Selector hooks
export const useSelectedRecords = () =>
  useContextSelector(TableStateContext, state => state?.selectedRecords || []);

export const useSelectedRowKeys = () =>
  useContextSelector(TableStateContext, state => state?.selectedRowKeys || []);

export const useSelectedCount = () =>
  useContextSelector(
    TableStateContext,
    state => state?.selectedRecords?.length || 0
  );

export const useHasSelection = () =>
  useContextSelector(
    TableStateContext,
    state => (state?.selectedRecords?.length || 0) > 0
  );

export const useTableFilters = () =>
  useContextSelector(TableStateContext, state => state?.filters || {});

export const useTableFilter = (filterName: string) =>
  useContextSelector(
    TableStateContext,
    state => state?.filters?.[filterName]
  );

export const useSearchQuery = () =>
  useContextSelector(TableStateContext, state => state?.searchQuery || '');

export const useHasSearchQuery = () =>
  useContextSelector(
    TableStateContext,
    state => (state?.searchQuery || '').length > 0
  );

// Full context (use in evaluation system)
export const useTableStateContext = () =>
  useContextSelector(TableStateContext, state => state);
