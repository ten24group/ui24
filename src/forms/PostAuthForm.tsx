import { Form } from 'antd';
import React, { Fragment, useState, useEffect } from 'react';
import {  CreateButtons } from '../core/forms';
import { useNavigate } from 'react-router-dom';
import { FormField, IFormField } from '../core/forms';
import { ICustomForm } from '../core/forms/formConfig';
import { callApiMethod } from '../core';
import { convertColumnsConfigForFormField } from '../core/forms';
import { useParams } from "react-router-dom"
import { useAppContext } from '../core/context/AppContext';

export function PostAuthForm({
    formConfig = { name: "customForm" },
    propertiesConfig = [],
    onSubmit,
    formButtons = [],
    children,
    apiConfig,
    detailApiConfig,
    submitSuccessRedirect = ""
} : ICustomForm ) {
  const navigate = useNavigate();
  const { notifyError, notifySuccess } = useAppContext()

  const { dynamicID = "" } = useParams()
  const [ formPropertiesConfig, setFormPropertiesConfig ] = useState<IFormField[]>( convertColumnsConfigForFormField(propertiesConfig) )
  const [ dataLoadedFromView, setDataLoadedFromView ] = useState( dynamicID !== "" ? false : true )

  useEffect( () => {
      const fetchRecordInfo = async () => {
          const response: any = await callApiMethod( { ...detailApiConfig, apiUrl: detailApiConfig.apiUrl + `${dynamicID}/` } );
          if( response.status === 200 ) {
              const detailResponse = response.data[detailApiConfig.responseKey]
              setFormPropertiesConfig( formPropertiesConfig.map( ( item: IFormField ) => {
                  return {
                      ...item,
                      initialValue: detailResponse[item.name]
                  }
              }) )
              setDataLoadedFromView( true )
          }
      }

      if( detailApiConfig && dynamicID !== "") 
          fetchRecordInfo();
  }, [] )

  

  const customOnSubmit = async (values: any) => {
    if( apiConfig ) {

      const formattedApiUrl = dynamicID !== "" ? apiConfig.apiUrl + `${dynamicID}/` : apiConfig.apiUrl
      
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
      } else if( response.status >= 400 || response.status <= 500 ) {
        const errorMessage =  response.message || response.error.message || response.error;
        notifyError(response?.error)
      }
    }

    //call when defined
    onSubmit && onSubmit(values)
  }

  return <Form
      name={ formConfig.name || "" }
      className={ formConfig?.className || "" }
      initialValues={ formConfig?.initialValues || {} }
      layout="vertical"
      onFinish={customOnSubmit}
    >
    
    { dataLoadedFromView && formPropertiesConfig.map( 
      (item: IFormField, index: number ) => { 
        return <React.Fragment key={"fe"+index}><FormField {...item} /></React.Fragment> 
      }) 
    }
    { children }
    
    { formButtons.length > 0 && <div style={{ display: "flex"}}><CreateButtons formButtons={ formButtons } /></div> }
    
  </Form>
}