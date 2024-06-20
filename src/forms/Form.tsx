import { Form as AntForm, Spin } from 'antd';
import React, { useState, useEffect } from 'react';
import { dayjsCustom } from '../core/dayjs';

import {  CreateButtons } from '../core/forms';
import { useNavigate } from 'react-router-dom';
import { FormField, IFormField } from '../core/forms';
import { IForm } from '../core/forms/formConfig';
import { useApi } from '../core/context';
//import { CreateButtons, FieldOptionsAPIConfig, fetchFieldOptions, isFieldOptionsAPIConfig } from '../core/forms';
import { convertColumnsConfigForFormField } from '../core/forms';
import { useParams } from "react-router-dom"
import { useAppContext } from '../core/context/AppContext';

export function Form({
    formConfig = { name: "customForm" },
    propertiesConfig = [],
    onSubmit,
    onSubmitSuccessCallback,
    formButtons = [],
    children,
    apiConfig,
    detailApiConfig,
    submitSuccessRedirect = "",
    disabled = false,
    buttonLoader = false
} : IForm ) {
  const navigate = useNavigate();
  const { notifyError, notifySuccess } = useAppContext()

  const { dynamicID = "" } = useParams()
  const [ formPropertiesConfig, setFormPropertiesConfig ] = useState<IFormField[]>( convertColumnsConfigForFormField(propertiesConfig) )
  const [ dataLoadedFromView, setDataLoadedFromView ] = useState( dynamicID !== "" ? false : true )
  const { callApiMethod } = useApi();
  const [ loader, setLoader ] = useState<boolean>( false )
  const [ btnLoader, setBtnLoader ] = useState<boolean>( false )

  useEffect( () => {
    setLoader( disabled )
  }, [ disabled] )

  useEffect( () => {
    setBtnLoader(buttonLoader)
  }, [buttonLoader])

  useEffect( () => {

      const loadAndFormatData = async () => {
        setLoader( true)
        // if the page has api-config and record identifier etch the record and update the form-fields with initial values.
        const recordData =  (detailApiConfig && dynamicID !== "") ? await fetchRecordInfo() : {};

        const updatedFieldsWithInitialValues = formPropertiesConfig.map( ( item: IFormField ) => {
            const { name, fieldType } = item;
            
            let initialValue = recordData[name];
            
            if(fieldType === "datetime") {
                initialValue = dayjsCustom(initialValue);
            } else if(fieldType === "date") {
                initialValue = dayjsCustom(initialValue);
            } else if(fieldType === "time") {
                initialValue = dayjsCustom(initialValue);
            } else if( ['boolean', 'toggle', 'switch'].includes(fieldType) ){
                initialValue = initialValue ?? true;
            } else if (fieldType === "color"){
                initialValue = initialValue ?? "#FFA500";
            }

            return { ...item, initialValue: initialValue || item.initialValue }
        });
        
        setFormPropertiesConfig(updatedFieldsWithInitialValues);

        setLoader( false )
        setDataLoadedFromView( true );
      }

      const fetchRecordInfo = async () => {
          
          const response: any = await callApiMethod( { ...detailApiConfig, apiUrl: detailApiConfig.apiUrl + `/${dynamicID}` } );
          
          if( response.status === 200 ) {
              const detailResponse = response.data[detailApiConfig.responseKey];
              return detailResponse;
          } else {
              notifyError(response?.error)
          }
          
      }

      loadAndFormatData();
  },[])

  const onFinish = async (values: any) => {
    if( apiConfig ) {
      setLoader( true)
      setBtnLoader( true )
      const formattedApiUrl = dynamicID !== "" ? apiConfig.apiUrl + `/${dynamicID}` : apiConfig.apiUrl
      
      const response: any = await callApiMethod({
        ...apiConfig,
        apiUrl: formattedApiUrl,
        payload: values
      });
      
      if( response.status === 200 ) {
        notifySuccess("Saved Successfully")
        if( submitSuccessRedirect !== "") {
          //redirect to the page
          navigate( submitSuccessRedirect)
        }
        onSubmitSuccessCallback && onSubmitSuccessCallback(response)
      } else if( response.status >= 400 || response.status <= 500 ) {
        const errorMessage =  response.message || response.error.message || response.error;
        notifyError(response?.error)
      }
      setBtnLoader( false )
      setLoader( false )
    }

    //call when defined
    onSubmit && onSubmit(values)
  }

  
  const [form] = AntForm.useForm();
  
  useEffect( () => {
    //loop over formPropertiesConfig and create an object where key is the name of the field and value is the value of the field
    //this is used to set the initial values of the form
    const initialValues = formPropertiesConfig.reduce( (acc, item) => {
      acc[item.name] = item.initialValue
      return acc
    }, {})

    form.setFieldsValue( initialValues )
  }, [dataLoadedFromView])

  return <Spin spinning={!dataLoadedFromView}>
    <AntForm
      form={ form }
      name={ formConfig.name || "" }
      className={ formConfig?.className || "" }
      initialValues={ formConfig?.initialValues }
      layout="vertical"
      onFinish={onFinish}
      disabled={ loader }
    >
    
    { formPropertiesConfig.map( 
      (item: IFormField, index: number ) => { 
        return <React.Fragment key={"fe"+index}>
            <FormField {...item} setFormValue={ ( newValue: { name: string, value: string }) => {
              form.setFieldsValue( { [newValue.name]: newValue.value } )
              }} />
          </React.Fragment> 
      })
    }

    { children }
    
    { formButtons.length > 0 && <div style={{ display: "flex"}}><CreateButtons formButtons={ formButtons } loader={ btnLoader } /></div> }
    
  </AntForm>
  </Spin>
}