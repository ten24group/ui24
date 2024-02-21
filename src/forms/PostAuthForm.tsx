import { Button, Checkbox, Form, Input } from 'antd';
import React, { Component, ReactNode } from 'react';
import { ICreateButtons, CreateButtons } from '../core/forms';
import { IFormConfig } from '../core/forms/formConfig';
import { IFormField } from '../core/forms';
import { FormFields } from '../core/forms';
import { ICustomForm } from '../core/forms/formConfig';

export function PostAuthForm({
    formConfig = { name: "customForm" },
    propertiesConfig,
    onSubmit,
    formButtons
} : ICustomForm ) {

    return <Form
    name={ formConfig.name }
    className={ formConfig?.className || "" }
    initialValues={ formConfig?.initialValues || {} }
    layout="vertical"
    onFinish={onSubmit}
  >
    <FormFields propertiesConfig = { propertiesConfig } />
    
    <div style={{ display: "flex"}}><CreateButtons formButtons={ formButtons } /></div>
    
  </Form>
}

export const DynamicForm = ({ formName = "", propertiesConfig } : { formName: string, propertiesConfig : Array<IFormField> }) => {
  const formConfig : IFormConfig = {
      name: formName,
      className: ""
  }

  const onFinish = (values: any) => {
      console.log('Received values of form: ', values);
  };

  return <PostAuthForm formConfig = { formConfig } 
  propertiesConfig={ propertiesConfig } 
  onSubmit={ onFinish } 
  formButtons={ ["submit", "cancel"] } />
}