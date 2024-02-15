import { Button, Checkbox, Form, Input } from 'antd';
import React, { Component, ReactNode } from 'react';
import { ICreateButtons, CreateButtons } from '../core/forms';
import { IFormField } from '../core/forms';
const { TextArea } = Input;

interface IFormConfig {
  name: string;
  className?: string;
  initialValues?: any;
}

interface ICustomForm extends ICreateButtons {
  formConfig?: IFormConfig;
  propertiesConfig: Array<IFormField>;
  onSubmit: (values: any) => void;
}

export function CustomForm({
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
    { propertiesConfig.map( (item: IFormField, index: number) => {
        return <React.Fragment key={"formItem" + formConfig.name + index }>
          <Form.Item name={ item.name } rules={ item.validationRules } label={ item.label } >
            { item.fieldType === "text" && <Input type={ item?.fieldType || "text" } prefix={ item.prefixIcon } placeholder={ item.placeholder } /> }
            { item.fieldType === "textarea" && <TextArea placeholder={ item.placeholder } />}
          </Form.Item>
        </React.Fragment>
    })}

    <CreateButtons formButtons={ formButtons } />
    
  </Form>
}

export type { IFormField , IFormConfig }