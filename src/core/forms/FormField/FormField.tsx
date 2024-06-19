import React, { ReactNode, useEffect } from 'react';
import { Checkbox, DatePicker, Form, Input, Radio, Select, Switch, TimePicker } from 'antd';
import { useApi, useUi24Config } from '../../context';
import { CustomColorPicker } from '../../common/CustomColorPicker';

import {FileUploader, GetSignedUploadUrlAPIConfig, CustomBlockNoteEditor} from '../../common/';

type IFormFieldType = "text" | "password" | "email" | "textarea" | "checkbox" | "radio" | "select" | "multi-select" | "color" | "switch" | "date" | "time" | "datetime" | "wysiwyg" | "file" | "boolean" | "toggle" | "rich-text" | "image";

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
    options?: FieldOptions; //options for select, radio, checkbox
    label: string;
    style?: React.CSSProperties;
    initialValue?: any;
    setFormPropertiesConfig?: Function
}

const { TextArea } = Input;
export function FormField( {fieldType = "text", name, validationRules, label = "", prefixIcon, placeholder = "", options = [], style, initialValue, setFormPropertiesConfig, ...restFormItemProps } : IFormField ) {
    
    const { callApiMethod } = useApi()
    const { selectConfig } = useUi24Config()
    const formatConfig = selectConfig( config => config.formatConfig )

    const fetchFieldOptions = async (config: FieldOptionsAPIConfig): Promise<Array<IOptions>> => {
    
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

    useEffect( () => {
        const fetchOptions = async () => {
            if( ['select', 'multi-select', 'checkbox', 'radio'].includes(fieldType.toLocaleLowerCase())){
                if( typeof options === 'object' && isFieldOptionsAPIConfig(options) ){
                    const apiOptions = await fetchFieldOptions(options as FieldOptionsAPIConfig)
                    if( apiOptions.length > 0 ) {
                        setFormPropertiesConfig( { name, options: apiOptions } )
                    }
                }
            }
        }
        fetchOptions()
    }, [options] )

    return <div style={{ marginBottom: "24px" }} key={"CustomFormFields"}>
      <Form.Item name={ name } rules={ validationRules } label={ label } style={ style } initialValue={initialValue} >
        { fieldType === "text" && <Input type={ fieldType || "text" } prefix={ prefixIcon } placeholder={ placeholder } /> }
        { fieldType === "textarea" && <TextArea placeholder={ placeholder } />}
        { fieldType === "password" && <Input.Password type={ fieldType || "password" } prefix={ prefixIcon } placeholder={ placeholder } /> }
        { fieldType === "email" && <Input type={ fieldType || "email" } prefix={ prefixIcon } placeholder={ placeholder } /> }
        { fieldType === "checkbox" && <Checkbox.Group options={ Array.isArray(options) ? options: [] }>{ label }</Checkbox.Group> }
        { fieldType === "radio" && <Radio.Group options={ Array.isArray(options) ? options: [] } />}
        { fieldType === "select" && <Select options={ Array.isArray(options) ? options: [] } />}
        { fieldType === "multi-select" && <Select mode='multiple' options={ Array.isArray(options) ? options: [] } />}

        { fieldType === 'color' && <CustomColorPicker /> }

        { fieldType === "date" && <DatePicker format={formatConfig.date} />}
        { fieldType === "datetime" && <DatePicker format={formatConfig.datetime} showTime />}
        { fieldType === "time" && <TimePicker format={formatConfig.time} />}

        { fieldType === "file" && 
            <FileUploader 
                accept= { restFormItemProps['accept'] ?? undefined}  
            />
        }
        
        { fieldType === "image" && 
            <FileUploader 
                accept= { restFormItemProps['accept'] ?? 'image/*'}  
                listType={ restFormItemProps['listType'] ?? 'picture-card'} 
                withImageCrop = {restFormItemProps['withImageCrop'] ?? true} 

                 // config for the default image uploader
                fileNamePrefix = { restFormItemProps['fileNamePrefix'] ?? undefined}
                getSignedUploadUrlAPIConfig  = { restFormItemProps['getSignedUploadUrlAPIConfig'] ?? undefined}
            />
        }

        { ['boolean', 'toggle', 'switch'].includes( fieldType.toLocaleLowerCase() ) && <Switch/>}

        {/* { ['rich-text', 'wysiwyg'].includes( fieldType.toLocaleLowerCase()) && <CustomEditorJs tools={EDITOR_JS_TOOLS} minHeight={50} /> } */}
        { ['rich-text', 'wysiwyg'].includes( fieldType.toLocaleLowerCase()) && 
            <CustomBlockNoteEditor 
                
                theme = { restFormItemProps['theme'] ?? undefined}
                readOnly = { restFormItemProps['readOnly'] ?? undefined}
                
                // config for the default image uploader
                fileNamePrefix = { restFormItemProps['fileNamePrefix'] ?? undefined}
                getSignedUploadUrlAPIConfig  = { restFormItemProps['getSignedUploadUrlAPIConfig'] ?? undefined}

                // custom uploader function
                uploadFile = { restFormItemProps['uploadFile'] ?? undefined}
            />
        }

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

    //for image and file
    accept?: string;
    fileNamePrefix?: string;
    listType?: string;
    getSignedUploadUrlAPIConfig ?: GetSignedUploadUrlAPIConfig,
    withImageCrop?: boolean;

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

            // for image and files
            accept: columnConfig.accept,
            listType: columnConfig.listType,
            withImageCrop: columnConfig.withImageCrop,
            fileNamePrefix:  columnConfig.fileNamePrefix,
            getSignedUploadUrlAPIConfig: columnConfig.getSignedUploadUrlAPIConfig,
          
      } as IFormField
  })
}

export type { IFormField, IFormFieldResponse }

