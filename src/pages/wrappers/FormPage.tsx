/**
 * FormPage Wrapper - Owns form state and provides FormStateContext.
 * Renders PageHeader and the existing Form component with state management.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { FormStateProvider } from '../../core/context/FormStateContext';
import { useModalContext } from '../../core/context';
import { useDebounce } from '../../core/hooks/useSelectiveDebounce';
import { Form } from '../../forms/Form';
import { IForm } from '../../core/forms/formConfig';
import { PageHeader, IPageHeader } from '../PostAuth/PageHeader/PageHeader';
import { SectionsRenderer, ISectionsConfig } from '../PostAuth/SectionsRenderer';
import { Card } from 'antd';

interface FormPageProps extends Omit<IForm, 'onDataChange' | 'onDataRefresh'>, Pick<IPageHeader, 'pageHeaderActions' | 'pageTitle' | 'breadcrumbs'> {
  routeParams?: Record<string, any>;
  sectionsConfig?: ISectionsConfig;
  cardStyle?: React.CSSProperties;
  /** Current nesting depth (for recursive sections) */
  depth?: number;
}

export const FormPage: React.FC<FormPageProps> = ({
  pageHeaderActions,
  pageTitle,
  breadcrumbs,
  routeParams = {},
  identifiers,
  sectionsConfig,
  cardStyle,
  depth = 0,
  ...formProps
}) => {
  // 1. Wrapper owns state
  const [ record, setRecord ] = useState<any>(null);
  const [ formValues, setFormValues ] = useState<Record<string, any>>({});

  // 2. Debounce formValues (300ms) - reduces re-renders for sections
  const debouncedFormValues = useDebounce(formValues, 300);

  // 3. Merge identifiers, record, and formValues into routeParams
  const enhancedRouteParams = useMemo(() => ({
    ...routeParams,
    ...(identifiers && typeof identifiers === 'string' ? { id: identifiers } : {}),
    ...(record || {}),  // Edit mode: merge loaded record
    // For live preview in sections: merge debounced formValues
    ...(debouncedFormValues || {})
  }), [ routeParams, identifiers, record, debouncedFormValues ]);

  // 4. Build FormStateContext value (memoized)
  const formState = useMemo(() => ({
    record,
    formValues: debouncedFormValues,
    isDirty: Object.keys(formValues).length > 0,
    isValid: true, // TODO: Get from form validation
    errors: undefined
  }), [ record, debouncedFormValues, formValues ]);

  // 5. Create onDataChange callback that updates our state
  const handleDataChange = useCallback((data: { record?: any; formValues?: Record<string, any>; pageType?: string; entityName?: string }) => {
    if (data.record !== undefined) {
      setRecord(data.record);
    }
    if (data.formValues !== undefined) {
      setFormValues(data.formValues);
    }
  }, []);

  // Check if we're in a modal - skip PageHeader if true (modal already has title)
  const { isInModal } = useModalContext();

  return (
    <FormStateProvider value={formState}>
      <div className="form-page">
        {/* Skip PageHeader when in modal - modal already has title/chrome */}
        {!isInModal && (
          <PageHeader
            pageHeaderActions={pageHeaderActions}
            pageTitle={pageTitle}
            breadcrumbs={breadcrumbs}
            routeParams={enhancedRouteParams}
          />
        )}

        {/* Form component - pass through onDataChange to capture state */}
        <Card style={{ ...cardStyle, padding: 0, marginTop: 16 }}>
          <Form
            {...formProps}
            routeParams={enhancedRouteParams}  // Override routeParams for URL substitution (must come after spread)
            identifiers={identifiers}
            onDataChange={handleDataChange}
          />
        </Card>
        {/* Render sections if configured */}
        {sectionsConfig && (
            <SectionsRenderer
              sectionsConfig={sectionsConfig}
              routeParams={enhancedRouteParams}
              parentData={{ formValues: debouncedFormValues, record }}
              depth={depth + 1}
              cardStyle={cardStyle}
            />
        )}
      </div>
    </FormStateProvider>
  );
};

