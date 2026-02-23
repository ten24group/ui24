import React from 'react';
import { useEntityConfig, IEntityConfigReference } from '../hooks/useEntityConfig';
import { Details } from '../../detail/Details';

export interface EntityDetailProps {
  /** Entity name (e.g. 'team', 'player') */
  entityName: string;
  /** Record identifier to load */
  identifiers: string;
  /** Route parameters for URL substitution */
  routeParams?: Record<string, string>;
  /** Override config */
  overrideConfig?: IEntityConfigReference['overrideConfig'];
  /** Called when detail data changes */
  onDataChange?: (data: { record?: any; pageType?: string; entityName?: string; dataUpdatedAt?: string }) => void;
  /** Ref to expose refresh function to parent */
  refreshRef?: React.RefObject<(() => Promise<void>) | null>;
}

/**
 * Standalone EntityDetail component (#61).
 * Auto-resolves view page config from the entity registry.
 * Can be dropped into any custom page without needing full page config.
 *
 * @example
 * <EntityDetail entityName="team" identifiers="123" />
 */
export const EntityDetail: React.FC<EntityDetailProps> = ({
  entityName,
  identifiers,
  routeParams = {},
  overrideConfig,
  onDataChange,
  refreshRef,
}) => {
  const { resolveConfigRef } = useEntityConfig();

  const config = resolveConfigRef({
    entityName,
    pageType: 'view',
    overrideConfig,
  });

  if (!config?.detailsPageConfig) {
    return <div>No detail config found for entity: {entityName}</div>;
  }

  const detailsConfig = config.detailsPageConfig;

  return (
    <Details
      propertiesConfig={detailsConfig.propertiesConfig || []}
      detailApiConfig={detailsConfig.detailApiConfig}
      identifiers={identifiers}
      columnsConfig={detailsConfig.columnsConfig}
      routeParams={routeParams}
      entityName={entityName}
      onDataChange={onDataChange}
      refreshRef={refreshRef}
      sectionsConfig={detailsConfig.sectionsConfig}
      loading={detailsConfig.loading}
    />
  );
};
