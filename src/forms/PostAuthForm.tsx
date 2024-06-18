import { Form, Spin } from 'antd';
import React, { useState, useEffect } from 'react';
import { dayjsCustom } from '../core/dayjs';

import { CreateButtons, FieldOptionsAPIConfig, fetchFieldOptions, isFieldOptionsAPIConfig } from '../core/forms';
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
  const [ dataLoadedFromView, setDataLoadedFromView ] = useState( false )

  useEffect( () => {

      const loadFormDataAndFieldOptions = async () => {

        // if form-form-fields has dynamic options, fetch the options and update the form-fields
        const updatedFields = await Promise.all( 
          formPropertiesConfig.map( async (item: IFormField) => {
              if(!['select', 'multi-select', 'checkbox', 'radio'].includes(item.fieldType?.toLocaleLowerCase())){
                return item;
              }

              let options = item.options;

              if(isFieldOptionsAPIConfig(options)){
                options = await fetchFieldOptions(options as FieldOptionsAPIConfig);
              }
            
              return { ...item, options }
          })
        );

        setFormPropertiesConfig( updatedFields );

        // if the page has api-config and record identifier etch the record and update the form-fields with initial values.
        const recordData =  (detailApiConfig && dynamicID !== "") ? await fetchRecordInfo() : {};

        const updatedFieldsWithInitialValues = updatedFields.map( ( item: IFormField ) => {
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

      loadFormDataAndFieldOptions();
  },[])

  const customOnSubmit = async (values: any) => {
    if( apiConfig ) {

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
      } else if( response.status >= 400 || response.status <= 500 ) {
        const errorMessage =  response.message || response.error.message || response.error;
        notifyError(response?.error)
      }
    }

    //call when defined
    onSubmit && onSubmit(values)
  }

  return <>  
    <Spin spinning={!dataLoadedFromView}>
      { dataLoadedFromView &&
        <Form
          name={ formConfig.name || "" }
          className={ formConfig?.className || "" }
          layout="vertical"
          onFinish={customOnSubmit}
        >
        
          { formPropertiesConfig.map( 
            (item: IFormField, index: number ) => { 
              return <React.Fragment key={"fe"+index}>
                  <FormField {...item} />
                </React.Fragment> 
            })
          }

          { children }

          { formButtons.length > 0 && 
            <div style={{ display: "flex", float: "right"}}>
              <CreateButtons formButtons={ formButtons } />
            </div> 
          }
          
          {/* <pre>
              <code>{JSON.stringify(formPropertiesConfig, null, 2)}</code>
          </pre> */}
        </Form>
      }
    </Spin>
  </>

}