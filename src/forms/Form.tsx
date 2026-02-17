/**
 * @fileoverview Form Component for FW24 Framework
 * 
 * This is the main form component that provides comprehensive form functionality
 * for creating and editing records. It supports multi-column layouts, field validation,
 * nested objects/arrays, API integration, and automatic data loading for edit mode.
 * 
 * ## Key Features
 * 
 * - **Create & Edit Modes**: Automatically detects mode based on presence of record data
 * - **Multi-Column Layouts**: Flexible column layouts (1-3 columns) with automatic responsive behavior
 * - **Field Validation**: Client-side and server-side validation with inline error display
 * - **Nested Data**: Support for nested objects (maps) and arrays (lists)
 * - **Data Type Handling**: Automatic conversion of dates, numbers, booleans, JSON, etc.
 * - **API Integration**: Automatic data loading (edit mode) and submission (create/update)
 * - **Error Handling**: Comprehensive error handling with field-level and form-level errors
 * - **Success Redirects**: Configurable redirects after successful submission
 * - **State Lifting**: Lifts form state to parent for visibility conditions and context
 * 
 * ## Architecture
 * 
 * The Form component follows a layered architecture:
 * 1. **Form.tsx** (this file): Form orchestration, data loading, submission
 * 2. **FormField.tsx**: Individual field rendering with validation
 * 3. **Field Components**: Specialized components for each field type (text, select, date, etc.)
 * 4. **API Integration**: Uses `useApi` hook for data fetching and submission
 * 
 * ## Data Flow
 * 
 * ### Create Mode
 * 1. Load schema defaults from `propertiesConfig`
 * 2. Merge with `defaultValues` prop (from modal navigation, etc.)
 * 3. Render form with initial values
 * 4. On submit, POST data to API
 * 5. Redirect or callback on success
 * 
 * ### Edit Mode
 * 1. Fetch existing record from `detailApiConfig`
 * 2. Format record data for form display (dates, booleans, JSON, etc.)
 * 3. Set as `initialValue` for each field
 * 4. Render form with initial values
 * 5. On submit, PUT/PATCH data to API
 * 6. Redirect or callback on success
 * 
 * ## Field Type Handling
 * 
 * The form automatically handles data conversion for various field types:
 * - **Dates**: Converts to/from ISO strings and dayjs objects
 * - **Numbers**: Converts string inputs to numbers
 * - **Booleans**: Converts to boolean type
 * - **JSON**: Parses JSON strings for submission, stringifies for display
 * - **Maps**: Recursively processes nested objects
 * - **Lists**: Handles array fields with dynamic add/remove
 * 
 * ## Error Handling
 * 
 * The form handles errors at multiple levels:
 * - **Field-level errors**: Displayed inline under each field
 * - **Form-level errors**: Displayed as toast notifications
 * - **Network errors**: Displayed with user-friendly messages
 * - **Validation errors**: Parsed from API response and mapped to fields
 * 
 * ## Usage
 * 
 * @example
 * ```tsx
 * // Create form
 * <Form
 *   propertiesConfig={[
 *     { name: 'teamName', label: 'Name', fieldType: 'text', required: true },
 *     { name: 'city', label: 'City', fieldType: 'text', required: true }
 *   ]}
 *   apiConfig={{
 *     apiMethod: 'POST',
 *     apiUrl: '/api/team',
 *     responseKey: 'data'
 *   }}
 *   formButtons={[
 *     { text: 'Save', action: 'submit' },
 *     { text: 'Cancel', action: 'cancel', url: '/list-team' }
 *   ]}
 *   submitSuccessRedirect="/list-team"
 * />
 * 
 * // Edit form
 * <Form
 *   propertiesConfig={[...]}
 *   detailApiConfig={{
 *     apiMethod: 'GET',
 *     apiUrl: '/api/team/:teamId',
 *     responseKey: 'data'
 *   }}
 *   apiConfig={{
 *     apiMethod: 'PUT',
 *     apiUrl: '/api/team/:teamId',
 *     responseKey: 'data'
 *   }}
 *   identifiers="123"
 *   formButtons={[...]}
 *   submitSuccessRedirect="/list-team"
 * />
 * ```
 * 
 * @see {@link FormField} for individual field rendering
 * @see {@link useApi} for API integration
 */

import { Form as AntForm, Spin, Alert } from 'antd';
import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { dayjsCustom } from '../core/dayjs';

