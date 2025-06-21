import React, { useEffect, useState, useRef } from 'react';
import { Select as AntSelect, Radio, Checkbox, Divider, Space, Button } from 'antd';
import { useApi } from '../../context';
import { PlusOutlined } from '@ant-design/icons';
import { IFormFieldType } from './FormField';
import type { InputRef } from 'antd';
import { OpenInModal, IModalConfig } from '../../../modal/Modal';
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
    value: string
}

export type IFieldOptions = Array<IOptions> | IFieldOptionsAPIConfig;

interface IOptionSelector {
    options: IFieldOptions
    onOptionChange?: Function,
    fieldType: IFormFieldType,
    addNewOption?: IModalConfig,
    value?: string,
}

export const OptionSelector = ({ options = [], fieldType, addNewOption, onOptionChange, value }: IOptionSelector) => {

    const { callApiMethod } = useApi()
    const [ open, setOpen ] = useState(false);
    const [ disabled, setDisabled ] = useState<boolean>(false)

    const [ fieldOptions, setFieldOptions ] = useState(Array.isArray(options) ? options : [])
    const fetchFieldOptions = async (config: IFieldOptionsAPIConfig): Promise<Array<IOptions>> => {
        setDisabled(true)
        // TODO: add support for query, pagination, fetching template-attributes etc
        const response = await callApiMethod({ ...config });
        setDisabled(false)

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
        }

        // TODO: handle error

        return [];
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

        return (menu) => (
            <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <Space style={{ padding: '0 8px 4px' }}>
                    <OpenInModal
                        onOpenCallback={() => setOpen(false)}
                        onSuccessCallback={(response) => { fetchOptions() }}
                        {...addNewOption}
                        useDynamicIdFromParams={false}
                    >
                        <PlusOutlined /> Add Record
                    </OpenInModal>
                </Space>
            </>
        )
    }

    return <>
        {fieldType === "checkbox" && <Checkbox.Group value={[ value ]} options={fieldOptions} />}
        {fieldType === "radio" && <Radio.Group value={[ value ]} options={fieldOptions} />}
        {fieldType === "select" && <AntSelect value={value} disabled={disabled} onOpenChange={(visible) => setOpen(visible)} open={open} options={fieldOptions} popupRender={
            addNewOption ? enableAddNewOption() : undefined
        } onChange={(value) => {
            onOptionChange(value)
        }} />}
        {fieldType === "multi-select" && <AntSelect value={value} disabled={disabled} onOpenChange={(visible) => setOpen(visible)} open={open} options={fieldOptions} popupRender={
            addNewOption ? enableAddNewOption() : undefined
        } onChange={(value) => {
            onOptionChange(value)
        }} mode='multiple' />}
    </>
}