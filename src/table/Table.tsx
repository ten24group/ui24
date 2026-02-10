/**
 * @fileoverview Table Component for FW24 Framework
 * 
 * This is the main table component that provides enterprise-grade table functionality
 * including pagination, sorting, filtering, searching, row selection, bulk actions,
 * expandable rows, and filter segments.
 * 
 * ## Key Features
 * 
 * - **Pagination**: Cursor-based pagination with configurable page size
 * - **Sorting**: Multi-column sorting with visual indicators
 * - **Filtering**: Column-level filters with multiple operators (eq, contains, in, etc.)
 * - **Search**: Full-text search toggle between database and search modes
 * - **Row Selection**: Multi-row selection with bulk actions
 * - **Bulk Actions**: Actions that operate on multiple selected rows
 * - **Expandable Rows**: Nested tables or detail views within expandable rows
 * - **Filter Segments**: Quick filter tabs for common filter presets
 * - **Column Settings**: Show/hide columns, adjust widths, reorder columns
 * - **Placeholder Resolution**: Automatic resolution of placeholders in filters (`:actor.actorId`, `:startOfMonth`, etc.)
 * - **Relation Rendering**: Automatic rendering of relation fields with links and modals
 * - **Rich Field Types**: Specialized renderers for images, files, colors, JSON, rich text, ratings, and more
 * 
 * ## Architecture
 * 
 * The Table component follows a layered architecture:
 * 1. **Table.tsx** (this file): UI rendering and user interactions
 * 2. **useTable.tsx**: Data fetching, state management, and business logic
 * 3. **useTableData.tsx**: API calls and data transformation
 * 4. **FilterSegments**: Quick filter tabs with placeholder resolution
 * 5. **ColumnSettings**: Column visibility and configuration
 * 
 * ## Field Type Rendering
 * 
 * The table automatically applies specialized renderers based on field type:
 * 
 * **Simple Inline Renderers:**
 * - **image**: Thumbnail preview (40x40) with click-to-expand
 * - **file**: Download link
 * - **color**: Color swatch with hex value
 * - **number**: Formatted with thousand separators
 * - **range**: Value with percentage
 * - **rating**: Star display with numeric value
 * - **relation**: Link/modal with template-based display
 * 
 * **Modal-Based Renderers (for complex content):**
 * - **json/map**: "View JSON" button → Opens formatted JSON in modal
 * - **list**: "View (count)" button → Opens array items in modal (simple arrays shown inline if ≤3 items)
 * - **rich-text/wysiwyg**: "View Content" button → Opens BlockNote editor in modal
 * - **textarea/code/markdown**: Shows inline if <100 chars, otherwise "View Content" button → Opens in modal
 * 
 * ## Placeholder Resolution
 * 
 * The table automatically resolves placeholders in:
 * - Default filters (from backend config)
 * - Segment filters (from filter segments)
 * - Expandable row API URLs
 * - Relation field identifiers
 * 
 * Supported placeholders:
 * - `:actor.actorId` - Current user ID
 * - `:startOfMonth`, `:endOfMonth` - Date expressions
 * - `:teamId`, `:gameId` - Route parameters
 * 
 * ## Usage
 * 
 * @example
 * ```tsx
 * <Table
 *   propertiesConfig={[
 *     { name: 'Team', dataIndex: 'teamName', fieldType: 'text', isFilterable: true },
 *     { name: 'City', dataIndex: 'city', fieldType: 'text', isFilterable: true }
 *   ]}
 *   apiConfig={{
 *     apiMethod: 'GET',
 *     apiUrl: '/api/team',
 *     responseKey: 'data',
 *     useSearch: true
 *   }}
 *   defaultFilters={{ status: { eq: 'active' } }}
 *   segments={[
 *     { id: 'all', label: 'All Teams', filters: {} },
 *     { id: 'active', label: 'Active', filters: { status: { eq: 'active' } } }
 *   ]}
 *   bulkActions={[
 *     { label: 'Delete Selected', url: '/api/team/bulk-delete', openInModal: true }
 *   ]}
 * />
 * ```
 * 
 * @see {@link useTable} for data fetching and state management
 * @see {@link useTableData} for API integration
 * @see {@link FilterSegments} for quick filter tabs
 */

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Table as AntTable, Spin, Skeleton, Button, Dropdown, Tooltip, Badge, Space } from "antd";
import { ReloadOutlined, NodeExpandOutlined, ClearOutlined, SettingOutlined, SearchOutlined, DatabaseOutlined, ExpandAltOutlined, ShrinkOutlined } from '@ant-design/icons';
import { useTable } from "./useTable";
import { ITableConfig } from "./type";
import { Search } from './Search/Search';
import { ColumnSettings } from './ColumnSettings/ColumnSettings';
import { AppliedFiltersDisplay } from './AppliedFilters/AppliedFiltersDisplay';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '../core/common';
import { renderSingleAction } from '../core/utils/actionRenderer';
import { useEvaluationBatch } from '../core/hooks/useEvaluation';
import { substituteUrlParams } from '../core/utils';
import { RenderFromPageType } from '../pages/PostAuth/PostAuthPage';
import { resolveFilterPlaceholders } from '../core/utils/placeholderResolver';
import { FilterSegments } from './FilterSegments/FilterSegments';
import { useAutoRefresh } from '../core/hooks/useAutoRefresh';
import { AutoRefreshSelector } from '../core/components/AutoRefreshSelector';
import './Table.css';
import { usePlaceholderContext } from "./hooks/usePlaceholderContext";
import { JsonViewer } from '../core/common/JsonViewer/JsonViewer';

