import React, { ReactNode, useEffect } from 'react';
import { Button, Card, Checkbox, DatePicker, Form, Input, Radio, Switch, TimePicker, Select as AntSelect, Typography } from 'antd';
import { OptionSelector, IFieldOptions, IOptions } from './OptionSelector';
import { useApi, useUi24Config } from '../../context';
import { CloseOutlined } from '@ant-design/icons';
import { CustomColorPicker } from '../../common/CustomColorPicker';
import { IModalConfig } from '../../../modal/Modal';

import { FileUploader, GetSignedUploadUrlAPIConfig, CustomBlockNoteEditor } from '../../common/';
import { FieldType, PropertyType, ValidationType } from '../../types/field-types';
import { HelpText, LabelAndHelpText } from './components';
import { formStyles } from './styles';



interface IFormField {
    namePrefixPath?: any[];
    id?: string;
    column?: string;
    name: string; //unique identifier, should be without spaces
    validationRules?: Array<any>; //rules matching ant design convention
    placeholder: string; //placeholder text
    helpText?: string; //help text for the field
    prefixIcon?: ReactNode; //prefix icon as a react component
    fieldType?: FieldType; //field type
    timezone?: string;
    options?: IFieldOptions; //options for select, radio, checkbox
    addNewOption?: IModalConfig; //add new option for select, multi-select
    label: string;
    style?: React.CSSProperties;
    initialValue?: any;
    setFormValue?: Function;
    hidden?: boolean; //whether to hide this field from display

    // for list and map fields
    type?: PropertyType;
    properties?: Array<IFormField>
    items?: {
        type: PropertyType,
        properties?: Array<IFormField>
    }
}

const { TextArea } = Input;
const { Text } = Typography;



const MakeFormItem = ({
    fieldType = "text",
    namePrefixPath,
    name,
    validationRules,
    label = "",
    prefixIcon,
    placeholder = "",
    helpText,
    options = [],
    style,
    initialValue,
    setFormValue,
    addNewOption,
    ...restFormItemProps
}: IFormField) => {

    const { selectConfig } = useUi24Config();
    const formatConfig = selectConfig(config => config.formatConfig);
    return <>
        <Form.Item
            name={namePrefixPath?.length ? [ ...namePrefixPath, name ] : name}
            rules={validationRules}
            label={label}
            style={style}
            initialValue={initialValue}
            valuePropName={[ 'boolean', 'toggle', 'switch' ].includes(fieldType.toLocaleLowerCase()) ? "checked" : "value"}
        >

            {fieldType === "text" && <Input type={fieldType || "text"} prefix={prefixIcon} placeholder={placeholder} />}
            {fieldType === "textarea" && <TextArea placeholder={placeholder} />}
            {fieldType === "password" && <Input.Password type={fieldType || "password"} prefix={prefixIcon} placeholder={placeholder} />}
            {fieldType === "email" && <Input type={fieldType || "email"} prefix={prefixIcon} placeholder={placeholder} />}
            {fieldType === "number" && <Input type="number" prefix={prefixIcon} placeholder={placeholder} />}
            {fieldType === "autocomplete" && <OptionSelector value={initialValue} fieldType={fieldType} options={options} addNewOption={addNewOption} onOptionChange={(newSelections) => {
                setFormValue && setFormValue({ name, value: newSelections })
            }} />}

            {fieldType === "checkbox" && <OptionSelector value={initialValue} fieldType={fieldType} options={options} />}
            {fieldType === "radio" && <OptionSelector value={initialValue} fieldType={fieldType} options={options} />}
            {fieldType === "select" && <OptionSelector value={initialValue} fieldType={fieldType} options={options} addNewOption={addNewOption} onOptionChange={(newSelections) => {
                setFormValue && setFormValue({ name, value: newSelections })
            }} />}
            {fieldType === "multi-select" && <OptionSelector value={initialValue} fieldType={fieldType} options={options} addNewOption={addNewOption} onOptionChange={(newSelections) => {
                setFormValue && setFormValue({ name, value: newSelections })
            }} />}

            {fieldType === 'color' && <CustomColorPicker />}
            {fieldType === 'range' && <Input type="range" placeholder={placeholder} />}
            {fieldType === 'hidden' && <Input type="hidden" />}
            {fieldType === 'custom' && <Input placeholder={placeholder} />}
            {fieldType === 'rating' && <Input type="number" min={1} max={5} placeholder={placeholder} />}

            {fieldType === "date" && <DatePicker format={formatConfig.date} />}
            {fieldType === "datetime" && <DatePicker format={formatConfig.datetime} showTime />}
            {fieldType === "time" && <TimePicker format={formatConfig.time} />}

            {fieldType === "json" && (<>
                <TextArea rows={8} placeholder={placeholder} />
            </>)}
            {fieldType === "code" && (<>
                <TextArea rows={8} placeholder={placeholder} />
            </>)}
            {fieldType === "markdown" && (<>
                <TextArea rows={8} placeholder={placeholder} />
            </>)}

            {fieldType === "file" &&
                <FileUploader
                    accept={restFormItemProps[ 'accept' ] ?? undefined}
                    listType={restFormItemProps[ 'listType' ] ?? 'picture-card'}
                    // config for the default image uploader
                    fileNamePrefix={restFormItemProps[ 'fileNamePrefix' ] ?? undefined}
                    getSignedUploadUrlAPIConfig={restFormItemProps[ 'getSignedUploadUrlAPIConfig' ] ?? undefined}
                />
            }

            {fieldType === "image" &&
                <FileUploader
                    accept={restFormItemProps[ 'accept' ] ?? 'image/*'}
                    listType={restFormItemProps[ 'listType' ] ?? 'picture-card'}
                    withImageCrop={restFormItemProps[ 'withImageCrop' ] ?? true}

                    // config for the default image uploader
                    fileNamePrefix={restFormItemProps[ 'fileNamePrefix' ] ?? undefined}
                    getSignedUploadUrlAPIConfig={restFormItemProps[ 'getSignedUploadUrlAPIConfig' ] ?? undefined}
                />
            }

            {[ 'boolean', 'toggle', 'switch' ].includes(fieldType.toLocaleLowerCase()) && <Switch />}

            {[ 'rich-text', 'wysiwyg' ].includes(fieldType.toLocaleLowerCase()) &&
                <CustomBlockNoteEditor

                    theme={restFormItemProps[ 'theme' ] ?? undefined}
                    readOnly={restFormItemProps[ 'readOnly' ] ?? undefined}

                    // config for the default image uploader
                    fileNamePrefix={restFormItemProps[ 'fileNamePrefix' ] ?? undefined}
                    getSignedUploadUrlAPIConfig={restFormItemProps[ 'getSignedUploadUrlAPIConfig' ] ?? undefined}

                    // custom uploader function
                    uploadFile={restFormItemProps[ 'uploadFile' ] ?? undefined}
                />
            }
        </Form.Item>
        <HelpText helpText={helpText} />
    </>
}



