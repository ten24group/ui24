/**
 * FormPage Wrapper - Owns form state and provides FormStateContext.
 * Renders PageHeader and the existing Form component with state management.
 */
import React, { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { FormStateProvider } from '../../core/context/FormStateContext';
import { useModalContext, useApi } from '../../core/context';
import { useNewEvaluationContext } from '../../core/context/NewEvaluationContext';
import { useDebounce } from '../../core/hooks/useSelectiveDebounce';
import { Form } from '../../forms/Form';
import { IForm } from '../../core/forms/formConfig';
import { PageHeader, IPageHeader } from '../PostAuth/PageHeader/PageHeader';
import { SectionsRenderer, ISectionsConfig } from '../PostAuth/SectionsRenderer';
import { Card, Skeleton } from 'antd';
import { useSpan } from '../../core/telemetry';
import { PageAlerts } from '../../core/common/PageAlerts/PageAlerts';
import { conditionEvaluator } from '../../core/utils/ConditionEvaluator';
import { isConditionalValue } from '../../core/types/evaluation';
import type { IFormFieldResponse } from '../../core/forms/FormField/FormField';

interface FormPageProps extends Omit<IForm, 'onDataChange' | 'onDataRefresh'>, Pick<IPageHeader, 'pageHeaderActions' | 'pageTitle' | 'breadcrumbs'> {
  routeParams?: Record<string, any>;
  sectionsConfig?: ISectionsConfig;
  cardStyle?: React.CSSProperties;
  /** Current nesting depth (for recursive sections) */
  depth?: number;
}

/** Infrastructure params that should not be treated as form field values */
const NON_FIELD_URL_PARAMS = [ 'debug', 'trace', 'mock', 'f', 'redirect', 'returnUrl' ];

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
  const location = useLocation();
  const evalCtx = useNewEvaluationContext();

  // Pre-fill: read URL query params and merge into defaultValues (one-time on mount)
  const { prefillValues, prefillFieldNames } = useMemo(() => {
    const prefillConfig = formProps.prefill;
    if (!prefillConfig?.enabled) return { prefillValues: undefined, prefillFieldNames: new Set<string>() };

    const params = new URLSearchParams(location.search);
    const values: Record<string, string> = {};
    const names = new Set<string>();

    params.forEach((value, key) => {
      if (NON_FIELD_URL_PARAMS.includes(key)) return;
      if (prefillConfig.autoDetect === false) return;
      values[ key ] = value;
      names.add(key);
    });

    return {
      prefillValues: Object.keys(values).length > 0 ? values : undefined,
      prefillFieldNames: names
    };
  }, [ location.search, formProps.prefill ]);

  // Resolve ConditionalValue<any> in per-field defaultValue and page-level defaultValues (#33)
  const resolvedFieldDefaults = useMemo(() => {
    const result: Record<string, unknown> = {};
    for (const field of (formProps.propertiesConfig ?? [])) {
      if (field.defaultValue !== undefined) {
        result[ field.name ] = isConditionalValue(field.defaultValue)
          ? conditionEvaluator.resolveValue(field.defaultValue, evalCtx)
          : field.defaultValue;
      }
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ formProps.propertiesConfig, evalCtx ]);

  // Resolve ConditionalValue in page-level defaultValues dict
  const resolvedPageDefaults = useMemo(() => {
    if (!formProps.defaultValues) return undefined;
    const result: Record<string, unknown> = {};
    for (const [ key, val ] of Object.entries(formProps.defaultValues)) {
      result[ key ] = isConditionalValue(val) ? conditionEvaluator.resolveValue(val, evalCtx) : val;
    }
    return result;
  }, [ formProps.defaultValues, evalCtx ]);

  // Merge: field-level defaults < page-level defaults < prefill values (most specific wins)
  const mergedDefaultValues = useMemo(() => {
    const base = { ...resolvedFieldDefaults, ...(resolvedPageDefaults ?? {}) };
    if (!prefillValues) return Object.keys(base).length > 0 ? base : formProps.defaultValues;
    return { ...base, ...prefillValues };
  }, [ resolvedFieldDefaults, resolvedPageDefaults, prefillValues, formProps.defaultValues ]);

  // Server-driven schema (#100): fetch propertiesConfig dynamically when schemaApiConfig is provided
  const { callApiMethod } = useApi();
  const [ dynamicSchema, setDynamicSchema ] = useState<Array<IFormFieldResponse> | null>(null);
  const [ schemaLoading, setSchemaLoading ] = useState<boolean>(!!formProps.schemaApiConfig);

  useEffect(() => {
    if (!formProps.schemaApiConfig) return;

    let cancelled = false;
    setSchemaLoading(true);

    const resolvedUrl = formProps.schemaApiConfig.apiUrl.replace(
      /:([a-zA-Z_][a-zA-Z0-9_]*)/g,
      (_, k) => String(routeParams[ k ] ?? `:${k}`)
    );

    callApiMethod<any>({ ...formProps.schemaApiConfig, apiUrl: resolvedUrl })
      .then((response) => {
        if (cancelled) return;
        const key = formProps.schemaApiConfig!.responseKey ?? 'fields';
        const serverFields: IFormFieldResponse[] = response?.data?.[ key ] ?? response?.data ?? [];

        const strategy = formProps.schemaApiConfig!.mergeStrategy ?? 'replace';
        if (strategy === 'append') {
          setDynamicSchema([ ...(formProps.propertiesConfig ?? []), ...serverFields ]);
        } else if (strategy === 'prepend') {
          setDynamicSchema([ ...serverFields, ...(formProps.propertiesConfig ?? []) ]);
        } else {
          setDynamicSchema(serverFields);
        }
      })
      .catch(() => {
        if (!cancelled) setDynamicSchema(null); // fall back to static propertiesConfig
      })
      .finally(() => {
        if (!cancelled) setSchemaLoading(false);
      });

    return () => { cancelled = true; };
  // Re-fetch when route params change (e.g. on navigate to a different record)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ formProps.schemaApiConfig?.apiUrl, routeParams ]);

  // Effective fields: dynamic (server) schema if available, else static
  const effectivePropertiesConfig = dynamicSchema ?? formProps.propertiesConfig;

  // 1. Wrapper owns state
  const [ record, setRecord ] = useState<any>(null);
  const [ formValues, setFormValues ] = useState<Record<string, any>>({});
  const [ isFormValid, setIsFormValid ] = useState<boolean>(true);

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
    isValid: isFormValid,
    errors: undefined
  }), [ record, debouncedFormValues, formValues, isFormValid ]);

  // 5. Create onDataChange callback that updates our state
  const handleDataChange = useCallback((data: { record?: any; formValues?: Record<string, any>; pageType?: string; entityName?: string; isValid?: boolean }) => {
    if (data.record !== undefined) {
      setRecord(data.record);
    }
    if (data.formValues !== undefined) {
      setFormValues(data.formValues);
    }
    if (data.isValid !== undefined) {
      setIsFormValid(data.isValid);
    }
  }, []);

  // Check if we're in a modal - skip PageHeader if true (modal already has title)
  const { isInModal } = useModalContext();

  // Form load span tracking
  const isEditMode = !!identifiers;
  const mode = isEditMode ? 'Edit' : 'Create';

  const { updateSpan } = useSpan({
    name: `Form: ${formProps.entityName || 'Unknown'} (${mode})`,
    entityName: formProps.entityName,
    apiUrl: formProps.apiConfig?.apiUrl,
    identifiers,
    type: 'form.load',
    attributes: {
      'form.entity': formProps.entityName || 'Unknown',
      'form.mode': mode.toLowerCase(),
      'form.identifier': typeof identifiers === 'string' ? identifiers : JSON.stringify(identifiers),
    }
  });

  // After record loads (edit mode), update span attributes
  useEffect(() => {
    if (record) {
      updateSpan({
        'form.recordLoaded': true,
        'form.fieldCount': Object.keys(record).length
      });
    }
  }, [ record, updateSpan ]);

  // Wrap content in span context for propagation
  const renderContent = () => {
    const content = (
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

          {/* Inline contextual alerts (#16) */}
          {formProps.alerts && formProps.alerts.length > 0 && (
            <PageAlerts
              alerts={formProps.alerts}
              record={record ?? undefined}
              formValues={debouncedFormValues}
              placement="top"
            />
          )}

          {/* Form component - pass through onDataChange to capture state */}
          <Card style={{ ...cardStyle, padding: 0, marginTop: 16 }}>
            {schemaLoading ? (
              /* Skeleton shown while server-driven schema is loading (#100) */
              <Skeleton active paragraph={{ rows: 6 }} style={{ padding: 24 }} />
            ) : (
              <Form
                {...formProps}
                propertiesConfig={effectivePropertiesConfig} // may be server-fetched (#100)
                defaultValues={mergedDefaultValues}
                routeParams={enhancedRouteParams}
                identifiers={identifiers}
                onDataChange={handleDataChange}
                _prefillFieldNames={formProps.prefill?.lockPrefilled ? prefillFieldNames : undefined}
              />
            )}
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

    // REMOVED: SpanContextProvider wrapping to improve performance
    return content;
  };

  return renderContent();
};

