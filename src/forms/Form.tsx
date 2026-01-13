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

import { Form as AntForm, Spin, Skeleton, Alert } from 'antd';
import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { dayjsCustom } from '../core/dayjs';

import { CreateButtons } from '../core/forms';
import { useNavigate } from 'react-router-dom';
import { FormField, IFormField } from '../core/forms';
import { IForm } from '../core/forms/formConfig';
import { useApi } from '../core/context';
//import { CreateButtons, FieldOptionsAPIConfig, fetchFieldOptions, isFieldOptionsAPIConfig } from '../core/forms';
import { convertColumnsConfigForFormField } from '../core/forms';
import { useParams } from "react-router-dom"
import { useAppContext } from '../core/context/AppContext';
import { substituteUrlParams, getNestedValue } from '../core/utils';
import { FormContainer, FormColumn } from '../core/forms/FormField/components';
import { formStyles } from '../core/forms/FormField/styles';
import { determineColumnLayout, IColumnsConfig, splitIntoColumns } from '../core/forms/shared/utils';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '../core/common';
import { handleApiError } from '../core/utils/api-error-handler';
import { useDebounce } from '../core/hooks/useSelectiveDebounce';
import './Form.css';
import { useCoreNavigator } from '../routes/Navigation';

/**
 * Extended form configuration with column layout support and state lifting.
 */
