import React, { Component, ReactNode } from 'react';
import { Button, Card, Checkbox, DatePicker, Form, Input, Radio, Select, Switch, TimePicker } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

import { callApiMethod } from '../../api/apiMethods';
import { UI24Config } from '../../config/config';
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
    namePrefixPath?: any[];
    name: string; //unique identifier, should be without spaces
    validationRules?: Array<any>; //rules matching ant design convention
    placeholder: string; //placeholder text
    prefixIcon?: ReactNode; //prefix icon as a react component
    fieldType?: IFormFieldType; //field type
    options?: Array<IOptions>; //options for select, radio, checkbox
    label: string;
    style?: React.CSSProperties;
    initialValue?: any;

    // for list and map fields
    type?: string;
    properties?: Array<IFormField>
    items?: {
        type: string,
        properties?: Array<IFormField>
    }
}

const { TextArea } = Input;

const makeFormItem = ({
        fieldType = "text", 
        namePrefixPath,
        name, 
        validationRules, 
        label = "", 
        prefixIcon, 
        placeholder = "", 
        options = [], 
        style, 
        initialValue, 
        ...restFormItemProps
    }: IFormField) => {
    return <>
        <Form.Item 
            name={ namePrefixPath?.length ? [...namePrefixPath, name] : name } 
            rules={ validationRules } 
            label={ label } 
            style={ style } 
            initialValue={initialValue} 
        >

        { fieldType === "text" && <Input type={ fieldType || "text" } prefix={ prefixIcon } placeholder={ placeholder } /> }
        { fieldType === "textarea" && <TextArea placeholder={ placeholder } />}
        { fieldType === "password" && <Input.Password type={ fieldType || "password" } prefix={ prefixIcon } placeholder={ placeholder } /> }
        { fieldType === "email" && <Input type={ fieldType || "email" } prefix={ prefixIcon } placeholder={ placeholder } /> }
        { fieldType === "checkbox" && <Checkbox.Group options={ options as Array<IOptions> }>{ label }</Checkbox.Group> }
        { fieldType === "radio" && <Radio.Group options={ options as Array<IOptions> } />}
        { fieldType === "select" && <Select options={ options as Array<IOptions> } />}
        { fieldType === "multi-select" && <Select mode='multiple' options={ options as Array<IOptions> } />}

        { fieldType === 'color' && <CustomColorPicker /> }

        { fieldType === "date" && <DatePicker format={UI24Config.formatConfig.date} />}
        { fieldType === "time" && <TimePicker format={UI24Config.formatConfig.time} />}
        { fieldType === "datetime" && <DatePicker format={UI24Config.formatConfig.datetime} showTime />}

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
    </>
}

const makeFormListItem = ({
    name, 
    namePrefixPath,
    validationRules, 
    label = "", 
    initialValue, 
    items,
}: IFormField) => {
    return <>
        <Form.List 
        name={ namePrefixPath?.length ? [...namePrefixPath, name] : name } 
            rules={ validationRules } 
            initialValue={initialValue} 
        >
        {(fields, { add, remove }) => (
            <div style={{ display: 'flex', rowGap: 16, flexDirection: 'column' }}>
                {fields.map((field) => (
                    <Card
                        size="small"
                        title={`${label} ${field.name + 1}`}
                        key={field.key}
                        extra={ <CloseOutlined onClick={() => { remove(field.name); }} /> }
                    >
                        {
                            items.properties.map( (property) => {
                                return makeFormItem({
                                    ...property,
                                    namePrefixPath: namePrefixPath?.length ? [...namePrefixPath, field.name] : [field.name]
                                })
                            })
                        }
                    </Card>
                ))}

                <Button type="dashed" onClick={() => add()} block> + Add {label} </Button>
            </div>
        )}
        </Form.List>
    </>
}
export function FormField( formField : IFormField ) {

    const {
        fieldType = "text",
        type,
    } = formField;

    return <div style={{ marginBottom: "24px" }} key={"CustomFormFields"}>
        { ( type === 'list' && !['wysiwyg', 'rich-text'].includes(fieldType.toLocaleLowerCase()) ) 
            ? makeFormListItem(formField) 
            : makeFormItem(formField) 
        }
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

    // list and map fields
    type?: string;
    properties?: Array<IFormFieldResponse>
    items?: {
        type: string,
        properties?: Array<IFormFieldResponse>
    }
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

            // for list and map fields
            type: columnConfig.type,
            properties: columnConfig.properties ? convertColumnsConfigForFormField(columnConfig.properties) : [],
            items: {
                ...(columnConfig.items || {}),
                properties: columnConfig.items?.properties ? convertColumnsConfigForFormField(columnConfig.items.properties) : []
            }
      } as IFormField
  })
}

export type { IFormField, IFormFieldResponse }

