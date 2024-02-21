import React from 'react';
import { Checkbox, Form, Input } from 'antd';
import { IFormField } from './formField';

const { TextArea } = Input;

export function FormFields( {propertiesConfig} : { propertiesConfig : Array<IFormField> } ) {

  return <>{ propertiesConfig.map( (item: IFormField, index: number) => {
      return <div style={{ marginBottom: "24px" }} key={"CustomFormFields"+ index }>
        { item.fieldType !== "checkbox" && <Form.Item name={ item.name } rules={ item.validationRules } label={ item.label } >
          { item.fieldType === "text" && <Input type={ item?.fieldType || "text" } prefix={ item.prefixIcon } placeholder={ item.placeholder } /> }
          { item.fieldType === "textarea" && <TextArea placeholder={ item.placeholder } />}
        </Form.Item> }
      </div>
  })}</>
}