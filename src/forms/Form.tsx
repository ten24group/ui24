import { Form as AntForm, Spin } from 'antd';
import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

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
    formConfig = { name: "customForm-"+uuidv4() },
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
} : IForm ) {
  const navigate = useNavigate();
  const { notifyError, notifySuccess } = useAppContext()

  // TODO: remove the dynamic-id option from here and use the identifiers prop instead
  const { dynamicID = "" } = useParams()
  
  const [ formPropertiesConfig, setFormPropertiesConfig ] = useState<IFormField[]>( convertColumnsConfigForFormField(propertiesConfig) )
  const [ dataLoadedFromView, setDataLoadedFromView ] = useState( ( identifiers || ( useDynamicIdFromParams && dynamicID ) ) ? false : true )
  const { callApiMethod } = useApi();
  const [ loader, setLoader ] = useState<boolean>( false )
  const [ btnLoader, setBtnLoader ] = useState<boolean>( false )
  const [identifiersToUse, setIdentifiersToUse] = useState<string | number | undefined>(useDynamicIdFromParams ? dynamicID : identifiers);

  useEffect( () => {
    setLoader( disabled )
  }, [ disabled] )

  useEffect( () => {
    setBtnLoader(buttonLoader)
  }, [buttonLoader])

  useEffect( () => {
    if(useDynamicIdFromParams){
      setIdentifiersToUse(dynamicID);
    } else {
      setIdentifiersToUse(identifiers);
    }
  }, [identifiers, dynamicID])

  useEffect( () => {

      const loadAndFormatData = async () => {
        setLoader( true)
        // if the page has api-config and record identifier etch the record and update the form-fields with initial values.
        const recordData =  (detailApiConfig && ( identifiersToUse) !== "") ? await fetchRecordInfo() : {};

        const itemValueFormatter = ( item: IFormField, itemValue: any ) => {
          const { name, fieldType, type } = item;
          
          if(type === "map"){
            itemValue = item.properties.reduce((acc, prop: IFormField) => { 
              acc[prop.name] = itemValueFormatter(prop, itemValue[prop.name]);
              return acc;
            }, {});
          }

          if(type === "list"){
            itemValue = itemValue || [];
            itemValue = itemValue.map( it => itemValueFormatter(item.items as any, it) );
          }
          
          if(fieldType === "datetime") {
              itemValue = dayjsCustom(itemValue);
          } else if(fieldType === "date") {
              itemValue = dayjsCustom(itemValue);
          } else if(fieldType === "time") {
              itemValue = dayjsCustom(itemValue);
          } else if( ['boolean', 'toggle', 'switch'].includes(fieldType) ){
              itemValue = itemValue ?? true;
          } else if (fieldType === "color"){
              itemValue = itemValue ?? "#FFA500";
          }
          return itemValue;
        }

        if(recordData){
          
          const updatedFieldsWithInitialValues = formPropertiesConfig.map((item: IFormField) => {
            const itemValue = itemValueFormatter(item, recordData[item.name]) 
            return { ...item, initialValue: itemValue }
          });

          setFormPropertiesConfig(updatedFieldsWithInitialValues);
        }

        setLoader( false )
        setDataLoadedFromView( true );
      }

      const fetchRecordInfo = async () => {
          
          const response: any = await callApiMethod( { ...detailApiConfig, apiUrl: detailApiConfig.apiUrl + `/${identifiersToUse}` } );
          
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
      const formattedApiUrl = identifiersToUse !== "" ? apiConfig.apiUrl + `/${identifiersToUse}` : apiConfig.apiUrl
      
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
        notifyError(errorMessage)
      }
      setBtnLoader( false )
      setLoader( false )
    }

    //call when defined
    onSubmit && onSubmit(values)
  }

  
  const [form] = AntForm.useForm();
  
  useEffect( () => {
    if( dataLoadedFromView ) {
      //loop over formPropertiesConfig and create an object where key is the name of the field and value is the value of the field
      //this is used to set the initial values of the form
      const initialValues = formPropertiesConfig.reduce( (acc, item) => {
        acc[item.name] = item.initialValue
        return acc
      }, {})

      form.setFieldsValue( initialValues )
    }
    
  }, [dataLoadedFromView])

  return <Spin spinning={!dataLoadedFromView}>
    { dataLoadedFromView && <AntForm
      form={ form }
      {...formConfig}
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
  }
  </Spin>
}