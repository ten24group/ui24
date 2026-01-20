import React from 'react';
import { Button, Card, Form, Input, DatePicker, TimePicker, Typography, Switch, InputNumber, Slider, Badge, Tag, Progress, Avatar, Rate } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { OptionSelector, IOptions } from './OptionSelector';
import { useUi24Config } from '../../context';
import { CustomColorPicker } from '../../common/CustomColorPicker';
import { FileUploader, CustomBlockNoteEditor } from '../../common/';
import { CodeEditor } from '../../common/CodeEditor';
import { MarkdownPreview } from '../../common/MarkdownPreview';
import { HelpText, LabelAndHelpText } from './components';
import { formStyles } from './styles';
import { IFormField, IFormFieldResponse, IPreDefinedValidations, IOptions as IFieldOptions } from '../../types/field-config';
import { useFieldRenderer, type FormFieldConfig } from '../../registry';

const { TextArea } = Input;
const { Text } = Typography;

/**
 * Wrapper component for CodeEditor to properly integrate with Ant Design Form.Item
 * 
 * Form.Item expects child components to accept `value` and `onChange` props.
 * This wrapper ensures the string value from CodeEditor is properly passed to Form.Item.
 */
interface CodeEditorFormControlProps {
    value?: string;
    onChange?: (value: string) => void;
    language?: 'json' | 'html' | 'javascript' | 'handlebars' | 'text' | 'markdown';
    height?: number;
    readOnly?: boolean;
    darkTheme?: boolean;
    placeholder?: string;
    lineNumbers?: boolean;
    validateJson?: boolean;
}

