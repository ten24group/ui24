import React, { useEffect, useState, useRef } from 'react';
import { Select as AntSelect, Radio, Checkbox, Divider, Space, Button } from 'antd';
import { useApi } from '../../context';
import { PlusOutlined } from '@ant-design/icons';
import type { InputRef } from 'antd';
import { OpenInModal, IModalConfig } from '../../../modal/Modal';
import { useEntityConfig, type IEntityConfigReference } from '../../hooks';
import type { IFormField } from '../../types/field-config';
import { handleApiError } from '../../utils/api-error-handler';
import { useAppContext } from '../../context/AppContext';
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
export type IAttributesTemplate = {
    composite: Array<string>,
    template: string,
}

function interpolateTemplate(label: IAttributesTemplate, option: any) {
    const { composite, template } = label;
    let interpolatedLabel = template;
    composite.forEach((attribute) => {
        const regex = new RegExp(`{${attribute}}`, "g");
        interpolatedLabel = interpolatedLabel.replace(regex, option[ attribute ]);
    });
    return interpolatedLabel;
}

export type IFieldOptionsAPIConfig = {
    apiMethod: 'GET' | 'POST',
    apiUrl: string,
    responseKey: string,
    query?: any,
    optionMapping?: {
        label: string | IAttributesTemplate, // 
        value: string | IAttributesTemplate, // 
    },
}
export function isFieldOptionsAPIConfig(obj: any): obj is IFieldOptionsAPIConfig {
    return (
        obj &&
        obj.apiMethod &&
        (obj.apiMethod === 'GET' || obj.apiMethod === 'POST') &&
        typeof obj.apiUrl === 'string' &&
        typeof obj.responseKey === 'string'
    );
}

export interface IOptions {
    label: string;
    value: string | number;
}

export type IFieldOptions = Array<IOptions> | IFieldOptionsAPIConfig;

interface IOptionSelector {
    options: IFieldOptions
    onOptionChange?: Function,
    fieldType: IFormField['fieldType'],
    addNewOption?: IModalConfig, // DEPRECATED: Use addNewOptionConfig instead
    addNewOptionConfig?: IEntityConfigReference, // NEW: Entity config reference
    value?: string,
}

export const OptionSelector = ({ 
    options = [], 
    fieldType, 
    addNewOption, 
    addNewOptionConfig,
    onOptionChange, 
    value 
}: IOptionSelector) => {

    const { callApiMethod } = useApi()
    const { resolveConfigRef } = useEntityConfig()
    const { notifyError } = useAppContext()
    const [ open, setOpen ] = useState(false);
    const [ disabled, setDisabled ] = useState<boolean>(false)

    const [ fieldOptions, setFieldOptions ] = useState(Array.isArray(options) ? options : [])
    const fetchFieldOptions = async (config: IFieldOptionsAPIConfig): Promise<Array<IOptions>> => {
        setDisabled(true)
        try {
            // TODO: add support for query, pagination, fetching template-attributes etc
            const response = await callApiMethod({ ...config });

            if (response.status === 200) {
                let formattedOptions: Array<any>;
                const options = response.data[ config.responseKey ] as Array<any>;

                if (!config.optionMapping) {

                    formattedOptions = options;
                } else {

                    formattedOptions = options.map((option) => {
                        return {
                            label: typeof config.optionMapping.label === 'string'
                                ? option[ config.optionMapping.label ]
                                : interpolateTemplate(config.optionMapping.label, option),
                            value: typeof config.optionMapping.value === 'string'
                                ? option[ config.optionMapping.value ]
                                : interpolateTemplate(config.optionMapping.value, option),
                        }
                    });
                }

                // sort options by label
                return formattedOptions?.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()))
            } else if (response.status >= 400) {
                // Handle error response using consolidated error handler
                const errorResult = handleApiError(response, 'Failed to load options');
                notifyError(errorResult.errorMessage);
            }

            return [];
        } catch (error: any) {
            // Handle network errors or other exceptions
            const errorResult = handleApiError(error, 'Failed to load options');
            notifyError(errorResult.errorMessage);
            return [];
        } finally {
            setDisabled(false)
        }
    }

    const fetchOptions = async () => {
        if ([ 'select', 'multi-select', 'checkbox', 'radio' ].includes(fieldType.toLocaleLowerCase()) && typeof options === 'object' && isFieldOptionsAPIConfig(options)) {
            const apiOptions = await fetchFieldOptions(options as IFieldOptionsAPIConfig)
            if (apiOptions.length > 0) {
                setFieldOptions(apiOptions)
            }
        }
    }

    useEffect(() => {
        fetchOptions()
    }, [ options ])

    const enableAddNewOption = () => {
        // Resolve modal config from new or old format
        let modalConfig: IModalConfig | null = null;
        
        if (addNewOptionConfig) {
            // NEW: Resolve entity config reference
            const resolvedConfig = resolveConfigRef(addNewOptionConfig);
            
            if (!resolvedConfig) {
                console.warn(
                    `[OptionSelector] Failed to resolve config for addNewOption:`,
                    `${addNewOptionConfig.pageType}-${addNewOptionConfig.entityName}`
                );
                return undefined;
            }
            
            if (!resolvedConfig.formPageConfig) {
                console.warn(
                    `[OptionSelector] Resolved config missing formPageConfig:`,
                    `${addNewOptionConfig.pageType}-${addNewOptionConfig.entityName}`,
                    resolvedConfig
                );
                return undefined;
            }
            
            modalConfig = {
                modalType: 'form',
                modalPageConfig: resolvedConfig.formPageConfig
            };
        } else if (addNewOption) {
            // OLD: Use legacy IModalConfig directly (backward compatibility)
            modalConfig = addNewOption;
        }
        
        if (!modalConfig) {
            return undefined;
        }

        return (menu) => (
            <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <Space style={{ padding: '0 8px 4px' }}>
                    <OpenInModal
                        onOpenCallback={() => setOpen(false)}
                        onSuccessCallback={(response) => { fetchOptions() }}
                        {...modalConfig}
                        useDynamicIdFromParams={false}
                    >
                        <PlusOutlined /> Add Record
                    </OpenInModal>
                </Space>
            </>
        )
    }

    // Determine if add new option should be enabled
    const hasAddNewOption = !!(addNewOptionConfig || addNewOption);

    return <>
        {fieldType === "checkbox" && <Checkbox.Group value={[ value ]} options={fieldOptions} />}
        {fieldType === "radio" && <Radio.Group value={[ value ]} options={fieldOptions} />}
        {fieldType === "select" && <AntSelect value={value} disabled={disabled} onOpenChange={(visible) => setOpen(visible)} open={open} options={fieldOptions} popupRender={
            hasAddNewOption ? enableAddNewOption() : undefined
        } onChange={(value) => {
            onOptionChange(value)
        }} />}
        {fieldType === "multi-select" && <AntSelect value={value} disabled={disabled} onOpenChange={(visible) => setOpen(visible)} open={open} options={fieldOptions} popupRender={
            hasAddNewOption ? enableAddNewOption() : undefined
        } onChange={(value) => {
            onOptionChange(value)
        }} mode='multiple' />}
    </>
}