/**
 * Main Table component for rendering data tables with advanced features.
 * 
 * Consumes backend-generated table configurations and renders a fully-featured
 * data table with pagination, sorting, filtering, searching, and more.
 * 
 * @param props - Table configuration props
 * @param props.propertiesConfig - Column configurations from backend
 * @param props.apiConfig - API configuration for data fetching
 * @param props.routeParams - Route parameters for placeholder resolution
 * @param props.defaultFilters - Pre-applied filters (can use placeholders)
 * @param props.entityName - Entity name for context
 * @param props.bulkActions - Actions to show when rows are selected
 * @param props.rowSelection - Row selection configuration
 * @param props.expandableConfig - Expandable row configuration
 * @param props.segments - Filter segment configurations
 * @param props.onDataChange - Callback to lift table state to parent
 * 
 * @returns Rendered table component
 */
export const Table = ({
  propertiesConfig,
  records = [], //not using as of now
  apiConfig,
  routeParams,
  defaultFilters,
  entityName,  // From backend config generation
  bulkActions,  // Actions shown when multiple rows selected
  rowSelection: rowSelectionConfig,  // Row selection configuration
  expandableConfig,  // Expandable row configuration
  segments,  // Filter segments for quick filtering
  fetchStrategy,  // Fetch strategy from backend config
  pageSize: initialPageSize,  // Default page size from backend config
  onDataChange,  // Callback to lift state to wrapper
  showToolbar = true,
  showPagination = true,
}: ITableConfig) => {
  // Build placeholder context for segments and filters
  const placeholderContext = usePlaceholderContext(routeParams);

  // Track resolved defaultFilters for segment merging
  const resolvedDefaultFilters = useMemo(() => {
    if (!defaultFilters) return {};
    return resolveFilterPlaceholders(defaultFilters, placeholderContext);
  }, [ defaultFilters, placeholderContext ]);

  // Compute default segment filters to merge with prop defaultFilters
  // This ensures segments marked with `default: true` are applied on initial page load
  // These defaults are then passed to useTable, which merges them with URL filters
  const segmentDefaultFilters = useMemo(() => {
    if (!segments || segments.length === 0) return {};

    let defaults: Record<string, any> = {};

    // Normalize segments to grouped format
    const isGrouped = segments.length > 0 && ('segments' in segments[ 0 ]);
    const groups = isGrouped
      ? segments
      : [ { id: 'default-group', segments: segments } ];

    groups.forEach((group: any) => {
      // Find segment with explicit default=true flag
      // NOTE: Only explicit defaults are used; we don't fallback to first segment
      const defaultSeg = group.segments.find((s: any) => s.default);

      if (defaultSeg && defaultSeg.filters && Object.keys(defaultSeg.filters).length > 0) {
        // Resolve placeholders (e.g., :actor.actorId) before merging
        const resolved = resolveFilterPlaceholders(defaultSeg.filters, placeholderContext);
        Object.assign(defaults, resolved);
      }
    });

    return defaults;
  }, [ segments, placeholderContext ]);

  // Merge all default filters for useTable initialization
  // Priority: segmentDefaultFilters < resolvedDefaultFilters < URL filters (handled in useTable)
  const initialFiltersForTable = useMemo(() => ({
    ...segmentDefaultFilters,
    ...resolvedDefaultFilters // Prop defaults override segment defaults if keys conflict
  }), [ segmentDefaultFilters, resolvedDefaultFilters ]);

  const {
    recordIdentifierKey,
    columns,
    listRecords,
    isLoading,
    isInitialLoad,
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
    setAppliedFilters,  // NEW: For filter segments
    setFetchTrigger,  // NEW: To trigger refetch after state updates
    fetchRecords,  // NEW: To allow direct fetch after state updates
    columnSettings,
    handleColumnSettingsChange,
    resetColumnSettings,
    currentFetchStrategy,
    handleFetchStrategyChange,
    isSearchMode,
    toggleSearchMode,
    canToggleSearchMode,
  } = useTable({
    propertiesConfig,
    apiConfig,
    routeParams,
    defaultFilters: initialFiltersForTable, // Pass merged defaults here
    fetchStrategy,
    initialPageSize // Pass backend page size config
  });

  // Auto-refresh functionality
  const autoRefresh = useAutoRefresh({
    onRefresh: handleReload,
    enabled: false,
    defaultInterval: 30
  });

  const [ showFilters, setShowFilters ] = React.useState(false);

  // Ref to always access latest appliedFilters in callbacks (avoids stale closures)
  const appliedFiltersRef = useRef(appliedFilters);
  appliedFiltersRef.current = appliedFilters;

  // Track selected row keys for bulk actions and row selection
  const [ selectedRowKeys, setSelectedRowKeys ] = useState<React.Key[]>([]);

  // Track expanded row keys for expand/collapse all functionality
  const [ expandedRowKeys, setExpandedRowKeys ] = useState<React.Key[]>([]);

  // Calculate selectedRecords only when selectedRowKeys change (not on data refetch)
  const selectedRecords = useMemo(() =>
    listRecords.filter(record => selectedRowKeys.includes(record[ recordIdentifierKey ])),
    [ selectedRowKeys, listRecords, recordIdentifierKey ]
  );

  // Initial fetch behavior:
  // useTable now handles the initial fetch automatically on mount because:
  // 1. segmentDefaultFilters + resolvedDefaultFilters are merged into initialFiltersForTable
  // 2. useTable initializes appliedFilters with these defaults + URL filters
  // 3. fetchTrigger starts at 1, which triggers the initial fetch
  // 
  // This eliminates the need for separate initial fetch logic here

  // Trigger fetch when search mode changes
  useEffect(() => {
    setFetchTrigger(prev => prev + 1);
  }, [ isSearchMode ]);

  // Reset expanded rows when data changes (pagination, filters, etc.)
  useEffect(() => {
    setExpandedRowKeys([]);
  }, [ listRecords ]);

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
  }, [ selectedRecords, selectedRowKeys, appliedFilters, searchQuery, entityName, onDataChange ]);

  // Extract visibility configs from bulk actions for batch evaluation
  const bulkActionsVisibilityConfigs = useMemo(() =>
    bulkActions ? bulkActions.map(action => action.visibility) : [],
    [ bulkActions ]
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
        _evaluated: bulkActionsEvaluationResults[ index ]
      }))
      .filter(action => action._evaluated?.visible !== false);
  }, [ bulkActions, bulkActionsEvaluationResults ]);

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
  }, [ rowSelectionConfig, selectedRowKeys ]);

  // Expand/Collapse all rows functionality
  const handleExpandAll = useCallback(() => {
    const allKeys = listRecords.map(record => record[ recordIdentifierKey ]);
    setExpandedRowKeys(allKeys);
  }, [ listRecords, recordIdentifierKey ]);

  const handleCollapseAll = useCallback(() => {
    setExpandedRowKeys([]);
  }, []);

  const hasExpandableConfig = !!expandableConfig;
  const allExpanded = hasExpandableConfig && expandedRowKeys.length === listRecords.length && listRecords.length > 0;
  const someExpanded = hasExpandableConfig && expandedRowKeys.length > 0;

  // Expandable row configuration - reuses existing Table component for nested tables
  const expandable = useMemo(() => {
    if (!expandableConfig) return undefined;

    return {
      expandedRowKeys,
      onExpandedRowsChange: (keys: React.Key[]) => setExpandedRowKeys(keys),
      expandedRowRender: (record: any) => {
        // Build route params with parent record data for placeholder substitution
        const expandedRouteParams = {
          ...routeParams,
          ...record,
        };

        // Mode 1: Nested Table (reuses existing Table component)
        if (expandableConfig.mode === 'nested-table' && expandableConfig.tableConfig) {
          const {
            apiUrl,
            apiMethod = 'GET',
            responseKey = 'data',
            columns: columnFields,
            pageSize = 5,
            showPagination = true,
            defaultFilters: nestedDefaultFilters = {},
            showViewAll = false,
            viewAllModalWidth = 1200,
          } = expandableConfig.tableConfig;

          // Substitute placeholders in API URL (e.g., :teamId)
          const resolvedApiUrl = substituteUrlParams(apiUrl, expandedRouteParams);

          // Resolve default filters using placeholder resolver with record context
          // NOTE: Can't use usePlaceholderContext hook here (inside callback), so build context manually
          const nestedPlaceholderContext = {
            ...placeholderContext,  // Reuse actor, now from top-level hook
            routeParams: expandedRouteParams,
            record,  // Current row data
            parent: record,  // Parent record for nested context
          };
          const resolvedDefaultFilters = resolveFilterPlaceholders(nestedDefaultFilters, nestedPlaceholderContext);

          // Filter columns if specific fields are requested
          const filteredPropertiesConfig = columnFields && columnFields.length > 0
            ? propertiesConfig.filter(col => columnFields.includes(col.dataIndex))
            : propertiesConfig;

          return (
            <div>
              <Table
                propertiesConfig={filteredPropertiesConfig}
                apiConfig={{
                  apiUrl: resolvedApiUrl,
                  apiMethod,
                  responseKey,
                  useSearch: false,  // Nested tables use database mode by default
                }}
                routeParams={expandedRouteParams}
                defaultFilters={resolvedDefaultFilters}
                entityName={entityName}
              />
            </div>
          );
        }

        // Mode 2: Details (uses RenderFromPageType with details config)
        if (expandableConfig.mode === 'details') {
          const { fields, numColumns = 2 } = expandableConfig.detailsConfig || {};

          // Filter and transform table properties config to details field config
          const detailFields = (fields && fields.length > 0
            ? propertiesConfig.filter(col => fields.includes(col.dataIndex))
            : propertiesConfig  // Show all fields if no specific fields requested
          ).map(col => ({
            ...col,
            label: col.name,  // Map name to label for details
            dataIndex: col.dataIndex,
            initialValue: record[ col.dataIndex ],  // Set value from expanded record
          }));

          return (
            <div>
              <RenderFromPageType
                pageType="details"
                detailsPageConfig={{
                  detailResponse: record,  // Pass record data directly - no API fetch needed
                  propertiesConfig: detailFields,
                  columnsConfig: {
                    numColumns,
                    columns: [ { sortOrder: 0, fields: detailFields.map(c => c.dataIndex) } ]
                  }
                }}
                routeParams={expandedRouteParams}
              />
            </div>
          );
        }

        // Mode 3: Custom (uses RenderFromPageType with custom config)
        if (expandableConfig.mode === 'custom' && expandableConfig.customConfig) {
          const { pageType, pageConfig } = expandableConfig.customConfig;

          return (
            <div>
              <RenderFromPageType
                pageType={pageType}
                {...pageConfig}
                routeParams={expandedRouteParams}
              />
            </div>
          );
        }

        // Mode 4: JSON or fallback to JsonViewer (raw JSON view of the entire record using JsonViewer)
        // Use __raw__ to show original unformatted data (before date/boolean formatting)
        // Fall back to record if __raw__ doesn't exist
        const rawData = record.__raw__ || record;

        // Remove table-specific metadata fields
        const { __recordIdentifierKey__, ...cleanData } = rawData;

        return (
          <div style={{ margin: 0, padding: 0 }}>
            <JsonViewer
              data={cleanData}
              title="Record Data"
              defaultExpanded={true}
              showCopy={false}
              showStats={false}
              showModalButton={true}
            />
          </div>
        );
      },

      // Conditional row expansion based on visibility config
      // TODO: Integrate with visibility evaluation system
      rowExpandable: (record: any) => {
        // For now, always allow expansion if config is present
        // In future, evaluate expandableConfig.rowExpandable with visibility system
        return true;
      },

      // Optional: Custom indent size
      indentSize: expandableConfig.indentSize,
    };
  }, [ expandableConfig, routeParams, propertiesConfig, entityName, expandedRowKeys ]);

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

      {showToolbar && (
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
          {hasExpandableConfig && (
            <Tooltip title={allExpanded ? "Collapse All Rows" : "Expand All Rows"}>
              <Button
                icon={allExpanded ? <ShrinkOutlined /> : <ExpandAltOutlined />}
                onClick={allExpanded ? handleCollapseAll : handleExpandAll}
                type={someExpanded ? "primary" : "default"}
              />
            </Tooltip>
          )}
          <Tooltip title="Reset">
            <Button icon={<ClearOutlined />} onClick={handleRefresh} />
          </Tooltip>
          <Tooltip title="Refresh Data">
            <Button icon={<ReloadOutlined />} onClick={handleReload} />
          </Tooltip>
          <AutoRefreshSelector
            isEnabled={autoRefresh.isEnabled}
            interval={autoRefresh.interval}
            timeUntilRefresh={autoRefresh.timeUntilRefresh}
            onToggle={autoRefresh.toggleEnabled}
            onIntervalChange={autoRefresh.setInterval}
            size="middle"
          />
          <Tooltip title="Column Settings">
            <Dropdown
              popupRender={() => (
                <ColumnSettings
                  columns={columnSettings}
                  onColumnChange={handleColumnSettingsChange}
                  onReset={resetColumnSettings}
                  fetchStrategy={currentFetchStrategy}
                  onFetchStrategyChange={handleFetchStrategyChange}
                />
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
      )}

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

      {/* Filter Segments (quick filter tabs) */}
      {segments && segments.length > 0 && (
        <FilterSegments
          segments={segments}
          isSearchMode={isSearchMode}
          appliedFilters={appliedFilters}
          onSegmentChange={useCallback((segmentId: string, filtersToAdd: Record<string, any>, filtersToRemove: Record<string, any>) => {
            // Use ref to get latest filters (avoids stale closures)
            const currentFilters = appliedFiltersRef.current;
            let newFilters = { ...currentFilters };

            // 1. Remove filters from previous segment
            // These are the keys controlled by the segment we're switching away from
            if (filtersToRemove) {
              Object.keys(filtersToRemove).forEach(key => {
                delete newFilters[ key ];
              });
            }

            // 2. Add filters from new segment
            // If switching to "All" (empty filters), this step does nothing
            if (filtersToAdd) {
              Object.assign(newFilters, filtersToAdd);
            }

            // 3. Restore default filters for removed keys (if they exist)
            // Example: Switching from "Active" (status=active) to "All" (empty)
            // If defaultFilters has status=pending, restore it
            Object.keys(filtersToRemove || {}).forEach(key => {
              if (resolvedDefaultFilters[ key ] !== undefined && newFilters[ key ] === undefined) {
                newFilters[ key ] = resolvedDefaultFilters[ key ];
              }
            });

            // 4. Update state and fetch immediately with new filters
            // fetchRecords accepts filtersOverride to bypass React's async setState
            setAppliedFilters(newFilters);
            fetchRecords(1, undefined, newFilters);
          }, [ resolvedDefaultFilters, setAppliedFilters, fetchRecords ])}
          placeholderContext={placeholderContext}
        />
      )}

      {/* Applied Filters & Sorts Display */}
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

      {isInitialLoad ? (
        // Show skeleton loader on initial load for instant page transition
        <div>
          <Skeleton active paragraph={{ rows: 10 }} />
        </div>
      ) : (
        <>
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
            expandable={expandable}
          />
          {showPagination && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            {renderPagination()}
          </div>
          )}
        </>
      )}
    </ErrorBoundary>
  );
};


