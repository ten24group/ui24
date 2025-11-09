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

interface FormPageProps extends Omit<IForm, 'onDataChange' | 'onDataRefresh'>, Pick<IPageHeader, 'pageHeaderActions' | 'pageTitle' | 'breadcrumbs'> {
  routeParams?: Record<string, string>;
}

export const FormPage: React.FC<FormPageProps> = ({
  pageHeaderActions,
  pageTitle,
  breadcrumbs,
  routeParams = {},
  identifiers,
  ...formProps
}) => {
  // 1. Wrapper owns state
  const [record, setRecord] = useState<any>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  
  // 2. Debounce formValues (300ms) - reduces re-renders
  const debouncedFormValues = useDebounce(formValues, 300);
  
  // 3. Merge identifiers into routeParams for URL substitution
  const enhancedRouteParams = useMemo(() => ({
    ...routeParams,
    ...(identifiers && typeof identifiers === 'string' ? { id: identifiers } : {})
  }), [routeParams, identifiers]);
  
  // 4. Build FormStateContext value (memoized)
  const formState = useMemo(() => ({
    record,
    formValues: debouncedFormValues,
    isDirty: Object.keys(formValues).length > 0,
    isValid: true, // TODO: Get from form validation
    errors: undefined
  }), [record, debouncedFormValues, formValues]);
  
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
        <Form
          {...formProps}
          routeParams={enhancedRouteParams}  // Override routeParams for URL substitution (must come after spread)
          identifiers={identifiers}
          onDataChange={handleDataChange}
        />
      </div>
    </FormStateProvider>
  );
};