const CodeEditorFormControl: React.FC<CodeEditorFormControlProps> = ({
    value,
    onChange,
    ...restProps
}) => {
    return (
        <CodeEditor
            value={value || ''}
            onChange={onChange}
            {...restProps}
        />
    );
};

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
    const { Component: CustomFieldRenderer, props: customFieldProps } = useFieldRenderer('' + (fieldType || ''), 'form', {
        fieldName: name,
        explicitRenderer: restFormItemProps.renderer,
        value: initialValue,
        onChange: (value: unknown) => setFormValue?.({ name, value }),
        placeholder,
        fieldOptions: options,
        validationRules,
        config: { ...restFormItemProps, name, fieldType, label } as Readonly<FormFieldConfig>
    });

    if (CustomFieldRenderer && customFieldProps) {
        return <>
            <Form.Item
                name={namePrefixPath?.length ? [ ...namePrefixPath, name ] : name}
                rules={validationRules}
                label={label}
                style={style}
                valuePropName={[ 'boolean', 'toggle', 'switch' ].includes(fieldType.toLocaleLowerCase()) ? "checked" : "value"}
            >
                <CustomFieldRenderer {...customFieldProps} />
            </Form.Item>
            <HelpText helpText={helpText} />
        </>;
    }

    // Built-in field types
    return <>
        <Form.Item
            name={namePrefixPath?.length ? [ ...namePrefixPath, name ] : name}
            rules={validationRules}
            label={label}
            style={style}
            valuePropName={[ 'boolean', 'toggle', 'switch' ].includes(fieldType.toLocaleLowerCase()) ? "checked" : "value"}
        >

            {fieldType === "text" && <Input type={fieldType || "text"} prefix={prefixIcon} placeholder={placeholder} />}
            {fieldType === "textarea" && <TextArea placeholder={placeholder} />}
            {fieldType === "password" && <Input.Password type={fieldType || "password"} prefix={prefixIcon} placeholder={placeholder} />}
            {fieldType === "email" && <Input type={fieldType || "email"} prefix={prefixIcon} placeholder={placeholder} />}
            {fieldType === "url" && <Input type="url" prefix={prefixIcon} placeholder={placeholder} />}
            {fieldType === "phone" && <Input type="tel" prefix={prefixIcon} placeholder={placeholder} />}
            {fieldType === "number" && <Input type="number" prefix={prefixIcon} placeholder={placeholder} />}
            {fieldType === "currency" && <InputNumber
                prefix={restFormItemProps.currencySymbol || '$'}
                placeholder={placeholder}
                style={{ width: '100%' }}
                precision={restFormItemProps.precision || 2}
            />}
            {fieldType === "percentage" && <InputNumber
                min={restFormItemProps.min || 0}
                max={restFormItemProps.max || 100}
                formatter={(value) => `${value}%`}
                parser={(value) => {
                    const parsed = value?.replace('%', '');
                    return parsed ? Number(parsed) : 0;
                }}
                placeholder={placeholder}
                style={{ width: '100%' }}
            />}
            {fieldType === "slider" && <Slider
                min={restFormItemProps.min || 0}
                max={restFormItemProps.max || 100}
                step={restFormItemProps.step || 1}
                marks={restFormItemProps.marks}
                vertical={restFormItemProps.vertical}
            />}
            {fieldType === "duration" && <InputNumber
                placeholder="Duration in seconds"
                style={{ width: '100%' }}
                min={0}
            />}
            {fieldType === "autocomplete" && <OptionSelector value={initialValue} fieldType={fieldType} options={options} addNewOption={addNewOption} onOptionChange={(newSelections) => {
                setFormValue && setFormValue({ name, value: newSelections })
            }} />}

            {fieldType === "checkbox" && <OptionSelector value={initialValue} fieldType={fieldType} options={options} />}
            {fieldType === "radio" && <OptionSelector value={initialValue} fieldType={fieldType} options={options} />}
            {fieldType === "select" && <OptionSelector value={initialValue} fieldType={fieldType} options={options} addNewOption={addNewOption} addNewOptionConfig={restFormItemProps.addNewOptionConfig} onOptionChange={(newSelections) => {
                setFormValue && setFormValue({ name, value: newSelections })
            }} />}
            {fieldType === "multi-select" && <OptionSelector value={initialValue} fieldType={fieldType} options={options} addNewOption={addNewOption} addNewOptionConfig={restFormItemProps.addNewOptionConfig} onOptionChange={(newSelections) => {
                setFormValue && setFormValue({ name, value: newSelections })
            }} />}

            {fieldType === 'color' && <CustomColorPicker format="hex" showText />}
            {fieldType === 'range' && <Input type="range" placeholder={placeholder} />}
            {fieldType === 'hidden' && <Input type="hidden" />}
            {fieldType === 'custom' && <Input placeholder={placeholder} />}
            {fieldType === 'rating' && <Rate allowHalf />}

            {/* New field types */}
            {fieldType === 'badge' && <Input placeholder={placeholder} addonAfter={<Badge status={restFormItemProps.status || 'default'} />} />}
            {fieldType === 'tag' && <Input placeholder={placeholder} />}
            {fieldType === 'tags' && <OptionSelector
                value={initialValue}
                fieldType="multi-select"
                options={options}
                onOptionChange={(newSelections) => {
                    setFormValue && setFormValue({ name, value: newSelections })
                }}
            />}
            {fieldType === 'progress' && <InputNumber
                min={restFormItemProps.min || 0}
                max={restFormItemProps.max || 100}
                formatter={(value) => `${value}%`}
                parser={(value) => {
                    const parsed = value?.replace('%', '');
                    return parsed ? Number(parsed) : 0;
                }}
                placeholder={placeholder}
                style={{ width: '100%' }}
            />}
            {fieldType === 'avatar' && <FileUploader
                accept="image/*"
                listType="picture-card"
                withImageCrop={true}
                fileNamePrefix={restFormItemProps.fileNamePrefix ?? 'avatar-'}
                getSignedUploadUrlAPIConfig={restFormItemProps.getSignedUploadUrlAPIConfig}
            />}
            {fieldType === 'icon' && <OptionSelector
                value={initialValue}
                fieldType="select"
                options={options}
                placeholder="Select icon"
            />}
            {fieldType === 'link' && <Input type="url" prefix={prefixIcon} placeholder={placeholder || "Enter URL"} />}
            {fieldType === 'video' && <FileUploader
                accept={restFormItemProps.accept ?? 'video/*'}
                listType="picture-card"
                fileNamePrefix={restFormItemProps.fileNamePrefix ?? 'video-'}
                getSignedUploadUrlAPIConfig={restFormItemProps.getSignedUploadUrlAPIConfig}
            />}
            {fieldType === 'audio' && <FileUploader
                accept={restFormItemProps.accept ?? 'audio/*'}
                listType="text"
                fileNamePrefix={restFormItemProps.fileNamePrefix ?? 'audio-'}
                getSignedUploadUrlAPIConfig={restFormItemProps.getSignedUploadUrlAPIConfig}
            />}
            {fieldType === 'qrcode' && <Input placeholder={placeholder || "Enter value for QR code"} />}

            {fieldType === "date" && <DatePicker format={formatConfig.date} />}
            {fieldType === "datetime" && <DatePicker format={formatConfig.datetime} showTime />}
            {fieldType === "time" && <TimePicker format={formatConfig.time} />}

            {fieldType === "file" &&
                <FileUploader
                    accept={restFormItemProps[ 'accept' ] ?? undefined}
                    listType={(restFormItemProps[ 'listType' ] as 'text' | 'picture' | 'picture-card') ?? 'picture-card'}
                    // config for the default image uploader
                    fileNamePrefix={restFormItemProps[ 'fileNamePrefix' ] ?? undefined}
                    getSignedUploadUrlAPIConfig={restFormItemProps[ 'getSignedUploadUrlAPIConfig' ] ?? undefined}
                />
            }

            {fieldType === "image" &&
                <FileUploader
                    accept={restFormItemProps[ 'accept' ] ?? 'image/*'}
                    listType={(restFormItemProps[ 'listType' ] as 'text' | 'picture' | 'picture-card') ?? 'picture-card'}
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

            {fieldType.toLocaleLowerCase() === 'markdown' && restFormItemProps[ 'readOnly' ] ? (
                // Markdown in read-only mode: show preview
                <MarkdownPreview />
            ) : [ 'code', 'markdown', 'json' ].includes(fieldType.toLocaleLowerCase()) ? (
                // Code/Markdown/JSON in edit mode: show editor
                <CodeEditorFormControl
                    language={fieldType.toLocaleLowerCase() === 'code' ? (restFormItemProps[ 'codeLanguage' ] || 'text') : fieldType.toLocaleLowerCase() as 'json' | 'markdown'}
                    height={restFormItemProps[ 'height' ] ?? 300}
                    readOnly={restFormItemProps[ 'readOnly' ] ?? false}
                    darkTheme={restFormItemProps[ 'darkTheme' ] ?? false}
                    placeholder={placeholder}
                    lineNumbers={restFormItemProps[ 'lineNumbers' ] ?? true}
                    validateJson={restFormItemProps[ 'validateJson' ] ?? true}
                />
            ) : null}
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
    const fieldName = namePrefixPath?.length ? [ ...namePrefixPath, name ] : name;

    // Convert Form.List rules to Form.Item compatible validator
    // Form.List rules expect { validator } format, but Form.Item needs standard rules
    const listValidationRules = (validationRules || []).map((rule: any) => {
        // If rule has 'required: true', convert to a custom validator for list
        if (rule.required) {
            return {
                validator: async (_: any, value: any) => {
                    if (!value || (Array.isArray(value) && value.length === 0)) {
                        return Promise.reject(new Error(rule.message || `${label} is required`));
                    }
                    return Promise.resolve();
                }
            };
        }
        return rule;
    });

    // For complex list items (list of objects), use the card-based approach
    return <>
        {label && <LabelAndHelpText label={label} helpText={helpText} />}
        {/* Wrap Form.List in Form.Item for proper validation display */}
        <Form.Item
            name={fieldName}
            rules={listValidationRules}
            style={{ marginBottom: 0 }}
        >
            <Form.List name={fieldName}>
                {(fields, { add, remove }, { errors }) => {
                    return <div style={formStyles.listContainer}>
                        {fields.map((field) => (
                            <Card
                                size="small"
                                title={`${label} ${field.name + 1}`}
                                key={field.key}
                                extra={<CloseOutlined onClick={() => { remove(field.name); }} />}
                            >
                                {/* for complex list items (list of objects) */}
                                {items.properties && items.properties.length > 0 &&
                                    items.properties.map((property: any) => {
                                        return <RenderFormField {...property} namePrefixPath={[ field.name ]}
                                            setFormValue={({ name, value }) => {
                                                setFormValue({ name: parentFieldName, value: { [ name ]: value }, index: field.name })
                                            }}
                                        />
                                    })
                                }

                                {/* for simple list items (like string arrays) */}
                                {(!items.properties || items.properties.length === 0) &&
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

                        {/* Display Form.List level errors */}
                        <Form.ErrorList errors={errors} />

                        <Button type="dashed" onClick={() => add()} block> + Add {label} </Button>
                    </div>
                }}
            </Form.List>
        </Form.Item>
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

const convertValidationRules = (validationRules: Array<IPreDefinedValidations>, label?: string) => {
    const fieldLabel = label || 'This field';
    return (validationRules ?? []).map(validationRule => {
        let antValidationRule = {}
        if (validationRule === "required") {
            antValidationRule = { ...antValidationRule, required: true, message: `${fieldLabel} is required` }
        } else if (validationRule === "email") {
            antValidationRule = { ...antValidationRule, type: 'email', message: 'Please enter a valid email address' }
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
            ...columnConfig, // Spread all base properties to include field type metadata (min, max, step, etc.)
            name: columnConfig.column, //! Fixme: this conflicts with antd's column prop for ui column size.. need better handling
            validationRules: convertValidationRules(columnConfig.validations, columnConfig.label),
            label: columnConfig.label,
            placeholder: columnConfig.placeholder ?? columnConfig.label,
            helpText: columnConfig.helpText,
            fieldType: columnConfig.fieldType ?? "text",
            defaultValue: columnConfig.defaultValue, // Pass through default value from backend
            options: columnConfig.options ?? [],
            addNewOption: columnConfig?.addNewOption,
            addNewOptionConfig: columnConfig?.addNewOptionConfig,
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