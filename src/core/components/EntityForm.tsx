import React from 'react';
import { useEntityConfig, IEntityConfigReference } from '../hooks/useEntityConfig';
import { Form } from '../../forms/Form';

export interface EntityFormProps {
  /** Entity name (e.g. 'team', 'player') */
  entityName: string;
  /** Record identifier for edit mode (omit for create) */
  identifiers?: string;
  /** Route parameters for URL substitution */
  routeParams?: Record<string, string>;
  /** Default values to pre-populate */
  defaultValues?: Record<string, any>;
  /** Called on successful submission */
  onSuccess?: (data: any) => void;
  /** Called when user cancels */
  onCancel?: () => void;
  /** Override config */
  overrideConfig?: IEntityConfigReference['overrideConfig'];
}

/**
 * Standalone EntityForm component (#61).
 * Auto-resolves page config from the entity registry based on mode:
 * - create mode (no identifiers): resolves 'create' config
 * - edit mode (identifiers provided): resolves 'edit' config, falls back to 'create' config
 * Can be dropped into any custom page without needing full page config.
 *
 * @example
 * <EntityForm entityName="team" onSuccess={(data) => console.log('Created:', data)} />
 * <EntityForm entityName="team" identifiers="123" /> // edit mode
 */
export const EntityForm: React.FC<EntityFormProps> = ({
  entityName,
  identifiers,
  routeParams = {},
  defaultValues,
  onSuccess,
  onCancel,
  overrideConfig,
}) => {
  const { resolveConfigRef } = useEntityConfig();

  const pageType = identifiers ? 'edit' : 'create';

  const config = resolveConfigRef({
    entityName,
    pageType,
    overrideConfig,
  });

  // Resolve form config: try the target pageType first, then fall back to 'create'
  // (most backends share a single form config for both create and edit)
  const formConfig = config?.formPageConfig
    || (pageType === 'edit'
      ? resolveConfigRef({ entityName, pageType: 'create', overrideConfig })?.formPageConfig
      : null);

  if (!formConfig) {
    return <div>No form config found for entity: {entityName}</div>;
  }

  // onSubmit is a no-op: the Form internally uses OperationExecutor via apiConfig
  const noopSubmit = React.useCallback(() => {}, []);

  return (
    <Form
      propertiesConfig={formConfig.propertiesConfig || []}
      apiConfig={formConfig.apiConfig}
      detailApiConfig={formConfig.detailApiConfig}
      formButtons={formConfig.formButtons || ['submit', 'cancel']}
      columnsConfig={formConfig.columnsConfig}
      identifiers={identifiers}
      routeParams={routeParams}
      defaultValues={defaultValues || formConfig.defaultValues || {}}
      submitSuccessRedirect={formConfig.submitSuccessRedirect}
      submitSuccessRedirectOptions={formConfig.submitSuccessRedirectOptions}
      onSubmit={noopSubmit}
      onSubmitSuccessCallback={onSuccess}
      onCancelCallback={onCancel}
      entityName={entityName}
      loading={formConfig.loading}
      stickyActions={formConfig.stickyActions}
    />
  );
};
