import { Button, Checkbox, Form, Input } from 'antd';
import React, { Component, ReactNode } from 'react';
import { ICreateButtons, CreateButtons } from '../core/forms';
import { IFormConfig } from '../core/forms/formConfig';
import { IFormField } from '../core/forms';
import { ICustomForm } from '../core/forms/formConfig';
import { useNavigate } from 'react-router-dom';

const { TextArea } = Input;

type ILinkProps = { url: string; title: string; children?: ReactNode } | { url: string; children: ReactNode; title?: string };

export function Link ({title, url, children }: ILinkProps ) {
  const navigate = useNavigate();
  return <a onClick={ () => navigate(url) } className="forgotPassowrd">
      { title !== "" ? title : "" } { children !== undefined ? children : "" }
    </a>
}

export function CustomFormFields( {propertiesConfig} : { propertiesConfig : Array<IFormField> } ) {

  return <>{ propertiesConfig.map( (item: IFormField, index: number) => {
      return <div style={{ marginBottom: "24px" }} key={"CustomFormFields"+ index }>
        { item.fieldType !== "checkbox" && <Form.Item name={ item.name } rules={ item.validationRules } label={ item.label } >
          { item.fieldType === "text" && <Input type={ item?.fieldType || "text" } prefix={ item.prefixIcon } placeholder={ item.placeholder } /> }
          { item.fieldType === "textarea" && <TextArea placeholder={ item.placeholder } />}
        </Form.Item> }
      </div>
  })}</>
}

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
    <CustomFormFields propertiesConfig = { propertiesConfig } />
    
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