const MakeFormListItem = ({
    name,
    namePrefixPath,
    validationRules,
    label = "",
    initialValue,
    items,
    setFormValue,
    helpText,
}: IFormField) => {
    const parentFieldName = name;
        
    // For complex list items (list of objects), use the card-based approach
    return <>
        {label && <LabelAndHelpText label={label} helpText={helpText} />}
        <Form.List
            name={namePrefixPath?.length ? [ ...namePrefixPath, name ] : name}
            rules={validationRules}
            initialValue={initialValue}
        >
            {(fields, { add, remove }) => {
                return <div style={formStyles.listContainer}>
                    {fields.map((field) => (
                        <Card
                            size="small"
                            title={`${label} ${field.name + 1}`}
                            key={field.key}
                            extra={<CloseOutlined onClick={() => { remove(field.name); }} />}
                        >
                            {/* for complex list items (list of objects) */}
                            { items.properties && items.properties.length > 0 &&
                                items.properties.map((property: any) => {
                                    return <MakeFormItem {...property} namePrefixPath={namePrefixPath?.length ? [ ...namePrefixPath, field.name ] : [ field.name ]}
                                        setFormValue={({ name, value }) => {
                                            setFormValue({ name: parentFieldName, value: { [ name ]: value }, index: field.key })
                                        }}
                                    />
                                })
                            }

                            {/* for simple list items (like string arrays) */}
                            { (!items.properties || items.properties.length === 0) &&
                                <Form.Item
                                    {...field}
                                    name={[ field.name ]}
                                    style={{ flex: 1, marginBottom: 0 }}
                                >
                                    <Input placeholder={`Enter ${label.toLowerCase()} value`} />
                                </Form.Item>
                            }
                        </Card>
                    ))}

                    <Button type="dashed" onClick={() => add()} block> + Add {label} </Button>
                </div>
            }}
        </Form.List>
    </>
}