interface IFormWithColumnsConfig extends IForm {
  columnsConfig?: IColumnsConfig;
  routeParams?: Record<string, string>;
  entityName?: string;  // From backend config generation
  onDataChange?: (data: { record?: any; formValues?: Record<string, any>; pageType?: string; entityName?: string }) => void;
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
  disabled = false,
  buttonLoader = false,
  identifiers,
  useDynamicIdFromParams = true,
  columnsConfig,
  routeParams = {},
  defaultValues = {},
  entityName,  // From backend config
  onDataChange,  // Callback to lift state to wrapper
  helpText,  // Help text to display above form fields
}: IFormWithColumnsConfig) {
  const navigate = useCoreNavigator();

  const { notifyError, notifySuccess } = useAppContext()

  // Generate STABLE formConfig name - CRITICAL: Must not change across re-renders!
  // Otherwise React will destroy and recreate the form, losing all field errors
  const stableFormConfig = React.useMemo(() => {
    return formConfig || { name: "customForm-" + uuidv4() };
  }, [ formConfig ]);

  // TODO: remove the dynamic-id option from here and use the identifiers prop instead
  const { dynamicID = "" } = useParams()

  const [ formPropertiesConfig, setFormPropertiesConfig ] = useState<IFormField[]>(convertColumnsConfigForFormField(propertiesConfig))
  const [ dataLoadedFromView, setDataLoadedFromView ] = useState((identifiers || (useDynamicIdFromParams && dynamicID) || Object.keys(routeParams).length > 0) ? false : true)
  const { callApiMethod } = useApi();
  const [ loader, setLoader ] = useState<boolean>(false)
  const [ btnLoader, setBtnLoader ] = useState<boolean>(false)
  const [ isRefreshing, setIsRefreshing ] = useState<boolean>(false)  // Separate loading state for refresh
  const [ identifiersToUse, setIdentifiersToUse ] = useState<string | number | undefined>(useDynamicIdFromParams ? dynamicID : identifiers);
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

  useEffect(() => {
    if (useDynamicIdFromParams) {
      setIdentifiersToUse(dynamicID);
    } else {
      setIdentifiersToUse(identifiers);
    }
  }, [ identifiers, dynamicID ])

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
      itemValue = itemValue.map(it => itemValueFormatter(item.items as any, it));
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

  // Standard data fetch function (can be called on mount or on-demand)
  const loadAndFormatData = React.useCallback(async (showLoader = true) => {
    if (showLoader) {
      setIsRefreshing(true);
      setLoader(true);
    }

    // if the page has api-config and record identifier or route params, then fetch the record and update the form-fields with initial values.
    const shouldFetchRecord = detailApiConfig && (identifiersToUse !== "" || Object.keys(routeParams).length > 0);

    let recordData = {};
    if (shouldFetchRecord) {
      try {
        let apiUrl = detailApiConfig.apiUrl;

        // Use the clean utility function for URL parameter substitution
        apiUrl = substituteUrlParams(apiUrl, routeParams, identifiersToUse);

        const response: any = await callApiMethod({ ...detailApiConfig, apiUrl });

        if (response.status === 200) {
          const detailResponse = detailApiConfig.responseKey ? response.data[ detailApiConfig.responseKey ] : response.data;

          // Store initial record for state lifting
          setInitialRecord(detailResponse);
          recordData = detailResponse;
        } else {
          // Handle error response using consolidated error handler
          const errorResult = handleApiError(response, 'Failed to load record');
          notifyError(errorResult.formattedErrors.join('\n'));
        }
      } catch (error: any) {
        // Handle network errors or other exceptions using consolidated error handler
        const errorResult = handleApiError(error, 'Failed to load record');
        notifyError(errorResult.formattedErrors.join('\n'));
      }
    }

    if (recordData && Object.keys(recordData).length > 0) {
      const updatedFieldsWithInitialValues = formPropertiesConfig.map((item: IFormField) => {
        const fieldPath = item.column || item.name || item.id;
        // Use getNestedValue to handle dot-notation paths (e.g., 'leaguesConfig.enabled')
        const itemValue = itemValueFormatter(item, getNestedValue(recordData, fieldPath))
        return { ...item, initialValue: itemValue }
      });

      setFormPropertiesConfig(updatedFieldsWithInitialValues);

      // Store values for form update (applied after form is available)
      // Use showLoader param, not isRefreshing state (which is stale in async context)
      if (showLoader) {
        const refreshedValues = updatedFieldsWithInitialValues.reduce((acc, item) => {
          acc[ item.name ] = item.initialValue;
          return acc;
        }, {});
        updatedFieldValuesRef.current = refreshedValues;
      }
    }

    setLoader(false);
    setIsRefreshing(false);
    setDataLoadedFromView(true);
  }, [ detailApiConfig, identifiersToUse, routeParams, callApiMethod, notifyError, formPropertiesConfig, itemValueFormatter ]);

  // Initial load
  useEffect(() => {
    loadAndFormatData(false);  // Don't show refresh loader on initial load
  }, [])

  const onFinish = async (values: any) => {
    // Clear validation errors on successful form submission attempt
    setValidationErrors([]);

    // Guardrail: when there's no apiConfig and no custom submit handlers, submission is a silent no-op.
    if (!apiConfig) {
      if (!onSubmit && !onSubmitSuccessCallback) {
        notifyError("No API is configured for this form. Please contact support.");
      }
      // Still allow custom handlers (if present) to run below.
    }

    if (apiConfig) {
      setLoader(true)
      setBtnLoader(true)

      // Use the clean utility function for URL parameter substitution
      const formattedApiUrl = substituteUrlParams(apiConfig.apiUrl, routeParams, identifiersToUse);

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
            // Parse JSON field
            try {
              result[ key ] = JSON.parse(value as string);
            } catch (error) {
              console.log("JSON parsing failed for", {
                error,
                field: key,
                value: value
              });
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
            if (value === "" || value === null || value === undefined) {
              result[ key ] = null;
            } else {
              result[ key ] = value; // Keep as string for API compatibility
            }
          } else if (fieldConfig?.fieldType === "time") {
            // Convert time fields
            if (value === "" || value === null || value === undefined) {
              result[ key ] = null;
            } else {
              result[ key ] = value; // Keep as string for API compatibility
            }
          } else if (fieldConfig?.fieldType === "datetime") {
            // Convert datetime fields
            if (value === "" || value === null || value === undefined) {
              result[ key ] = null;
            } else {
              result[ key ] = value; // Keep as string for API compatibility
            }
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

      try {
        const response: any = await callApiMethod({
          ...apiConfig,
          apiUrl: formattedApiUrl,
          payload: formattedValues
        });

        if (response.status === 200) {
          notifySuccess("Saved Successfully")
          if (submitSuccessRedirect !== "") {
            //redirect to the page
            // replace placeholders with the actual values
            let formattedSubmitSuccessRedirect = substituteUrlParams(submitSuccessRedirect, routeParams, identifiersToUse);
            navigate(formattedSubmitSuccessRedirect)
          }
          onSubmitSuccessCallback && onSubmitSuccessCallback(response)
        } else if (response.status >= 400 && response.status < 600) {

          // Handle error response using consolidated error handler
          const errorResult = handleApiError(response, 'An error occurred');

          if (errorResult.isValidationError && errorResult.validationErrors) {
            // Set field-level errors in the form
            if (errorResult.validationErrors.fieldErrors.length > 0) {
              form.setFields(errorResult.validationErrors.fieldErrors);
            }

            // Show form-level errors as toast
            if (errorResult.validationErrors.formErrors.length > 0) {
              notifyError(errorResult.validationErrors.formErrors.join('; '));
            } else if (errorResult.validationErrors.fieldErrors.length > 0) {
              // Show specific field errors in toast as well (field errors also shown inline)
              const fieldErrorMessages = errorResult.validationErrors.fieldErrors.map(fe => {
                const fieldName = Array.isArray(fe.name) ? fe.name.join('.') : fe.name;
                return `${fieldName}: ${fe.errors[ 0 ]}`;
              });
              notifyError(fieldErrorMessages.join('\n'));
            } else {
              // Fallback to generic error message
              notifyError(errorResult.errorMessage);
            }
          } else {
            // Not a validation error, just show the error message
            notifyError(errorResult.errorMessage);
          }
        }
      } catch (error: any) {

        // Handle network errors or other exceptions using consolidated error handler
        const errorResult = handleApiError(error, 'An unexpected error occurred');

        if (errorResult.isValidationError && errorResult.validationErrors) {
          // Set field-level errors
          if (errorResult.validationErrors.fieldErrors.length > 0) {
            form.setFields(errorResult.validationErrors.fieldErrors);
          }

          // Show form-level errors
          if (errorResult.validationErrors.formErrors.length > 0) {
            notifyError(errorResult.validationErrors.formErrors.join('; '));
          } else if (errorResult.validationErrors.fieldErrors.length > 0) {
            // Show specific field errors in toast as well (field errors also shown inline)
            const fieldErrorMessages = errorResult.validationErrors.fieldErrors.map(fe => {
              const fieldName = Array.isArray(fe.name) ? fe.name.join('.') : fe.name;
              return `${fieldName}: ${fe.errors[ 0 ]}`;
            });
            notifyError(fieldErrorMessages.join('\n'));
          } else {
            notifyError(errorResult.errorMessage);
          }
        } else {
          // Non-validation error (network error, 404, 500, etc.)
          notifyError(errorResult.errorMessage);
        }
      } finally {
        setBtnLoader(false)
        setLoader(false)
      }
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

  const [ form ] = AntForm.useForm();

  /**
   * IMPORTANT (2026-01):
   * In some environments we run React 19 with antd v5 (see console warning).
   * We've observed cases where clicking a <Button htmlType="submit"> triggers a native
   * form submit event but does NOT reliably trigger antd's `onFinish` callback.
   *
   * To avoid a "Submit does nothing" UX, we wrap the submit button to explicitly
   * call `form.validateFields()` and then invoke our `onFinish` handler.
   *
   * This keeps behavior consistent regardless of the underlying submit event plumbing.
   */
  const effectiveFormButtons = useMemo(() => {
    const isSubmit = (btn: any): boolean => {
      if (typeof btn === 'string') return btn === 'submit';
      if (!btn || typeof btn !== 'object') return false;
      if (btn.action === 'submit') return true;
      if (btn.id === 'submit') return true;
      if (btn.htmlType === 'submit') return true;
      return false;
    };

    // Shared click handler for submit buttons - validates form and calls onFinish
    const handleSubmitClick = async () => {
      setValidationErrors([]);
      try {
        const values = await form.validateFields();
        await onFinish(values);
      } catch (err: any) {
        if (err?.errorFields?.length > 0) {
          const getFieldLabel = (fieldPath: string[]): string => {
            const fieldName = fieldPath.join('.');
            const fieldConfig = formPropertiesConfig.find(f => f.name === fieldName || f.id === fieldName);
            return fieldConfig?.label || fieldConfig?.name || fieldName;
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
    };

    return (formButtons || []).map((btn: any) => {
      if (!isSubmit(btn)) return btn;

      // For string buttons (e.g., "submit"), convert to object with action property
      // Buttons.tsx will merge this with PreDefinedButtons to get text, styles, etc.
      if (typeof btn === 'string') {
        return { action: btn, htmlType: 'button', onClick: handleSubmitClick };
      }

      // For object buttons, preserve existing config and override onClick
      return { ...btn, htmlType: 'button', onClick: handleSubmitClick };
    });
  }, [ formButtons, form, onFinish, formPropertiesConfig, notifyError ]);

  // Apply refreshed values to form (when refresh completes)
  useEffect(() => {
    if (updatedFieldValuesRef.current) {
      form.setFieldsValue(updatedFieldValuesRef.current);
      updatedFieldValuesRef.current = null; // Clear after applying
    }
  }, [ form, isRefreshing ]);

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

  // Determine columns to render
  let columns: IFormField[][] = [];
  const items = formPropertiesConfig.filter(item => !item.hidden);

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

  const renderFormField = (item: IFormField, index: number) => (
    <React.Fragment key={"fe" + index}>
      <FormField {...item} setFormValue={(newValue: { name: string, value: string | object, index?: number }) => {
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
              acc[ item.name ] = item.defaultValue;
            }
          }
          // For regular fields, prioritize initialValue over defaultValue
          else if (item.initialValue !== undefined || item.defaultValue !== undefined) {
            acc[ item.name ] = item.initialValue ?? item.defaultValue;
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
        // Show skeleton loader on initial load for instant page transition
        <div>
          <Skeleton active paragraph={{ rows: 10 }} />
        </div>
      ) : (
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={() => {
            // Reset form state on error boundary reset
            setValidationErrors([]);
          }}
        >
          <AntForm
            key={`form-${stableFormConfig.name}`}
            form={form}
            {...stableFormConfig}
            layout="vertical"
            onFinish={onFinish}
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
            ) : (
              <div style={{ maxWidth: 600 }}>
                {columns[ 0 ].map(renderFormField)}
              </div>
            )}
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
              <div style={{ display: "flex" }}>
                <CreateButtons formButtons={effectiveFormButtons} loader={btnLoader} routeParams={routeParams} onCancelCallback={onCancelCallback} />
              </div>
            )}
          </AntForm>
        </ErrorBoundary>
      )}
    </>
  );
};