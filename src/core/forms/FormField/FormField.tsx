import React, { ReactNode, useEffect } from 'react';
import { Checkbox, DatePicker, Form, Input, Radio, Switch, TimePicker,  Select as AntSelect } from 'antd';
import { OptionSelector, IFieldOptions, IOptions } from './OptionSelector';
import { useApi, useUi24Config } from '../../context';
import { CustomColorPicker } from '../../common/CustomColorPicker';
import { IModalConfig } from '../../../modal/Modal';

import {FileUploader, GetSignedUploadUrlAPIConfig, CustomBlockNoteEditor} from '../../common/';

export type IFormFieldType = "text" | "password" | "email" | "textarea" | "checkbox" | "radio" | "select" | "multi-select" | "color" | "switch" | "date" | "time" | "datetime" | "wysiwyg" | "file" | "boolean" | "toggle" | "rich-text" | "image";


interface IFormField {
    name: string; //unique identifier, should be without spaces
    validationRules?: Array<any>; //rules matching ant design convention
    placeholder: string; //placeholder text
    prefixIcon?: ReactNode; //prefix icon as a react component
    fieldType?: IFormFieldType; //field type
    options?: IFieldOptions; //options for select, radio, checkbox
    addNewOption?: IModalConfig; //add new option for select, multi-select
    label: string;
    style?: React.CSSProperties;
    initialValue?: any;
    setFormValue?: Function
}

const { TextArea } = Input;
export function FormField( {fieldType = "text", name, validationRules, label = "", prefixIcon, placeholder = "", options = [], style, initialValue, setFormValue, addNewOption, ...restFormItemProps } : IFormField ) {
    
    const { selectConfig } = useUi24Config()
    const formatConfig = selectConfig( config => config.formatConfig )

    return <div style={{ marginBottom: "24px" }} key={"CustomFormFields"}>
      <Form.Item name={ name } rules={ validationRules } label={ label } style={ style } initialValue={initialValue} >
        { fieldType === "text" && <span><Input type={ fieldType || "text" } prefix={ prefixIcon } placeholder={ placeholder } /> </span>}
        { fieldType === "textarea" && <TextArea placeholder={ placeholder } />}
        { fieldType === "password" && <Input.Password type={ fieldType || "password" } prefix={ prefixIcon } placeholder={ placeholder } /> }
        { fieldType === "email" && <Input type={ fieldType || "email" } prefix={ prefixIcon } placeholder={ placeholder } /> }
        
        { fieldType === "checkbox" && <OptionSelector fieldType={ fieldType } options={ options } />}
        { fieldType === "radio" && <OptionSelector fieldType={ fieldType } options={ options } />}
        { fieldType === "select" && <OptionSelector fieldType={ fieldType } options={ options } addNewOption={ addNewOption } onOptionChange={ (newSelections) => {
            setFormValue( { name, value: newSelections } )
        }}/>}
        { fieldType === "multi-select" && <OptionSelector fieldType={ fieldType } options={ options } addNewOption={ addNewOption } onOptionChange={ (newSelections) => {
            setFormValue( { name, value: newSelections } )
        }} />}

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
    addNewOption?: IModalConfig;

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
            addNewOption: columnConfig?.addNewOption,

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

