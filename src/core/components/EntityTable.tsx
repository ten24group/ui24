import React from 'react';
import { useEntityConfig, IEntityConfigReference } from '../hooks/useEntityConfig';
import { Table } from '../../table/Table';

export interface EntityTableProps {
  /** Entity name (e.g. 'team', 'player') */
  entityName: string;
  /** Route parameters for URL substitution */
  routeParams?: Record<string, string>;
  /** Pre-applied default filters */
  defaultFilters?: Record<string, any>;
  /** Called when table data/selection changes */
  onDataChange?: (data: {
    selectedRecords?: ReadonlyArray<Record<string, unknown>>;
    filters?: Record<string, any>;
    searchQuery?: string;
    pageType?: string;
    entityName?: string;
    selectedRowKeys?: ReadonlyArray<React.Key>;
  }) => void;
  /** Override config */
  overrideConfig?: IEntityConfigReference['overrideConfig'];
  /** Whether to show toolbar (search, refresh, column settings) */
  showToolbar?: boolean;
  /** Whether to show pagination controls */
  showPagination?: boolean;
}

/**
 * Standalone EntityTable component (#61).
 * Auto-resolves list page config from the entity registry.
 * Can be dropped into any custom page without needing full page config.
 *
 * @example
 * <EntityTable entityName="team" />
 * <EntityTable entityName="player" defaultFilters={{ teamId: '123' }} />
 */
export const EntityTable: React.FC<EntityTableProps> = ({
  entityName,
  routeParams = {},
  defaultFilters,
  onDataChange,
  overrideConfig,
  showToolbar,
  showPagination,
}) => {
  const { resolveConfigRef } = useEntityConfig();

  const config = resolveConfigRef({
    entityName,
    pageType: 'list',
    overrideConfig,
  });

  if (!config?.listPageConfig) {
    return <div>No list config found for entity: {entityName}</div>;
  }

  const listConfig = config.listPageConfig;

  return (
    <Table
      propertiesConfig={listConfig.propertiesConfig || []}
      apiConfig={listConfig.apiConfig}
      routeParams={routeParams}
      defaultFilters={defaultFilters || listConfig.defaultFilters || {}}
      entityName={entityName}
      bulkActions={listConfig.bulkActions}
      rowSelection={listConfig.rowSelection}
      expandableConfig={listConfig.expandableConfig}
      segments={listConfig.segments}
      fetchStrategy={listConfig.fetchStrategy}
      pageSize={listConfig.pageSize}
      onDataChange={onDataChange}
      showToolbar={showToolbar}
      showPagination={showPagination}
      emptyState={listConfig.emptyState}
      rowFormatting={listConfig.rowFormatting}
      pagination={listConfig.pagination}
      density={listConfig.density}
      columnResizing={listConfig.columnResizing}
      pinnedColumns={listConfig.pinnedColumns}
      contextMenu={listConfig.contextMenu}
      displayMode={listConfig.displayMode}
      viewSwitcher={listConfig.viewSwitcher}
      loading={listConfig.loading}
    />
  );
};
