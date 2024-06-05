import React, { Component, ReactNode } from 'react';
import { Checkbox, Form, Input, Radio, Select, Switch } from 'antd';
import { callApiMethod } from '../../api/apiMethods';
type IFormFieldType = "text" | "password" | "email" | "textarea" | "checkbox" | "radio" | "select" | "multi-select" | "color" | "switch";


/**
 * Represents the template for attributes.
 * like
 * ```ts
 * {
 *      composite: ['att1', 'att2'],
 *      template: '{att1}-AND-${att2}' // any arbitrary string with placeholders
 * }
 * ```
*/
export type AttributesTemplate = {
    composite: Array<string>,
    template: string,
}

export type FieldOptionsAPIConfig = {
    apiMethod: 'GET' | 'POST',
    apiUrl: string,
    responseKey: string,
    query?: any,
    optionMapping?: {
        label: string | AttributesTemplate, // 
        value: string | AttributesTemplate, // 
    },
}

export function isFieldOptionsAPIConfig(obj: any): obj is FieldOptionsAPIConfig {
    return (
        obj &&
        obj.apiMethod &&
        (obj.apiMethod === 'GET' || obj.apiMethod === 'POST') &&
        typeof obj.apiUrl === 'string' &&
        typeof obj.responseKey === 'string'
    );
}

export async function fetchFieldOptions(config: FieldOptionsAPIConfig): Promise<Array<IOptions>> {
    // TODO: add support for query, pagination, fetching template-attributes etc
    const response = await callApiMethod( { ...config } );

    if( response.status === 200 ) {

        const options = response.data[config.responseKey];

        if( !config.optionMapping ) {
            return options;
        }

        return options.map( (option: any) => {
            return {
                label: typeof config.optionMapping.label === 'string' 
                    ? option[config.optionMapping.label] 
                    : interpolateTemplate(config.optionMapping.label, option),
                value: typeof config.optionMapping.value === 'string' 
                    ? option[config.optionMapping.value] 
                    : interpolateTemplate(config.optionMapping.value, option),
            }
        })
    }
    
    // TODO: handle error

    return [];
}

function interpolateTemplate(label: AttributesTemplate, option: any) {
    const { composite, template } = label;
    let interpolatedLabel = template;
    composite.forEach((attribute) => {
        const regex = new RegExp(`{${attribute}}`, "g");
        interpolatedLabel = interpolatedLabel.replace(regex, option[attribute]);
    });
    return interpolatedLabel;
}

export type FieldOptions = Array<IOptions> | FieldOptionsAPIConfig;

interface IOptions {
    label: string;
    value: string
}

interface IFormField {
    name: string; //unique identifier, should be without spaces
    validationRules?: Array<any>; //rules matching ant design convention
    placeholder: string; //placeholder text
    prefixIcon?: ReactNode; //prefix icon as a react component
    fieldType?: IFormFieldType; //field type
    options?: Array<IOptions>; //options for select, radio, checkbox
    label: string;
    style?: React.CSSProperties;
    initialValue?: any;
}

const { TextArea } = Input;

export function FormField( {fieldType = "text", name, validationRules, label = "", prefixIcon, placeholder = "", options = [], style, initialValue } : IFormField ) {
    
    return <div style={{ marginBottom: "24px" }} key={"CustomFormFields"}>
      <Form.Item name={ name } rules={ validationRules } label={ label } style={ style } initialValue = { initialValue } >
        { fieldType === "text" && <Input type={ fieldType || "text" } value={ initialValue } prefix={ prefixIcon } placeholder={ placeholder } /> }
        { fieldType === "textarea" && <TextArea placeholder={ placeholder } />}
        { fieldType === "password" && <Input.Password type={ fieldType || "password" } prefix={ prefixIcon } placeholder={ placeholder } /> }
        { fieldType === "email" && <Input type={ fieldType || "email" } prefix={ prefixIcon } placeholder={ placeholder } /> }
        { fieldType === "checkbox" && <Checkbox.Group options={ options }>{ label }</Checkbox.Group> }
        { fieldType === "radio" && <Radio.Group options={ options } />}
        { fieldType === "select" && <Select options={ options } />}
        { fieldType === "multi-select" && <Select mode='multiple' options={ options } />}
        { ['boolean', 'toggle', 'switch'].includes( fieldType.toLocaleLowerCase() ) && <Switch checked={ initialValue } />}
        { fieldType === "color" && <Input type={ fieldType || "color" } value={ initialValue } style={{width: "150px"}} />}
        
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
    options?: Array<IOptions>;
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

export const convertColumnsConfigForFormField  = ( columnsConfig : Array<IFormFieldResponse> ):  Array<IFormField> => {
  return columnsConfig.map( columnConfig => {
      return {
          name: columnConfig.column,
          validationRules: convertValidationRules(columnConfig.validations),
          label: columnConfig.label,
          placeholder: columnConfig.placeholder ?? columnConfig.label,
          fieldType: columnConfig.fieldType ?? "text",
          options: columnConfig.options ?? [],
      } as IFormField
  })
}

export type { IFormField, IFormFieldResponse }