const MakeFormMapItem = ({
    name,
    namePrefixPath,
    label = "",
    properties,
    setFormValue,
    helpText,
}: IFormField) => {
    const parentFieldName = name;
    
    return <>
        {label && <LabelAndHelpText label={label} helpText={helpText} />}
        <Card size="small" style={{ backgroundColor: "#8080801c" }} >
            <div style={formStyles.mapCardContainer}>
                {properties?.map((property: IFormField, index: number) => (
                    <div key={property.name || index} style={formStyles.mapItemContainer}>
                        <RenderFormField 
                            {...property} 
                            namePrefixPath={namePrefixPath?.length ? [ ...namePrefixPath, name ] : [ name ]}
                            setFormValue={({ name: propName, value }) => {
                                setFormValue({ name: parentFieldName, value: { [ propName ]: value } })
                            }}
                        />
                    </div>
                ))}
            </div>
        </Card>
    </>
}

// Unified recursive form field renderer
const RenderFormField = (formField: IFormField) => {
    const {
        fieldType = "text",
        type,
    } = formField;

    // Handle list fields
    if (type === 'list' && ![ 'wysiwyg', 'rich-text', 'multi-select' ].includes(fieldType.toLocaleLowerCase())) {
        return <MakeFormListItem {...formField} />
    }
    
    // Handle map fields
    if (type === 'map') {
        return <MakeFormMapItem {...formField} />
    }
    
    // Handle regular form items
    return <MakeFormItem {...formField} />
}

export function FormField(formField: IFormField) {
    // Don't render hidden fields
    if (formField.hidden) {
        return null;
    }
    
    return <div key={formField.column || formField.name || formField.id}>
        <RenderFormField {...formField} />
    </div>
}

type IPreDefinedValidations = "required" | "email" | `match:${string}`;
interface IFormFieldResponse {
    column: string;
    label: string;
    placeholder: string;
    helpText?: string;
    validations: Array<IPreDefinedValidations>;
    fieldType?: FieldType;
    options?: Array<IOptions>;
    addNewOption?: IModalConfig;
    hidden?: boolean; //whether to hide this field from display

    //for image and file
    accept?: string;
    fileNamePrefix?: string;
    listType?: string;
    getSignedUploadUrlAPIConfig?: GetSignedUploadUrlAPIConfig,
    withImageCrop?: boolean;

    // list and map fields
    type?: PropertyType;
    properties?: Array<IFormFieldResponse>
    items?: {
        type: PropertyType,
        properties?: Array<IFormFieldResponse>
    }
}

const convertValidationRules = (validationRules: Array<IPreDefinedValidations>) => {
    return (validationRules ?? []).map(validationRule => {
        let antValidationRule = {}
        if (validationRule === "required") {
            antValidationRule = { ...antValidationRule, required: true }
        } else if (validationRule === "email") {
            antValidationRule = { ...antValidationRule, type: 'email' }
        } else if (validationRule.includes("match:")) {
            const targetColumn = validationRule.split(':').pop()
            antValidationRule = ({ getFieldValue }) => ({
                validator(_, value) {
                    if (!value || getFieldValue(targetColumn) === value) {
                        return Promise.resolve();
                    }
                    return Promise.reject(new Error(`This field does not match with "${targetColumn}" !`));
                },
            })
        }
        return antValidationRule
    })
}

export const convertColumnsConfigForFormField = (columnsConfig: Array<IFormFieldResponse>): Array<IFormField> => {
    return columnsConfig.map(columnConfig => {
        return {
            name: columnConfig.column, //! Fixme: this conflicts with antd's column prop for ui column size.. need better handling
            validationRules: convertValidationRules(columnConfig.validations),
            label: columnConfig.label,
            placeholder: columnConfig.placeholder ?? columnConfig.label,
            helpText: columnConfig.helpText,
            fieldType: columnConfig.fieldType ?? "text",
            options: columnConfig.options ?? [],
            addNewOption: columnConfig?.addNewOption,
            hidden: columnConfig.hidden,

            // for image and files
            accept: columnConfig.accept,
            listType: columnConfig.listType,
            withImageCrop: columnConfig.withImageCrop,
            fileNamePrefix: columnConfig.fileNamePrefix,
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