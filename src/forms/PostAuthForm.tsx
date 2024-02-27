import { Button, Checkbox, Form, Input } from 'antd';
import React, { Component, ReactNode } from 'react';
import { ICreateButtons, CreateButtons } from '../core/forms';
import { IFormConfig } from '../core/forms/formConfig';
import { useNavigate } from 'react-router-dom';
import { IFormField } from '../core/forms';
import { FormField } from '../core/forms';
import { ICustomForm } from '../core/forms/formConfig';
import { postMethod } from '../core';

export function PostAuthForm({
    formConfig = { name: "customForm" },
    propertiesConfig = [],
    onSubmit,
    formButtons = [],
    children,
    submitApiUrl = "",
    submitSuccessRedirect = ""
} : ICustomForm ) {
  const navigate = useNavigate();

  const customOnSubmit = async (values: any) => {
    
    if( submitApiUrl !== "") {
      const response = await postMethod(submitApiUrl, values);
      if( response ){
        //handle success
        if( submitSuccessRedirect !== "") {
          //redirect to the page
          navigate( submitSuccessRedirect)
        }
      } else {
        //1. general error
        //2. form level error
        //3. field level error
        //handle failure
      }
    } else {
      //call when defined
      onSubmit && onSubmit(values)
    }
  }

    return <Form
    name={ formConfig.name || "" }
    className={ formConfig?.className || "" }
    initialValues={ formConfig?.initialValues || {} }
    layout="vertical"
    onFinish={customOnSubmit}
  >
    
    { propertiesConfig.map( (item: IFormField, index: number) => {
      return <React.Fragment key={ "internalForm" + index }><FormField {...item} /></React.Fragment>
      } ) }
    { children }
    
    { formButtons.length > 0 && <div style={{ display: "flex"}}><CreateButtons formButtons={ formButtons } /></div> }
    
  </Form>
}