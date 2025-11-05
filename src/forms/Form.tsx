import { Form as AntForm, Spin } from 'antd';
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

// Extend IForm to accept columnsConfig
interface IFormWithColumnsConfig extends IForm {
  columnsConfig?: IColumnsConfig;
  routeParams?: Record<string, string>;
  entityName?: string;  // From backend config generation
  onDataChange?: (data: { record?: any; formValues?: Record<string, any>; pageType?: string; entityName?: string }) => void;
}

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
}: IFormWithColumnsConfig) {
  const navigate = useNavigate();
  const { notifyError, notifySuccess } = useAppContext()
  
  // Generate STABLE formConfig name - CRITICAL: Must not change across re-renders!
  // Otherwise React will destroy and recreate the form, losing all field errors
  const stableFormConfig = React.useMemo(() => {
    return formConfig || { name: "customForm-" + uuidv4() };
  }, [formConfig]);

  // TODO: remove the dynamic-id option from here and use the identifiers prop instead
  const { dynamicID = "" } = useParams()

  const [ formPropertiesConfig, setFormPropertiesConfig ] = useState<IFormField[]>(convertColumnsConfigForFormField(propertiesConfig))
  const [ dataLoadedFromView, setDataLoadedFromView ] = useState((identifiers || (useDynamicIdFromParams && dynamicID) || Object.keys(routeParams).length > 0) ? false : true)
  const { callApiMethod } = useApi();
  const [ loader, setLoader ] = useState<boolean>(false)
  const [ btnLoader, setBtnLoader ] = useState<boolean>(false)
  const [ isRefreshing, setIsRefreshing ] = useState<boolean>(false)  // Separate loading state for refresh
  const [ identifiersToUse, setIdentifiersToUse ] = useState<string | number | undefined>(useDynamicIdFromParams ? dynamicID : identifiers);
  
  // Track initial record (for edit mode)
  const [initialRecord, setInitialRecord] = useState<any>(null);
  
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

    if (type === "map") {
      itemValue = item.properties.reduce((acc, prop: IFormField) => {
        acc[ prop.name ] = itemValueFormatter(prop, itemValue[ prop.name ]);
        return acc;
      }, {});
    }

    if (type === "list") {
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
          notifyError(response.message || response.error || 'An unexpected error occurred');
        }
      } catch (error: any) {
        notifyError(error?.message || 'An unexpected error occurred');
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
  }, [detailApiConfig, identifiersToUse, routeParams, callApiMethod, notifyError, formPropertiesConfig, itemValueFormatter]);
  
  // Initial load
  useEffect(() => {
    loadAndFormatData(false);  // Don't show refresh loader on initial load
  }, [])

  const onFinish = async (values: any) => {
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
        
        for (const [key, value] of Object.entries(obj)) {
          // Find the field configuration for this key
          const fieldConfig = config.find(field => field.name === key);
          
          if (fieldConfig?.fieldType === "json") {
            // Parse JSON field
            try {
              result[key] = JSON.parse(value as string);
            } catch (error) {
              console.log("JSON parsing failed for", {
                error,
                field: key,
                value: value
              });
              // If JSON parsing fails, keep the original value
              result[key] = value;
            }
          } else if (fieldConfig?.fieldType === "number") {
            // Convert number fields
            if (value === "" || value === null || value === undefined) {
              result[key] = null;
            } else {
              const numValue = Number(value);
              result[key] = isNaN(numValue) ? value : numValue;
            }
          } else if (fieldConfig?.fieldType === "date") {
            // Convert date fields
            if (value === "" || value === null || value === undefined) {
              result[key] = null;
            } else {
              result[key] = value; // Keep as string for API compatibility
            }
          } else if (fieldConfig?.fieldType === "time") {
            // Convert time fields
            if (value === "" || value === null || value === undefined) {
              result[key] = null;
            } else {
              result[key] = value; // Keep as string for API compatibility
            }
          } else if (fieldConfig?.fieldType === "datetime") {
            // Convert datetime fields
            if (value === "" || value === null || value === undefined) {
              result[key] = null;
            } else {
              result[key] = value; // Keep as string for API compatibility
            }
          } else if (fieldConfig?.fieldType === "boolean" || fieldConfig?.fieldType === "switch" || fieldConfig?.fieldType === "toggle") {
            // Convert boolean/switch/toggle fields
            if (value === "" || value === null || value === undefined) {
              result[key] = false;
            } else {
              result[key] = Boolean(value);
            }
          } else if (fieldConfig?.type === 'map' && fieldConfig.properties) {
            // Recursively parse nested map fields
            result[key] = parseJsonFieldsRecursively(value, fieldConfig.properties);
          } else {
            // Keep other fields as-is
            result[key] = value;
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
                return `${fieldName}: ${fe.errors[0]}`;
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
              return `${fieldName}: ${fe.errors[0]}`;
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
  
  // Apply refreshed values to form (when refresh completes)
  useEffect(() => {
    if (updatedFieldValuesRef.current) {
      form.setFieldsValue(updatedFieldValuesRef.current);
      updatedFieldValuesRef.current = null; // Clear after applying
    }
  }, [form, isRefreshing]);
  
  // Watch form values
  const formValues = AntForm.useWatch([], form) || form.getFieldsValue(true);
  
  // NEW: Determine pageType from initialRecord
  const pageType = useMemo(() => {
    return initialRecord ? 'edit' : 'create';
  }, [initialRecord]);
  
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
  }, [initialRecord, debouncedFormValues, pageType, entityName, onDataChange]);
  
  // Determine columns to render
  let columns: IFormField[][] = [];
  const items = formPropertiesConfig.filter(item => !item.hidden);
  
  // Special case: if we have only one item and it's a map with many properties, 
  // create multiple columns for the nested properties
  if (items.length === 1 && items[0].type === 'map' && items[0].properties && items[0].properties.length > 3) {
    const nestedProperties = items[0].properties.filter(prop => !prop.hidden);
    const nestedColumns = determineColumnLayout(nestedProperties, undefined, 2);
    
    // Create separate columns for each group of nested properties
    // Don't show the main label in each column to avoid redundancy
    columns = nestedColumns.map(columnProps => [{
      ...items[0],
      properties: columnProps,
    }]);
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
              acc[item.name] = item.initialValue;
            } else {
              // Otherwise, recursively extract from nested properties
              const nestedDefaults = extractDefaultValues(item.properties);
              // Only set if there are actual values in nested properties
              if (Object.keys(nestedDefaults).length > 0) {
                acc[item.name] = nestedDefaults;
              }
            }
          }
          // For list fields, use initialValue first, then defaultValue
          else if (item.type === 'list') {
            if (item.initialValue !== undefined) {
              acc[item.name] = item.initialValue;
            } else if (item.defaultValue !== undefined) {
              acc[item.name] = item.defaultValue;
            }
          }
          // For regular fields, prioritize initialValue over defaultValue
          else if (item.initialValue !== undefined || item.defaultValue !== undefined) {
            acc[item.name] = item.initialValue ?? item.defaultValue;
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
  }, [dataLoadedFromView, formPropertiesConfig, defaultValues, form])


  return (
    <Spin spinning={!dataLoadedFromView}>
      {dataLoadedFromView && (
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={() => {
            // Optional: You might want to reload data or reset form state here
            // For now, a simple re-render by the ErrorBoundary is sufficient.
            console.log("Form ErrorBoundary Reset");
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
                {columns[0].map(renderFormField)}
              </div>
            )}
            {children}
            {formButtons.length > 0 && (
              <div style={{ display: "flex" }}>
                <CreateButtons formButtons={formButtons} loader={btnLoader} routeParams={routeParams} onCancelCallback={onCancelCallback} />
              </div>
            )}
          </AntForm>
        </ErrorBoundary>
      )}
    </Spin>
  );
};