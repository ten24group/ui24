/**
 * TablePage Wrapper - Owns table state and provides TableStateContext.
 * Renders PageHeader and the existing Table component with state management.
 */
import React, { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { TableStateProvider } from '../../core/context/TableStateContext';
import { useModalContext } from '../../core/context';
import { Table } from '../../table/Table';
import { ITableConfig } from '../../table/type';
import { PageHeader, IPageHeader } from '../PostAuth/PageHeader/PageHeader';
import { SectionsRenderer, ISectionsConfig } from '../PostAuth/SectionsRenderer';
import { Card } from 'antd';
import { useSpan } from '../../core/telemetry';
import { PageAlerts } from '../../core/common/PageAlerts/PageAlerts';

interface TablePageProps extends Omit<ITableConfig, 'onDataChange' | 'onDataRefresh'>, Pick<IPageHeader, 'pageHeaderActions' | 'pageTitle' | 'breadcrumbs'> {
  routeParams?: Record<string, any>;
  sectionsConfig?: ISectionsConfig;
  cardStyle?: React.CSSProperties;
  /** Current nesting depth (for recursive sections) */
  depth?: number;
}

export const TablePage: React.FC<TablePageProps> = ({
  pageHeaderActions,
  pageTitle,
  breadcrumbs,
  routeParams = {},
  sectionsConfig,
  cardStyle,
  depth = 0,
  ...tableProps
}) => {
  // 1. Wrapper owns state
  const [ selectedRecords, setSelectedRecords ] = useState<any[]>([]);
  const [ selectedRowKeys, setSelectedRowKeys ] = useState<(string | number)[]>([]);
  const [ filters, setFilters ] = useState<Record<string, any>>({});
  const [ searchQuery, setSearchQuery ] = useState<string>('');

  // 2. Build TableStateContext value (memoized)
  const tableState = useMemo(() => ({
    selectedRecords,
    selectedRowKeys,
    filters,
    searchQuery
  }), [ selectedRecords, selectedRowKeys, filters, searchQuery ]);

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

  // 4. Build enhanced routeParams with table state
  const enhancedRouteParams = useMemo(() => ({
    ...routeParams,
    // Merge summary data (not full arrays - too large!)
    selectedCount: selectedRecords.length,
    hasSelection: selectedRecords.length > 0,
    ...(filters || {}),  // Merge current filters
    searchQuery
  }), [ routeParams, selectedRecords, filters, searchQuery ]);

  // Check if we're in a modal - skip PageHeader if true (modal already has title)
  const { isInModal } = useModalContext();

  // Table lifecycle span tracking
  const apiUrl = tableProps.apiConfig && (('apiUrl' in tableProps.apiConfig)
    ? tableProps.apiConfig.apiUrl
    : (tableProps.apiConfig.search?.apiUrl || tableProps.apiConfig.database?.apiUrl));

  const { updateSpan } = useSpan({
    entityName: tableProps.entityName,
    apiUrl,
    type: 'table.lifecycle',
    attributes: {
      'table.entity': tableProps.entityName || 'Unknown',
    }
  });

  // Track table state changes
  useEffect(() => {
    updateSpan({
      'table.filterCount': Object.keys(filters).length,
      'table.hasSearch': !!searchQuery,
      'table.selectedCount': selectedRecords.length
    });
  }, [ filters, searchQuery, selectedRecords, updateSpan ]);

  // Wrap content in span context for propagation
  const renderContent = () => {
    const content = (
      <TableStateProvider value={tableState}>
        <div className="table-page">
          {/* Skip PageHeader when in modal - modal already has title/chrome */}
          {!isInModal && (
            <PageHeader
              pageHeaderActions={pageHeaderActions}
              pageTitle={pageTitle}
              breadcrumbs={breadcrumbs}
              routeParams={enhancedRouteParams}
            />
          )}

          {/* Inline contextual alerts (#16) */}
          {tableProps.alerts && tableProps.alerts.length > 0 && (
            <PageAlerts alerts={tableProps.alerts} placement="top" />
          )}

          {/* Table component - pass through onDataChange to capture state */}
          <Card style={{ ...cardStyle, padding: 0, marginTop: 16 }}>
            <Table
              {...tableProps}
              routeParams={enhancedRouteParams}
              onDataChange={handleDataChange}
            />
          </Card>

          {/* Render sections if configured */}
          {sectionsConfig && (
            <SectionsRenderer
              sectionsConfig={sectionsConfig}
              routeParams={enhancedRouteParams}
              parentData={{ selectedRecords, filters, searchQuery }}
              depth={depth + 1}
              cardStyle={cardStyle}
            />
          )}
        </div>
      </TableStateProvider>
    );

    // REMOVED: SpanContextProvider wrapping to improve performance
    return content;
  };

  return renderContent();
};

