import { Button, Checkbox, Form, Input } from 'antd';
import React, { Component, ReactNode } from 'react';
import { ICreateButtons, CreateButtons } from '../core/forms';
import { IFormConfig } from '../core/forms/formConfig';
import { IFormField } from '../core/forms';
import { FormField } from '../core/forms';
import { ICustomForm } from '../core/forms/formConfig';

export function PostAuthForm({
    formConfig = { name: "customForm" },
    propertiesConfig = [],
    onSubmit,
    formButtons = [],
    children
} : ICustomForm ) {

    return <Form
    name={ formConfig.name || "" }
    className={ formConfig?.className || "" }
    initialValues={ formConfig?.initialValues || {} }
    layout="vertical"
    onFinish={onSubmit}
  >
    
    { propertiesConfig.map( (item: IFormField, index: number) => {
      return <React.Fragment key={ "internalForm" + index }><FormField {...item} /></React.Fragment>
      } ) }
    { children }
    
    { formButtons.length > 0 && <div style={{ display: "flex"}}><CreateButtons formButtons={ formButtons } /></div> }
    
  </Form>
}