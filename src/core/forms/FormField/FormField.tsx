import React, { Component, ReactNode } from 'react';
import { Checkbox, Form, Input, Radio, Select } from 'antd';
type IFormFieldType = "text" | "password" | "email" | "textarea" | "checkbox" | "radio" | "select"

interface IFormField {
    name: string; //unique identifier, should be without spaces
    validationRules: Array<any>; //rules matchin ant design convention
    placeholder: string; //placeholder text
    prefixIcon?: ReactNode; //prefix icon as a react component
    fieldType?: IFormFieldType; //field type
    options: Array<any>; //options for select, radio, checkbox
    label: string;
    style?: React.CSSProperties;
    initialValue?: string;
}

const { TextArea } = Input;

export function FormField( {fieldType = "text", name, validationRules, label = "", prefixIcon, placeholder = "", options, style, initialValue } : IFormField ) {

    return <div style={{ marginBottom: "24px" }} key={"CustomFormFields"}>
      <Form.Item name={ name } rules={ validationRules } label={ label } style={ style } initialValue = { initialValue } >
        { fieldType === "text" && <Input type={ fieldType || "text" } prefix={ prefixIcon } placeholder={ placeholder } /> }
        { fieldType === "textarea" && <TextArea placeholder={ placeholder } />}
        { fieldType === "password" && <Input.Password type={ fieldType || "password" } prefix={ prefixIcon } placeholder={ placeholder } /> }
        { fieldType === "email" && <Input type={ fieldType || "email" } prefix={ prefixIcon } placeholder={ placeholder } /> }
        { fieldType === "checkbox" && <Checkbox.Group options={ options }>{ label }</Checkbox.Group> }
        { fieldType === "radio" && <Radio.Group options={ options } />}
        { fieldType === "select" && <Select options={ options } />}
        
      </Form.Item>
    </div>
}

type IPreDefinedValidations = "required" | "email" | `match:${string}`;
interface IFormFieldResponse {
    column: string;
    label: string;
    placeholder: string;
    validations: Array<IPreDefinedValidations>;
    fieldType?: IFormFieldType;
}



const convertValidationRules = ( validationRules : Array<IPreDefinedValidations> ) => {
  return validationRules.map( validationRule => {
      let antValidationRule = {}
      if( validationRule === "required") {
          antValidationRule = { ...antValidationRule, required: true }
      } else if( validationRule === "email") {
          antValidationRule = { ...antValidationRule, type: 'email' }
      } else if( validationRule.includes("match:") ) {
          const targetColumn = validationRule.split(':').pop()
          antValidationRule = ({ getFieldValue }) => ({
              validator(_, value) {
                  if (!value || getFieldValue( targetColumn ) === value) {
                      return Promise.resolve();
                  }
                  return Promise.reject(new Error(`This field does not match with "${targetColumn}" !`));
              },
          })
      }
      return antValidationRule
  })
}

export const convertColumnsConfigForFormField  =( columnsConfig : Array<IFormFieldResponse> ):  Array<IFormField> => {
  return columnsConfig.map( columnConfig => {
      return {
          name: columnConfig.column,
          validationRules: convertValidationRules(columnConfig.validations),
          label: columnConfig.label,
          placeholder: columnConfig.placeholder ?? columnConfig.label,
          fieldType: columnConfig.fieldType ?? "text",
      }
  })
}

export type { IFormField, IFormFieldResponse }

