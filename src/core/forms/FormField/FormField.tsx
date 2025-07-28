import React, { ReactNode, useEffect } from 'react';
import { Button, Card, Checkbox, DatePicker, Form, Input, Radio, Switch, TimePicker, Select as AntSelect } from 'antd';
import { OptionSelector, IFieldOptions, IOptions } from './OptionSelector';
import { useApi, useUi24Config } from '../../context';
import { CloseOutlined } from '@ant-design/icons';
import { CustomColorPicker } from '../../common/CustomColorPicker';
import { IModalConfig } from '../../../modal/Modal';

import { FileUploader, GetSignedUploadUrlAPIConfig, CustomBlockNoteEditor } from '../../common/';

export type IFormFieldType = "text" | "password" | "email" | "textarea" | "checkbox" | "radio" | "select" | "multi-select" | "color" | "switch" | "date" | "time" | "datetime" | "wysiwyg" | "file" | "boolean" | "toggle" | "rich-text" | "image";


interface IFormField {
    namePrefixPath?: any[];
    name: string; //unique identifier, should be without spaces
    validationRules?: Array<any>; //rules matching ant design convention
    placeholder: string; //placeholder text
    prefixIcon?: ReactNode; //prefix icon as a react component
    fieldType?: IFormFieldType; //field type
    timezone?: string;
    options?: IFieldOptions; //options for select, radio, checkbox
    addNewOption?: IModalConfig; //add new option for select, multi-select
    label: string;
    style?: React.CSSProperties;
    initialValue?: any;
    setFormValue?: Function;

    // for list and map fields
    type?: string;
    properties?: Array<IFormField>
    items?: {
        type: string,
        properties?: Array<IFormField>
    }
}

const { TextArea } = Input;

const MakeFormItem = ({
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
        >

            {fieldType === "text" && <Input type={fieldType || "text"} prefix={prefixIcon} placeholder={placeholder} />}
            {fieldType === "textarea" && <TextArea placeholder={placeholder} />}
            {fieldType === "password" && <Input.Password type={fieldType || "password"} prefix={prefixIcon} placeholder={placeholder} />}
            {fieldType === "email" && <Input type={fieldType || "email"} prefix={prefixIcon} placeholder={placeholder} />}

            {fieldType === "checkbox" && <OptionSelector value={initialValue} fieldType={fieldType} options={options} />}
            {fieldType === "radio" && <OptionSelector value={initialValue} fieldType={fieldType} options={options} />}
            {fieldType === "select" && <OptionSelector value={initialValue} fieldType={fieldType} options={options} addNewOption={addNewOption} onOptionChange={(newSelections) => {
                setFormValue && setFormValue({ name, value: newSelections })
            }} />}
            {fieldType === "multi-select" && <OptionSelector value={initialValue} fieldType={fieldType} options={options} addNewOption={addNewOption} onOptionChange={(newSelections) => {
                setFormValue && setFormValue({ name, value: newSelections })
            }} />}

            {fieldType === 'color' && <CustomColorPicker />}

            {fieldType === "date" && <DatePicker format={formatConfig.date} />}
            {fieldType === "datetime" && <DatePicker format={formatConfig.datetime} showTime />}
            {fieldType === "time" && <TimePicker format={formatConfig.time} />}

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
}: IFormField) => {
    const parentFieldName = name;
    return <>
        <Form.List
            name={namePrefixPath?.length ? [ ...namePrefixPath, name ] : name}
            rules={validationRules}
            initialValue={initialValue}
        >
            {(fields, { add, remove }) => {
                return <div style={{ display: 'flex', rowGap: 16, flexDirection: 'column' }}>
                    {fields.map((field) => (
                        <Card
                            size="small"
                            title={`${label} ${field.name + 1}`}
                            key={field.key}
                            extra={<CloseOutlined onClick={() => { remove(field.name); }} />}
                        >
                            {
                                items.properties.map((property: any) => {
                                    return <MakeFormItem {...property} namePrefixPath={namePrefixPath?.length ? [ ...namePrefixPath, field.name ] : [ field.name ]}
                                        setFormValue={({ name, value }) => {
                                            setFormValue({ name: parentFieldName, value: { [ name ]: value }, index: field.key })
                                        }}
                                    />
                                })
                            }
                        </Card>
                    ))}

                    <Button type="dashed" onClick={() => add()} block> + Add {label} </Button>
                </div>
            }}
        </Form.List>
    </>
}
export function FormField(formField: IFormField) {

    const {
        fieldType = "text",
        type,
    } = formField;

    return <div style={{ marginBottom: "24px" }} key={"CustomFormFields"}>
        {(type === 'list' && ![ 'wysiwyg', 'rich-text', 'multi-select' ].includes(fieldType.toLocaleLowerCase()))
            ? <MakeFormListItem {...formField} />
            : <MakeFormItem {...formField} />
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
    addNewOption?: IModalConfig;

    //for image and file
    accept?: string;
    fileNamePrefix?: string;
    listType?: string;
    getSignedUploadUrlAPIConfig?: GetSignedUploadUrlAPIConfig,
    withImageCrop?: boolean;

    // list and map fields
    type?: string;
    properties?: Array<IFormFieldResponse>
    items?: {
        type: string,
        properties?: Array<IFormFieldResponse>
    }
}

const convertValidationRules = (validationRules: Array<IPreDefinedValidations>) => {
    return validationRules.map(validationRule => {
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

