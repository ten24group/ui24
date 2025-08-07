import { Form as AntForm, Spin } from 'antd';
import React, { useState, useEffect } from 'react';
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
import { substituteUrlParams } from '../core/utils';
import './Form.css';

// Add types for columnsConfig
interface IColumnLayoutConfig {
  sortOrder: number;
  fields: string[];
}
interface IColumnsConfig {
  numColumns?: number;
  columns: IColumnLayoutConfig[];
}

// Extend IForm to accept columnsConfig
interface IFormWithColumnsConfig extends IForm {
  columnsConfig?: IColumnsConfig;
  routeParams?: Record<string, string>;
}

export function Form({
  formConfig = { name: "customForm-" + uuidv4() },
  propertiesConfig = [],
  onSubmit,
  onSubmitSuccessCallback,
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
}: IFormWithColumnsConfig) {
  const navigate = useNavigate();
  const { notifyError, notifySuccess } = useAppContext()

  // TODO: remove the dynamic-id option from here and use the identifiers prop instead
  const { dynamicID = "" } = useParams()

  const [ formPropertiesConfig, setFormPropertiesConfig ] = useState<IFormField[]>(convertColumnsConfigForFormField(propertiesConfig))
  const [ dataLoadedFromView, setDataLoadedFromView ] = useState((identifiers || (useDynamicIdFromParams && dynamicID) || Object.keys(routeParams).length > 0) ? false : true)
  const { callApiMethod } = useApi();
  const [ loader, setLoader ] = useState<boolean>(false)
  const [ btnLoader, setBtnLoader ] = useState<boolean>(false)
  const [ identifiersToUse, setIdentifiersToUse ] = useState<string | number | undefined>(useDynamicIdFromParams ? dynamicID : identifiers);

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

  useEffect(() => {

    const loadAndFormatData = async () => {
      setLoader(true)

      // if the page has api-config and record identifier or route params, then fetch the record and update the form-fields with initial values.
      const shouldFetchRecord = detailApiConfig && (identifiersToUse !== "" || Object.keys(routeParams).length > 0);
      const recordData = shouldFetchRecord ? await fetchRecordInfo() : {};
      
      const itemValueFormatter = (item: IFormField, itemValue: any) => {

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
            itemValue = dayjsCustom(new Date(parseInt(itemValue)).toISOString());
          } else {
            itemValue = dayjsCustom(itemValue);
          }
        } else if ([ 'boolean', 'toggle', 'switch' ].includes(fieldType)) {
          itemValue = itemValue;
        } else if (fieldType === "color") {
          itemValue = itemValue ?? "#FFA500";
        } else if (fieldType === "json") {
          itemValue = typeof itemValue !== 'string' ? JSON.stringify(itemValue, null, 2) : itemValue;
        }

        return itemValue;
      }

      if (recordData) {

        const updatedFieldsWithInitialValues = formPropertiesConfig.map((item: IFormField) => {
          const itemValue = itemValueFormatter(item, recordData[ item.column || item.name || item.id ])
          return { ...item, initialValue: itemValue }
        });

        setFormPropertiesConfig(updatedFieldsWithInitialValues);
      }

      setLoader(false)
      setDataLoadedFromView(true);
    }

    const fetchRecordInfo = async () => {
      try {
        let apiUrl = detailApiConfig.apiUrl;
        
        // Use the clean utility function for URL parameter substitution
        apiUrl = substituteUrlParams(apiUrl, routeParams, identifiersToUse);
        
        const response: any = await callApiMethod({ ...detailApiConfig, apiUrl });

        if (response.status === 200) {
          const detailResponse = detailApiConfig.responseKey ? response.data[ detailApiConfig.responseKey ] : response.data;
          return detailResponse;
        } else {
          notifyError(response.message || response.error || 'An unexpected error occurred');
        }
      } catch (error: any) {
        notifyError(error?.message || 'An unexpected error occurred');
      }
    }

    loadAndFormatData();
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
        } else if (response.status >= 400 || response.status <= 500) {
          const errorMessage = response.message || response.error.message || response.error;
          notifyError(errorMessage)
        }
      } catch (error: any) {
        notifyError(error?.message || 'An unexpected error occurred');
      } finally {
        setBtnLoader(false)
        setLoader(false)
      }
    }

    //call when defined
    onSubmit && onSubmit(values)
  }

  const [ form ] = AntForm.useForm();

  // Determine columns to render
  let columns: IFormField[][] = [];
  if (columnsConfig && columnsConfig.columns && columnsConfig.columns.length > 0) {
    // Sort columns by sortOrder
    columns = columnsConfig.columns
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(col =>
        col.fields
          .map(fieldKey => formPropertiesConfig.find(f => f.name === fieldKey))
          .filter(item => item) as IFormField[]
      );
  } else {
    // Fallback: single column with all fields
    columns = [ formPropertiesConfig ];
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

  useEffect(() => {
    if (dataLoadedFromView) {
      //loop over formPropertiesConfig and create an object where key is the name of the field and value is the value of the field
      //this is used to set the initial values of the form
      const initialValues = formPropertiesConfig.reduce((acc, item) => {
        acc[ item.name ] = item.initialValue
        return acc
      }, {})

      form.setFieldsValue(initialValues)
    }

  }, [ dataLoadedFromView, formPropertiesConfig ])


  return <Spin spinning={!dataLoadedFromView}>
    {dataLoadedFromView && <AntForm
      key={`form-${formConfig.name}`}
      form={form}
      {...formConfig}
      layout="vertical"
      onFinish={onFinish}
      disabled={loader}
    >
      {columns.length > 1 ? (
        <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', width: '100%', paddingBottom: 32 }}>
          {columns.map((columnItems, colIdx) => (
            <div
              key={colIdx}
              className="form-column"
              style={{
                flex: 1,
                minWidth: 0,
                maxWidth: 600,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: '#fff',
                padding: 24,
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: '1px solid #f0f0f0',
              }}
            >
              {columnItems.map(renderFormField)}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ maxWidth: 600 }}>
          {columns[ 0 ].map(renderFormField)}
        </div>
      )}
      {children}
      {formButtons.length > 0 && <div style={{ display: "flex" }}><CreateButtons formButtons={formButtons} loader={btnLoader} routeParams={routeParams} /></div>}
    </AntForm>
    }
  </Spin>
}