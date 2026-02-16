import React from 'react';
import { Button, Card, Form, Input, Tooltip } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useUi24Config } from '../../context';
import { HelpText, LabelAndHelpText } from './components';
import { formStyles } from './styles';
import { IFormField, IFormFieldResponse, IPreDefinedValidations } from '../../types/field-config';
import { useFieldRenderer, type FormFieldConfig } from '../../registry';
import { resolveStringOrDefault } from '../../types/evaluation';
import { fieldTypeRegistry } from '../../registry/FieldTypeRegistry';
import '../../registry/field-types'; // ensure built-in registrations run
import type { BuiltInFormFieldProps } from '../../registry/field-types/types';

/**
 * Internal form field props type where ConditionalValue fields have been resolved to strings.
 * Used by internal rendering components (MakeFormItem, MakeFormListItem, MakeFormMapItem)
 * which are always called via FormField (which resolves ConditionalValues).
 */
type ResolvedFormField = Omit<IFormField, 'label' | 'placeholder' | 'helpText' | 'renderer'> & {
    label: string;
    placeholder?: string;
    helpText?: string;
    renderer?: string;
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
    defaultValue: _defaultValue, // extract to prevent leaking into Form.Item children (antd warns about defaultValue on controlled fields)
    ...restFormItemProps
}: ResolvedFormField) => {

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

    // Built-in field types — lookup from registry
    const BuiltInRenderer = fieldTypeRegistry.get(fieldType || 'text', 'form');

    const builtInProps: BuiltInFormFieldProps = {
        fieldType,
        name,
        placeholder,
        prefixIcon,
        initialValue,
        options,
        addNewOption,
        setFormValue,
        formatConfig,
        label,
        helpText,
        ...restFormItemProps,
    };

    return <>
        <Form.Item
            name={namePrefixPath?.length ? [ ...namePrefixPath, name ] : name}
            rules={validationRules}
            label={label}
            style={style}
            valuePropName={[ 'boolean', 'toggle', 'switch' ].includes(fieldType.toLocaleLowerCase()) ? "checked" : "value"}
        >
            {BuiltInRenderer
                ? <BuiltInRenderer {...builtInProps} />
                : <Input type="text" prefix={prefixIcon} placeholder={placeholder} />
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
}: ResolvedFormField) => {
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
                                        return <RenderFormField key={property.name || property.column} {...property} namePrefixPath={[ field.name ]}
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
}: ResolvedFormField) => {
    const parentFieldName = name;

    return <>
        {label && <LabelAndHelpText label={label} helpText={helpText} />}
        <Card size="small" style={{ backgroundColor: "#8080801c" }} >
            <div style={formStyles.mapCardContainer}>
                {properties?.map((property: IFormField, index: number) => (
                    <div key={property.name || index} style={formStyles.mapItemContainer}>
                        <RenderFormField
                            {...property}
                            label={resolveStringOrDefault(property.label, '')}
                            placeholder={resolveStringOrDefault(property.placeholder)}
                            helpText={resolveStringOrDefault(property.helpText)}
                            renderer={typeof property.renderer === 'string' ? property.renderer : undefined}
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
const RenderFormField = (formField: ResolvedFormField) => {
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

/**
 * Props injected by the parent form's condition evaluation.
 * These are computed at the Form level and passed down.
 */
export interface FormFieldConditionProps {
    /** Condition evaluation says this field should be hidden */
    conditionHidden?: boolean;
    /** Condition evaluation says this field should be disabled */
    conditionDisabled?: boolean;
    /** Message to show when disabled by condition */
    conditionDisabledMessage?: string;
    /** Resolved renderer name from ConditionalValue (overrides field.renderer) */
    resolvedRenderer?: string;
    /** Resolved label from ConditionalValue (overrides field.label) */
    resolvedLabel?: string;
    /** Resolved placeholder from ConditionalValue (overrides field.placeholder) */
    resolvedPlaceholder?: string;
    /** Resolved helpText from ConditionalValue (overrides field.helpText) */
    resolvedHelpText?: string;
}

export function FormField(formField: IFormField & FormFieldConditionProps) {
    const {
        conditionHidden,
        conditionDisabled,
        conditionDisabledMessage,
        resolvedRenderer,
        resolvedLabel,
        resolvedPlaceholder,
        resolvedHelpText,
        ...fieldProps
    } = formField;

    // Static hidden (from config) — return null (legacy behavior)
    // Only use static hidden if there's no visibility condition defined
    if (fieldProps.hidden && (fieldProps.visibility === undefined || fieldProps.visibility === null)) {
        return null;
    }

    // Condition-based hidden: use Form.Item hidden + preserve to keep value in form state
    // This prevents data loss when a field is conditionally hidden
    if (conditionHidden) {
        return (
            <Form.Item
                name={fieldProps.name || fieldProps.column}
                hidden={true}
                preserve={true}
                noStyle
            >
                <input type="hidden" />
            </Form.Item>
        );
    }

    // Apply condition-based disabled state and resolved conditional values.
    // Resolved values (from ConditionalValue<string>) override the raw config values.
    // resolveStringOrDefault handles the case where values are still ConditionalValue
    // (e.g., in nested/recursive fields) — falls back to the default value.
    const mergedProps: ResolvedFormField = {
        ...fieldProps,
        label: resolvedLabel ?? resolveStringOrDefault(fieldProps.label, ''),
        placeholder: resolvedPlaceholder ?? resolveStringOrDefault(fieldProps.placeholder),
        helpText: resolvedHelpText ?? resolveStringOrDefault(fieldProps.helpText),
        renderer: resolvedRenderer ?? (typeof fieldProps.renderer === 'string' ? fieldProps.renderer : undefined),
        ...(conditionDisabled && { disabled: true }),
    };

    // Wrap with Tooltip when disabled by condition and a message is provided
    if (conditionDisabled && conditionDisabledMessage) {
        return <div key={fieldProps.column || fieldProps.name || fieldProps.id}>
            <Tooltip title={conditionDisabledMessage}>
                <div><RenderFormField {...mergedProps} /></div>
            </Tooltip>
        </div>
    }

    return <div key={fieldProps.column || fieldProps.name || fieldProps.id}>
        <RenderFormField {...mergedProps} />
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
            validationRules: convertValidationRules(columnConfig.validations, resolveStringOrDefault(columnConfig.label)),
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