import { CreateButtons } from '../core/forms';
import { FormField, IFormField } from '../core/forms';
import type { FormFieldConditionProps } from '../core/forms/FormField/FormField';
import { IForm } from '../core/forms/formConfig';
import { convertColumnsConfigForFormField } from '../core/forms';
import { useParams } from "react-router-dom"
import { useAppContext } from '../core/context/AppContext';
import { substituteUrlParams, getNestedValue } from '../core/utils';
import { FormContainer, FormColumn } from '../core/forms/FormField/components';
import { useResolveBatch } from '../core/hooks/useResolveBatch';
import { useEvaluatedItems } from '../core/hooks/useEvaluatedItems';
import { ConditionalValue, isConditionalValue } from '../core/types/evaluation';
import { conditionEvaluator } from '../core/utils/ConditionEvaluator';
import { useNewEvaluationContext } from '../core/context/NewEvaluationContext';
import { determineColumnLayout, IColumnsConfig } from '../core/forms/shared/utils';
import { ErrorBoundary } from 'react-error-boundary';
import { PageSkeleton } from '../core/common/PageSkeleton';
import { ErrorFallback } from '../core/common';
import { handleApiError } from '../core/utils/api-error-handler';
import { useDebounce } from '../core/hooks/useSelectiveDebounce';
import './Form.css';
import { useOperationExecutor } from '../core/services/OperationExecutor';
import { useThrottleCountdown } from '../core/hooks/useThrottleCountdown';
import { useEntityDetail } from '../core/query/useEntityDetail';

// Stable empty objects to avoid re-creating {} on every render (used as defaults)
const EMPTY_ROUTE_PARAMS: Record<string, string> = {};
const EMPTY_DEFAULT_VALUES: Record<string, any> = {};

/**
 * Extended form configuration with column layout support and state lifting.
 */
interface IFormWithColumnsConfig extends IForm {
  columnsConfig?: IColumnsConfig;
  routeParams?: Record<string, string>;
  entityName?: string;  // From backend config generation
  onDataChange?: (data: { record?: any; formValues?: Record<string, any>; pageType?: string; entityName?: string }) => void;
  /** Loading state configuration (#57) */
  loading?: { type: 'skeleton' | 'spinner'; rows?: number };
  /** Whether form action buttons should stick to the bottom of the viewport (#41). Default: true */
  stickyActions?: boolean;
}

/**
 * Main Form component for creating and editing records.
 * 
 * Provides a complete form solution with data loading, validation, submission,
 * error handling, and multi-column layouts. Supports both create and edit modes.
 * 
 * @param props - Form configuration props
 * @param props.propertiesConfig - Field configurations from backend
 * @param props.apiConfig - API configuration for form submission
 * @param props.detailApiConfig - API configuration for loading existing data (edit mode)
 * @param props.formButtons - Form action buttons (submit, cancel, etc.)
 * @param props.columnsConfig - Multi-column layout configuration
 * @param props.submitSuccessRedirect - URL to redirect to after successful submission
 * @param props.identifiers - Record identifier for edit mode
 * @param props.routeParams - Route parameters for URL substitution
 * @param props.defaultValues - Default values for form fields (from modal navigation, etc.)
 * @param props.entityName - Entity name for context
 * @param props.onDataChange - Callback to lift form state to parent
 * 
 * @returns Rendered form component
 */
