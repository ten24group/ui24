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
}: IFormWithColumnsConfig) {
  const navigate = useNavigate();
  const { notifyError, notifySuccess } = useAppContext()

  // TODO: remove the dynamic-id option from here and use the identifiers prop instead
  const { dynamicID = "" } = useParams()

  const [ formPropertiesConfig, setFormPropertiesConfig ] = useState<IFormField[]>(convertColumnsConfigForFormField(propertiesConfig))
  const [ dataLoadedFromView, setDataLoadedFromView ] = useState((identifiers || (useDynamicIdFromParams && dynamicID)) ? false : true)
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
      // if the page has api-config and record identifier etch the record and update the form-fields with initial values.
      const recordData = (detailApiConfig && (identifiersToUse) !== "") ? await fetchRecordInfo() : {};

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
        }

        return itemValue;
      }

      if (recordData) {

        const updatedFieldsWithInitialValues = formPropertiesConfig.map((item: IFormField) => {
          const itemValue = itemValueFormatter(item, recordData[ item.name ])
          return { ...item, initialValue: itemValue }
        });

        setFormPropertiesConfig(updatedFieldsWithInitialValues);
      }

      setLoader(false)
      setDataLoadedFromView(true);
    }

    const fetchRecordInfo = async () => {
      try {
        const response: any = await callApiMethod({ ...detailApiConfig, apiUrl: detailApiConfig.apiUrl + `/${identifiersToUse}` });

        if (response.status === 200) {
          const detailResponse = response.data[ detailApiConfig.responseKey ];
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
      const formattedApiUrl = identifiersToUse !== "" && identifiersToUse ? apiConfig.apiUrl + `/${identifiersToUse}` : apiConfig.apiUrl
      try {
        const response: any = await callApiMethod({
          ...apiConfig,
          apiUrl: formattedApiUrl,
          payload: values
        });

        if (response.status === 200) {
          notifySuccess("Saved Successfully")
          if (submitSuccessRedirect !== "") {
            //redirect to the page
            navigate(submitSuccessRedirect)
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

  }, [ dataLoadedFromView ])

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

  return <Spin spinning={!dataLoadedFromView}>
    {dataLoadedFromView && <AntForm
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
      {formButtons.length > 0 && <div style={{ display: "flex" }}><CreateButtons formButtons={formButtons} loader={btnLoader} /></div>}
    </AntForm>
    }
  </Spin>
}