export function Form({
  formConfig,
  propertiesConfig = [],
  onSubmit,
  onSubmitSuccessCallback,
  onCancelCallback,
  formButtons = [],
  children,
  apiConfig,
  detailApiConfig,
  submitSuccessRedirect = "",
  submitSuccessRedirectOptions,
  responseConfig,
  dynamicConfigKey,
  refreshParentOnSuccess,
  successMessage,
  errorMessage,
  skipSuccessToast,
  skipErrorToast,
  closeModalOnError,
  notification,
  throttle,
  disabled = false,
  buttonLoader = false,
  identifiers,
  useDynamicIdFromParams = true,
  columnsConfig,
  routeParams = EMPTY_ROUTE_PARAMS,
  defaultValues = EMPTY_DEFAULT_VALUES,
  entityName,  // From backend config
  onDataChange,  // Callback to lift state to wrapper
  helpText,  // Help text to display above form fields
  loading: loadingConfig,  // Loading state configuration (#57)
  stickyActions = true,  // Sticky form action buttons (#41)
}: IFormWithColumnsConfig) {
  const { notifyError, notifySuccess } = useAppContext()

  // Evaluation context for resolving ConditionalValue defaults (#33)
  const evaluationContext = useNewEvaluationContext();

  // Generate STABLE formConfig name - CRITICAL: Must not change across re-renders!
  // Otherwise React will destroy and recreate the form, losing all field errors
  const stableFormConfig = React.useMemo(() => {
    return formConfig || { name: "customForm-" + uuidv4() };
  }, [ formConfig ]);

  // TODO: remove the dynamic-id option from here and use the identifiers prop instead
  const { dynamicID = "" } = useParams()

  const [ formPropertiesConfig, setFormPropertiesConfig ] = useState<IFormField[]>(convertColumnsConfigForFormField(propertiesConfig))
  const identifiersToUse = useDynamicIdFromParams ? dynamicID : identifiers;
  const operationExecutor = useOperationExecutor();
  const { isThrottled, buttonText: throttleText, startPolling: startThrottlePolling } = useThrottleCountdown(
    operationExecutor,
    apiConfig?.apiUrl,
    !!(throttle?.cooldownMs),
    !!(throttle?.showCountdown)
  );
  const [ loader, setLoader ] = useState<boolean>(false)
  const [ btnLoader, setBtnLoader ] = useState<boolean>(false)
  const [ validationErrors, setValidationErrors ] = useState<Array<{ field: string; message: string }>>([]);  // Track validation errors for display

  // Track initial record (for edit mode)
  const [ initialRecord, setInitialRecord ] = useState<any>(null);

  // Track previous values to detect actual changes (not just re-renders)
  const prevFormPropertiesConfigRef = React.useRef<IFormField[] | null>(null);
  const prevDefaultValuesRef = React.useRef<Record<string, any> | null>(null);

  useEffect(() => {
    setLoader(disabled)
  }, [ disabled ])

  useEffect(() => {
    setBtnLoader(buttonLoader)
  }, [ buttonLoader ])

  // Helper: Format item values for form display
  const itemValueFormatter = React.useCallback((item: IFormField, itemValue: any) => {
    if (!itemValue) {
      return itemValue;
    }

    const { name, fieldType, type } = item;

    // Skip list processing for WYSIWYG fields - they store Block[] arrays natively
    // WYSIWYG fields are marked as type: 'list' in schema but don't need item-by-item formatting
    if (type === "map") {
      itemValue = item.properties.reduce((acc, prop: IFormField) => {
        acc[ prop.name ] = itemValueFormatter(prop, itemValue[ prop.name ]);
        return acc;
      }, {});
    }

    if (type === "list" && fieldType && ![ 'wysiwyg', 'rich-text' ].includes(fieldType.toLowerCase())) {
      itemValue = itemValue || [];
      // item.items is { type, properties } — a structural subset of IFormField.
      // Cast is safe: itemValueFormatter only reads type/properties/items/fieldType/name.
      itemValue = itemValue.map((it: unknown) => itemValueFormatter(item.items as IFormField, it));
    }

    if (fieldType === "datetime" || fieldType === "date" || fieldType === "time") {
      // if the value starts with 0, then it is a timestamp and we need to convert it to a date
      if (itemValue.toString().startsWith('0')) {
        itemValue = dayjsCustom.tz(
          new Date(parseInt(itemValue)).toISOString(),
          item.timezone
        );
      } else {
        itemValue = dayjsCustom.tz(
          itemValue,
          item.timezone
        );
      }
    } else if ([ 'boolean', 'toggle', 'switch' ].includes(fieldType)) {
      itemValue = itemValue;
    } else if (fieldType === "color") {
      itemValue = itemValue ?? "#FFA500";
    } else if (fieldType === "json") {
      itemValue = typeof itemValue !== 'string' ? JSON.stringify(itemValue, null, 2) : itemValue;
    }

    return itemValue;
  }, []);

  // Store updated field values for form refresh
  const updatedFieldValuesRef = React.useRef<Record<string, any> | null>(null);

  // Derive entity name from apiUrl for React Query cache keying
  const formEntityName = React.useMemo(() => {
    const url = detailApiConfig?.apiUrl || apiConfig?.apiUrl || entityName || '';
    if (entityName) return entityName;
    const parts = url.split('/').filter(Boolean);
    const lastPart = parts[ parts.length - 1 ] || 'unknown';
    return lastPart.startsWith(':') ? (parts[ parts.length - 2 ] || 'unknown') : lastPart;
  }, [ detailApiConfig?.apiUrl, apiConfig?.apiUrl, entityName ]);

  // ── Declarative data fetching for edit mode via useEntityDetail ──
  const isEditMode = !!(detailApiConfig && (identifiersToUse !== "" || Object.keys(routeParams).length > 0));

  const resolvedEditApiUrl = React.useMemo(() => {
    if (!detailApiConfig?.apiUrl || !isEditMode) return '';
    return substituteUrlParams(detailApiConfig.apiUrl, routeParams, identifiersToUse);
  }, [ detailApiConfig?.apiUrl, routeParams, identifiersToUse, isEditMode ]);

  const editCacheIdentifiers = React.useMemo((): Record<string, string> => {
    const ids: Record<string, string> = {};
    if (identifiersToUse) ids.id = String(identifiersToUse);
    if (routeParams) Object.entries(routeParams).forEach(([ k, v ]) => { ids[ k ] = String(v); });
    return ids;
  }, [ identifiersToUse, routeParams ]);

  const {
    data: editData,
    isLoading: editLoading,
    isFetching: editFetching,
    error: editError,
    refetch: refetchEditData,
  } = useEntityDetail({
    entityName: formEntityName,
    apiConfig: detailApiConfig || { apiUrl: '', apiMethod: 'GET' },
    apiUrl: resolvedEditApiUrl,
    identifiers: editCacheIdentifiers,
    enabled: isEditMode,
    staleTime: 30 * 1000,
  });

  const [ dataLoadedFromView, setDataLoadedFromView ] = useState(!isEditMode);

  // Ref for formPropertiesConfig to use in effects without adding it as a dependency
  const formPropertiesConfigRef = React.useRef(formPropertiesConfig);
  formPropertiesConfigRef.current = formPropertiesConfig;

  // When edit data arrives from the hook, format and update form properties
  useEffect(() => {
    if (!editData || !isEditMode) return;

    setInitialRecord(editData);

    const currentConfig = formPropertiesConfigRef.current;
    const updatedFieldsWithInitialValues = currentConfig.map((item: IFormField) => {
      const fieldPath = item.column || item.name || item.id;
      const itemValue = itemValueFormatter(item, getNestedValue(editData, fieldPath));
      return { ...item, initialValue: itemValue };
    });

    setFormPropertiesConfig(updatedFieldsWithInitialValues);
    setDataLoadedFromView(true);
  }, [ editData, isEditMode, itemValueFormatter ]);

  // Handle edit data fetch errors
  useEffect(() => {
    if (!editError) return;
    const errorResult = handleApiError(editError, 'Failed to load record');
    notifyError(errorResult.formattedErrors.join('\n'));
    setDataLoadedFromView(true);
  }, [ editError, notifyError ]);

  // Create mode: no fetch needed, mark data as loaded immediately
  useEffect(() => {
    if (!isEditMode) {
      setDataLoadedFromView(true);
    }
  }, [ isEditMode ]);

  // AbortController for request cancellation on unmount
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Cleanup on unmount - abort any in-flight requests
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const onFinish = async (values: any) => {
    // Clear ALL previous validation errors before new attempt
    setValidationErrors([]);
    form.setFields(
      formPropertiesConfig.map(field => ({
        name: field.name,
        errors: []
      }))
    );

    // Guardrail: when there's no apiConfig and no custom submit handlers, submission is a silent no-op.
    if (!apiConfig) {
      if (!onSubmit && !onSubmitSuccessCallback) {
        notifyError("No API is configured for this form. Please contact support.");
        return;
      }
      // Call custom handlers directly and return (no API call to make)
      onSubmit && onSubmit(values);
      onSubmitSuccessCallback && onSubmitSuccessCallback(values);
      return;
    }

    // ============================================================================
    // NEW: Using OperationExecutor for centralized operation handling
    // ============================================================================
    if (apiConfig) {
      // Use the clean utility function for URL parameter substitution
      const formattedApiUrl = substituteUrlParams(apiConfig.apiUrl, routeParams, identifiersToUse);

      // ============================================================================
      // Form Data Processing (Dates, JSON, Numbers, Nested Objects)
      // ============================================================================
      const normalizeDateValue = (value: any): string | null => {
        if (value === "" || value === null || value === undefined) {
          return null;
        }

        if (dayjsCustom.isDayjs?.(value)) {
          return value.toISOString();
        }

        if (value instanceof Date) {
          return value.toISOString();
        }

        if (typeof value === "number") {
          const parsed = new Date(value);
          return isNaN(parsed.getTime()) ? null : parsed.toISOString();
        }

        if (typeof value === "string") {
          return value;
        }

        if (typeof value?.toISOString === "function") {
          return value.toISOString();
        }

        return String(value);
      };

      // Recursive function to parse JSON fields and convert data types in nested objects
      const parseJsonFieldsRecursively = (obj: any, config: IFormField[]): any => {
        if (typeof obj !== 'object' || obj === null) {
          return obj;
        }

        const result: any = {};

        for (const [ key, value ] of Object.entries(obj)) {
          // Find the field configuration for this key
          const fieldConfig = config.find(field => field.name === key);

          if (fieldConfig?.fieldType === "json") {
            // Parse JSON field (CodeEditor sends string, we parse to object for backend)
            try {
              result[ key ] = JSON.parse(value as string);
            } catch (error) {
              console.warn("[Form] JSON parsing failed for field:", key, error);
              // If JSON parsing fails, keep the original value
              result[ key ] = value;
            }
          } else if (fieldConfig?.fieldType === "number") {
            // Convert number fields
            if (value === "" || value === null || value === undefined) {
              result[ key ] = null;
            } else {
              const numValue = Number(value);
              result[ key ] = isNaN(numValue) ? value : numValue;
            }
          } else if (fieldConfig?.fieldType === "date") {
            // Convert date fields
            result[ key ] = normalizeDateValue(value);
          } else if (fieldConfig?.fieldType === "time") {
            // Convert time fields
            result[ key ] = normalizeDateValue(value);
          } else if (fieldConfig?.fieldType === "datetime") {
            // Convert datetime fields
            result[ key ] = normalizeDateValue(value);
          } else if (fieldConfig?.fieldType === "boolean" || fieldConfig?.fieldType === "switch" || fieldConfig?.fieldType === "toggle") {
            // Convert boolean/switch/toggle fields
            if (value === "" || value === null || value === undefined) {
              result[ key ] = false;
            } else {
              result[ key ] = Boolean(value);
            }
          } else if (fieldConfig?.type === 'map' && fieldConfig.properties) {
            // Recursively parse nested map fields
            result[ key ] = parseJsonFieldsRecursively(value, fieldConfig.properties);
          } else {
            // Keep other fields as-is
            result[ key ] = value;
          }
        }

        return result;
      };

      // Parse JSON fields recursively in the form values
      const formattedValues = parseJsonFieldsRecursively(values, formPropertiesConfig);

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();

      // Use OperationExecutor for consistent handling
      await operationExecutor.execute(
        {
          apiConfig: {
            ...apiConfig,
            apiUrl: formattedApiUrl,
            payload: formattedValues
          },
          routeParams,
          onLoading: (loading) => {
            setLoader(loading);
            setBtnLoader(loading);
          },
          // Response handling config (now fully supported in forms!)
          successMessage: successMessage || "Saved Successfully",
          errorMessage,
          submitSuccessRedirect,
          submitSuccessRedirectOptions,
          responseConfig,
          dynamicConfigKey,
          refreshParentOnSuccess,
          // Skip toast if:
          // 1. Explicitly set to skip (takes precedence)
          // 2. Response modal will be shown (responseConfig.showModal)
          // 3. Chaining is enabled (dynamicConfigKey) - let the chain complete silently
          skipSuccessToast: skipSuccessToast !== undefined
            ? skipSuccessToast
            : (responseConfig?.showModal || !!dynamicConfigKey),
          skipErrorToast: skipErrorToast ?? true, // Default to true for forms (manual error handling)
          closeModalOnError: closeModalOnError ?? false, // Default to false for forms (keep open for fixes)
          abortSignal: abortControllerRef.current.signal,
          ...(notification && { notification }),
          ...(throttle && { throttle }),
        },
        {
          onSuccess: onSubmitSuccessCallback,
          onClose: onCancelCallback, // Close form/modal after redirect or when operation completes
          onValidationError: (fieldErrors, formErrors) => {
            // Set field-level errors in the form
            if (fieldErrors.length > 0) {
              form.setFields(fieldErrors);
            }

            // Show validation error toast (OperationExecutor skips it because skipErrorToast: true)
            // Only show form-level errors in toast; field-level errors are shown inline
            if (formErrors.length > 0) {
              notifyError(formErrors.join('\n'));
            } else {
              // Generic message if only field-level errors (which are already shown inline)
              notifyError('Please fix validation errors');
            }
          },
          onError: (errorResult) => {
            // Show generic error toast (OperationExecutor skips it because skipErrorToast: true)
            notifyError(errorResult.errorMessage);
          }
        }
      );

      // Start polling cooldown after execution (for countdown display)
      if (throttle?.showCountdown) startThrottlePolling();
    } else {
      // NO API CALL (navigation-only or custom submission)
      // Call onSubmitSuccessCallback directly (for navigation-only modals)
      if (onSubmitSuccessCallback) {
        onSubmitSuccessCallback(values);
      }
    }

    //call when defined
    onSubmit && onSubmit(values)
  }

  // Stable ref for onFinish — avoids cascading re-creations of submit handlers
  const onFinishRef = React.useRef(onFinish);
  onFinishRef.current = onFinish;

  const [ form ] = AntForm.useForm();

  // Ref to hold the latest condition evaluation results for fields.
  // Used in submit handlers (defined before conditionPropsMap) to skip
  // validation of condition-hidden/disabled fields.
  const conditionPropsMapRef = React.useRef<FormFieldConditionProps[]>([]);

  /**
   * IMPORTANT (2026-01):
   * In some environments we run React 19 with antd v5 (see console warning).
   * We've observed cases where clicking a <Button htmlType="submit"> triggers a native
   * form submit event but does NOT reliably trigger antd's `onFinish` callback.
   *
   * To avoid a "Submit does nothing" UX, we:
   * 1. Wrap submit buttons in `formButtons` to explicitly call `form.validateFields()`
   * 2. Intercept native form submit events via `onSubmitCapture` for child submit buttons
   *    (e.g., auth forms that render their own submit button as children)
   *
   * This keeps behavior consistent regardless of the underlying submit event plumbing.
   */

  // Shared validation + submission logic used by both native form submit and explicit button clicks.
  // Uses refs for unstable dependencies (onFinish, formPropertiesConfig) to keep the callback stable.
  const validateAndSubmit = React.useCallback(async () => {
    setValidationErrors([]);
    try {
      // Only validate fields that are NOT condition-hidden or condition-disabled.
      // This prevents required-but-hidden fields from blocking form submission.
      const currentConditionProps = conditionPropsMapRef.current;
      const activeFieldNames = formPropertiesConfigRef.current
        .filter((_: any, i: number) => {
          const cp = currentConditionProps[ i ];
          return !cp?.conditionHidden && !cp?.conditionDisabled;
        })
        .map((f: any) => f.name)
        .filter(Boolean);

      // Validate only active (non-hidden, non-disabled) fields
      if (activeFieldNames.length > 0) {
        await form.validateFields(activeFieldNames);
      }
      // Get ALL field values (including hidden/disabled) for submission.
      // validateFields() only returns validated fields, so we use getFieldsValue(true)
      // to include condition-hidden fields whose values should still be submitted.
      const values = form.getFieldsValue(true);
      await onFinishRef.current(values);
    } catch (err: any) {
      if (err?.errorFields?.length > 0) {
        const getFieldLabel = (fieldPath: string[]): string => {
          const fieldName = fieldPath.join('.');
          const fieldConfig = formPropertiesConfigRef.current.find((f: any) => f.name === fieldName || f.id === fieldName);
          const lbl = fieldConfig?.label;
          return (typeof lbl === 'string' ? lbl : '') || fieldConfig?.name || fieldName;
        };
        const errors = err.errorFields.map((f: any) => {
          const fieldLabel = getFieldLabel(f.name || []);
          let message = f.errors?.join(', ') || 'This field is required';
          message = message.replace(/undefined/gi, '');
          return { field: fieldLabel, message };
        });
        setValidationErrors(errors);
        const firstErrorField = err.errorFields[ 0 ]?.name;
        if (firstErrorField) {
          form.scrollToField(firstErrorField, { behavior: 'smooth', block: 'center' });
        }
        notifyError(`Please fix ${errors.length} validation error${errors.length > 1 ? 's' : ''} before submitting.`);
      }
    }
  }, [ form, notifyError ]);

  // React 19 + antd v5 workaround: intercept native form submit for child buttons
  // that use htmlType="submit" (e.g., OTP login, password reset forms).
  // This fires during the capture phase, before antd's own handler.
  const handleNativeFormSubmit = React.useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    await validateAndSubmit();
  }, [ validateAndSubmit ]);

  const effectiveFormButtons = useMemo(() => {
    const isSubmit = (btn: any): boolean => {
      if (typeof btn === 'string') return btn === 'submit';
      if (!btn || typeof btn !== 'object') return false;
      if (btn.action === 'submit') return true;
      if (btn.id === 'submit') return true;
      if (btn.htmlType === 'submit') return true;
      return false;
    };

    return (formButtons || []).map((btn: any) => {
      if (!isSubmit(btn)) return btn;

      // For string buttons (e.g., "submit"), convert to object with action property
      // Buttons.tsx will merge this with PreDefinedButtons to get text, styles, etc.
      if (typeof btn === 'string') {
        return { action: btn, htmlType: 'button', onClick: validateAndSubmit };
      }

      // For object buttons, preserve existing config and override onClick
      return { ...btn, htmlType: 'button', onClick: validateAndSubmit };
    });
  }, [ formButtons, validateAndSubmit ]);

  // Apply refreshed values to form (when edit data refetch completes)
  useEffect(() => {
    if (updatedFieldValuesRef.current) {
      form.setFieldsValue(updatedFieldValuesRef.current);
      updatedFieldValuesRef.current = null; // Clear after applying
    }
  }, [ form, editFetching ]);

  // Watch form values
  const formValues = AntForm.useWatch([], form) || form.getFieldsValue(true);

  // NEW: Determine pageType from initialRecord
  const pageType = useMemo(() => {
    return initialRecord ? 'edit' : 'create';
  }, [ initialRecord ]);

  // NEW: Debounce formValues LOCALLY to avoid effect running on every keystroke
  const debouncedFormValues = useDebounce(formValues, 200);

  // Lift form state to wrapper (if callback provided)
  useEffect(() => {
    if (!onDataChange) return;

    onDataChange({
      record: initialRecord,
      formValues: debouncedFormValues || {},
      pageType,
      entityName
    });
  }, [ initialRecord, debouncedFormValues, pageType, entityName, onDataChange ]);

  // ── Condition evaluation for form fields ──
  // Batch evaluate visibility, enablement, and resolve ConditionalValue fields for all fields.
  const rendererValues = useMemo(
    () => formPropertiesConfig.map(item => item.renderer as string | ConditionalValue<string> | undefined),
    [ formPropertiesConfig ]
  );
  const labelValues = useMemo(
    () => formPropertiesConfig.map(item => item.label as string | ConditionalValue<string> | undefined),
    [ formPropertiesConfig ]
  );
  const placeholderValues = useMemo(
    () => formPropertiesConfig.map(item => item.placeholder as string | ConditionalValue<string> | undefined),
    [ formPropertiesConfig ]
  );
  const helpTextValues = useMemo(
    () => formPropertiesConfig.map(item => item.helpText as string | ConditionalValue<string> | undefined),
    [ formPropertiesConfig ]
  );

  const { getItemProps: getFieldConditionProps } = useEvaluatedItems(formPropertiesConfig);
  const resolvedRenderers = useResolveBatch<string>(rendererValues);
  const resolvedLabels = useResolveBatch<string>(labelValues);
  const resolvedPlaceholders = useResolveBatch<string>(placeholderValues);
  const resolvedHelpTexts = useResolveBatch<string>(helpTextValues);

  // Build condition props for each field
  const conditionPropsMap = useMemo(() => {
    return formPropertiesConfig.map((_: unknown, i: number): FormFieldConditionProps => {
      const cProps = getFieldConditionProps(i);
      const props: FormFieldConditionProps = {};
      if (cProps.conditionHidden) {
        props.conditionHidden = true;
      }
      if (cProps.conditionDisabled) {
        props.conditionDisabled = true;
        props.conditionDisabledMessage = cProps.conditionDisabledMessage;
      }
      if (resolvedRenderers[ i ] !== undefined) {
        props.resolvedRenderer = resolvedRenderers[ i ] as string;
      }
      if (resolvedLabels[ i ] !== undefined) {
        props.resolvedLabel = resolvedLabels[ i ] as string;
      }
      if (resolvedPlaceholders[ i ] !== undefined) {
        props.resolvedPlaceholder = resolvedPlaceholders[ i ] as string;
      }
      if (resolvedHelpTexts[ i ] !== undefined) {
        props.resolvedHelpText = resolvedHelpTexts[ i ] as string;
      }
      return props;
    });
  }, [ getFieldConditionProps, resolvedRenderers, resolvedLabels, resolvedPlaceholders, resolvedHelpTexts, formPropertiesConfig ]);

  // Keep the ref in sync so submit handlers can read the latest condition state
  conditionPropsMapRef.current = conditionPropsMap;

  // Determine columns to render
  // Keep condition-hidden fields (they render as hidden Form.Item to preserve values)
  let columns: IFormField[][] = [];
  const items = formPropertiesConfig.filter((item, idx) => {
    // If there's a visibility condition, always include (FormField handles hidden rendering)
    if (item.visibility !== undefined) return true;
    // Otherwise, use legacy static hidden check
    return !item.hidden;
  });

  // Map from filtered items back to original formPropertiesConfig indices
  const itemOriginalIndices: number[] = [];
  formPropertiesConfig.forEach((item, idx) => {
    if (item.visibility !== undefined || !item.hidden) {
      itemOriginalIndices.push(idx);
    }
  });

  // Special case: if we have only one item and it's a map with many properties, 
  // create multiple columns for the nested properties
  if (items.length === 1 && items[ 0 ].type === 'map' && items[ 0 ].properties && items[ 0 ].properties.length > 3) {
    const nestedProperties = items[ 0 ].properties.filter(prop => !prop.hidden);
    const nestedColumns = determineColumnLayout(nestedProperties, undefined, 2);

    // Create separate columns for each group of nested properties
    // Don't show the main label in each column to avoid redundancy
    columns = nestedColumns.map(columnProps => [ {
      ...items[ 0 ],
      properties: columnProps,
    } ]);
  } else {
    columns = determineColumnLayout(items, columnsConfig, columnsConfig?.numColumns || 2);
  }

  const renderFormField = (item: IFormField, index: number) => {
    // Find original index to get condition props
    const filteredIdx = items.indexOf(item);
    const originalIdx = filteredIdx >= 0 ? itemOriginalIndices[ filteredIdx ] : index;
    const condProps = conditionPropsMap[ originalIdx ] || {};

    return (
      <React.Fragment key={"fe" + index}>
        <FormField {...item} {...condProps} setFormValue={(newValue: { name: string, value: string | object, index?: number }) => {
          if (newValue.index !== undefined && typeof newValue.value === "object") {
            const currentValue = form.getFieldValue(newValue.name) || [];
            form.setFieldsValue({
              [ newValue.name ]: [
                ...currentValue.slice(0, newValue.index),
                { ...currentValue[ newValue.index ], ...newValue.value },
                ...currentValue.slice(newValue.index + 1)
              ]
            })
          } else {
            form.setFieldsValue({ [ newValue.name ]: newValue.value })
          }
        }} />
      </React.Fragment>
    );
  };

  // Set initial form values - run when data loads OR when props actually change
  // CRITICAL: Must detect actual changes vs re-renders to preserve user input after validation errors
  useEffect(() => {
    if (!dataLoadedFromView) {
      return; // Wait for data to load
    }

    // Check if formPropertiesConfig actually changed (not just a re-render)
    const formPropsChanged = prevFormPropertiesConfigRef.current !== null &&
      JSON.stringify(prevFormPropertiesConfigRef.current) !== JSON.stringify(formPropertiesConfig);

    // Check if defaultValues actually changed
    const defaultValuesChanged = prevDefaultValuesRef.current !== null &&
      JSON.stringify(prevDefaultValuesRef.current) !== JSON.stringify(defaultValues);

    // Only update if this is the first run OR if values actually changed
    const isFirstRun = prevFormPropertiesConfigRef.current === null;
    const shouldUpdate = isFirstRun || formPropsChanged || defaultValuesChanged;

    if (shouldUpdate) {
      //loop over formPropertiesConfig and create an object where key is the name of the field and value is the value of the field
      //this is used to set the initial values of the form

      // Recursive function to extract initial/default values from nested structures
      // Priority: initialValue (from API in edit mode) > defaultValue (schema default)
      // Resolve a defaultValue that may be a ConditionalValue (#33)
      const resolveDefault = (val: any): any => {
        if (val === undefined || val === null) return val;
        if (isConditionalValue(val)) {
          return conditionEvaluator.resolveValue(val, evaluationContext);
        }
        return val;
      };

      const extractDefaultValues = (fields: any[]): any => {
        return fields.reduce((acc, item) => {
          // For map fields with nested properties, recursively extract values
          if (item.type === 'map' && item.properties && item.properties.length > 0) {
            // If we have initialValue for this map (from API), use it
            if (item.initialValue !== undefined) {
              acc[ item.name ] = item.initialValue;
            } else {
              // Otherwise, recursively extract from nested properties
              const nestedDefaults = extractDefaultValues(item.properties);
              // Only set if there are actual values in nested properties
              if (Object.keys(nestedDefaults).length > 0) {
                acc[ item.name ] = nestedDefaults;
              }
            }
          }
          // For list fields, use initialValue first, then defaultValue
          else if (item.type === 'list') {
            if (item.initialValue !== undefined) {
              acc[ item.name ] = item.initialValue;
            } else if (item.defaultValue !== undefined) {
              acc[ item.name ] = resolveDefault(item.defaultValue);
            }
          }
          // For regular fields, prioritize initialValue over defaultValue
          else if (item.initialValue !== undefined || item.defaultValue !== undefined) {
            acc[ item.name ] = item.initialValue ?? resolveDefault(item.defaultValue);
          }

          return acc;
        }, {});
      };

      const initialValues = extractDefaultValues(formPropertiesConfig);

      // Merge with defaultValues (from modal navigation or other sources)
      // defaultValues take precedence over initialValues
      const mergedValues = { ...initialValues, ...defaultValues };

      form.setFieldsValue(mergedValues);

      // Update refs to track current values
      prevFormPropertiesConfigRef.current = formPropertiesConfig;
      prevDefaultValuesRef.current = defaultValues;
    }
  }, [ dataLoadedFromView, formPropertiesConfig, defaultValues, form ])


  return (
    <>
      {!dataLoadedFromView ? (
        loadingConfig?.type === 'spinner'
          ? <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin size="large" /></div>
          : <PageSkeleton type="form" rows={loadingConfig?.rows || formPropertiesConfig?.length || 6} />
      ) : (
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={() => {
            // Reset form state and refetch data on error boundary reset
            setValidationErrors([]);
            if (isEditMode) {
              refetchEditData();
            }
          }}
        >
          <AntForm
            key={`form-${stableFormConfig.name}`}
            form={form}
            {...stableFormConfig}
            layout="vertical"
            onSubmitCapture={handleNativeFormSubmit}
            disabled={loader}
          >
            {helpText && (
              <Alert
                message={helpText}
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />
            )}
            {columns.length > 1 ? (
              <FormContainer>
                {columns.map((columnItems, colIdx) => (
                  <FormColumn key={colIdx}>
                    {columnItems.map(renderFormField)}
                  </FormColumn>
                ))}
              </FormContainer>
            ) : columns.length === 1 && columns[ 0 ] ? (
              <div style={{ maxWidth: 600 }}>
                {columns[ 0 ].map(renderFormField)}
              </div>
            ) : null}
            {children}
            {/* Display validation errors above buttons */}
            {validationErrors.length > 0 && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 16, marginTop: 16 }}
                message={`${validationErrors.length} validation error${validationErrors.length > 1 ? 's' : ''}`}
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {validationErrors.map((err, idx) => (
                      <li key={idx}>
                        <strong>{err.field}:</strong> {err.message}
                      </li>
                    ))}
                  </ul>
                }
              />
            )}
            {effectiveFormButtons.length > 0 && (
              <div className={stickyActions ? 'form-actions-sticky' : undefined} style={{ paddingLeft: 10, paddingRight: 10 }}>
                <CreateButtons formButtons={effectiveFormButtons} loader={btnLoader} routeParams={routeParams} onCancelCallback={onCancelCallback} throttleText={isThrottled ? throttleText : undefined} isThrottled={isThrottled} />
              </div>
            )}
          </AntForm>
        </ErrorBoundary>
      )}
    </>
  );
};