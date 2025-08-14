import React, { useState, useEffect } from 'react';
import { Descriptions, DescriptionsProps, List, Spin, Typography } from 'antd';
import { useApi, IApiConfig, useAppContext } from '../core/context';
import { useParams } from "react-router-dom"
import { useFormat } from '../core/hooks';
import { CustomBlockNoteEditor, CustomColorPicker, JsonDescription, Link } from '../core/common';
import { OpenInModal } from '../modal/Modal';
import { getNestedValue, substituteUrlParams } from '../core/utils';
import { determineColumnLayout, IColumnsConfig } from '../core/forms/shared/utils';
import { detailsStyles } from './styles';
import { HelpText } from '../core/forms/FormField/components';
import './Details.css';

import { FieldType, PropertyType } from '../core/types/field-types';

interface IPropertiesConfig {
    name?: string; // Property path (supports dot notation for nested objects)
    label: string;
    id?: string;
    column: string;
    hidden?: boolean;
    initialValue: string;
    fieldType?: FieldType;
    helpText?: string;

    // for list and map fields
    type?: PropertyType;
    properties?: Array<IPropertiesConfig>;
    items?: {
        type: PropertyType;
        properties?: Array<IPropertiesConfig>;
    };

    openInModal?: boolean;
    
    // for internal links
    isLink?: boolean;
    linkConfig?: {
        routePattern: string;
        displayText?: string;
    };
}

export interface IDetailApiConfig {
    detailApiConfig?: IApiConfig;
}

export interface IDetailsConfig extends IDetailApiConfig {
    pageTitle?: string;
    identifiers?: string | number | Array<string | number>;
    propertiesConfig: Array<IPropertiesConfig>;
    columnsConfig?: IColumnsConfig;
    routeParams?: Record<string, string>;
}

interface IDetailsComponentProps extends IDetailsConfig {
    pageTitle?: string;
    propertiesConfig: Array<IPropertiesConfig>;
    detailApiConfig?: IApiConfig;
    identifiers?: string | number;
    columnsConfig?: IColumnsConfig;
    routeParams?: Record<string, string>;
}

const Details: React.FC<IDetailsComponentProps> = ({ 
    pageTitle, 
    propertiesConfig, 
    detailApiConfig, 
    identifiers, 
    columnsConfig, 
    routeParams = {} 
}) => {
    const [ recordInfo, setRecordInfo ] = useState<IPropertiesConfig[]>(propertiesConfig)
    const [ detailResponse, setDetailResponse ] = useState<any>(null)
    // TODO: remove the dynamic-id option from here and use the identifiers prop instead
    const { dynamicID } = useParams()
    const { notifyError } = useAppContext();
    const { callApiMethod } = useApi();
    const [ dataLoaded, setDataLoaded ] = useState(false);
    const { formatDate, formatBoolean } = useFormat()

    // Utility function to recursively deserialize JSON strings
    const deserializeJsonStrings = (value: any): any => {
        if (typeof value === 'string') {
            // Check if the string looks like JSON
            const trimmed = value.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
                (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                try {
                    const parsed = JSON.parse(trimmed);
                    // Recursively deserialize nested strings
                    return deserializeJsonStrings(parsed);
                } catch {
                    // If parsing fails, return the original string
                    return value;
                }
            }
            return value;
        } else if (Array.isArray(value)) {
            return value.map(item => deserializeJsonStrings(item));
        } else if (value && typeof value === 'object') {
            const result: any = {};
            for (const [key, val] of Object.entries(value)) {
                result[key] = deserializeJsonStrings(val);
            }
            return result;
        }
        return value;
    };

    const valueFormatter = (item: IPropertiesConfig, itemData: any) => {
        let initialValue = itemData;

        // First, try to deserialize any JSON strings
        const originalValue = initialValue;
        initialValue = deserializeJsonStrings(initialValue);
        
        // Debug logging for JSON deserialization
        if (typeof originalValue === 'string' && typeof initialValue === 'object' && initialValue !== null) {
            console.log(`Deserialized JSON for field "${item.label}":`, {
                original: originalValue.substring(0, 100) + (originalValue.length > 100 ? '...' : ''),
                deserialized: initialValue
            });
        }

        if (item?.type === "map") {
            initialValue = item.properties.reduce((acc, prop: IPropertiesConfig) => {
                //! Fixme: this conflicts with antd's column prop for ui column size.. need better handling
                acc[ prop.column ] = valueFormatter(prop, itemData?.[ prop.column ]);
                return acc;
            }, {});

        } else if (item?.type === "list") {
            initialValue = itemData?.map(it => valueFormatter(item.items as any, it)) ?? [];
        } else if ([ 'date', 'datetime', 'time' ].includes(item?.fieldType)) {
            // formate the date value using uiConfig's date-time-formats
            if (typeof initialValue === 'string' && initialValue.startsWith('0')) {
                initialValue = formatDate(new Date(parseInt(initialValue)).toISOString(), item.fieldType as any);
            } else {
                initialValue = formatDate(initialValue, item.fieldType as any);
            }
        } else if ([ 'boolean', 'switch', 'toggle' ].includes(item?.fieldType)) {
            // format the boolean value using uiConfig's boolean-formats
            initialValue = formatBoolean(initialValue);
        } else if (item?.fieldType === 'number') {
            // format number values
            initialValue = typeof initialValue === 'number' ? initialValue : parseFloat(initialValue) || 0;
        } else if (item?.fieldType === 'color') {
            // format color values - keep as is for display
            initialValue = initialValue;
        } else if (item?.fieldType === 'range') {
            // format range values
            initialValue = typeof initialValue === 'number' ? initialValue : parseFloat(initialValue) || 0;
        } else if (item?.fieldType === 'rating') {
            // format rating values
            initialValue = typeof initialValue === 'number' ? initialValue : parseFloat(initialValue) || 0;
        } else if ([ 'code', 'markdown', 'json' ].includes(item?.fieldType)) {
            // format code/markdown/json values - keep as is for display
            initialValue = initialValue;
        } else if ([ 'rich-text', 'wysiwyg' ].includes(item?.fieldType)) {
            // format rich text values - keep as is for display
            initialValue = initialValue;
        } else if ([ 'file', 'image' ].includes(item?.fieldType)) {
            // format file/image values - keep as is for display
            initialValue = initialValue;
        } else if ([ 'hidden', 'custom' ].includes(item?.fieldType)) {
            // format hidden/custom values - keep as is for display
            initialValue = initialValue;
        }

        return initialValue;
    }

    useEffect(() => {
        const fetchRecordInfo = async () => {
            const identifier = identifiers || dynamicID;
            let apiUrl = detailApiConfig.apiUrl;
            
            // Use the clean utility function for URL parameter substitution
            apiUrl = substituteUrlParams(apiUrl, routeParams, identifier);

            try {
                const response: any = await callApiMethod({ ...detailApiConfig, apiUrl });

                if (response.status === 200) {
                    
                    const detailResponse = detailApiConfig.responseKey ? response.data[ detailApiConfig.responseKey ] : response.data;
                    setDetailResponse(detailResponse)

                    const formatted = recordInfo.map(item => {
                        // Use getNestedValue to handle dot notation in property names (e.g., "indexInfo.uid")
                        // Use item.name for the property path, fall back to item.column for backward compatibility
                        const propertyPath = item.column || item.name || item.id;
                        const nestedValue = getNestedValue(detailResponse, propertyPath);
                        const formatted = valueFormatter(item, nestedValue);
                        return { ...item, initialValue: formatted }
                    });

                    setRecordInfo(formatted)
                }

                setDataLoaded(true);
                
            } catch (error: any) {
                notifyError(error?.message || 'An unexpected error occurred');
            }
        }

        if (detailApiConfig)
            fetchRecordInfo();
    }, [])

    interface IDescriptionCardOptions {
        name: string;
        layout: DescriptionsProps['layout'];
        data: Array<{ label: string; value: string | number | boolean | null } | IPropertiesConfig>;
    }

    const makeDescriptionCard = (options: IDescriptionCardOptions) => {
        const { name, data, layout } = options;
        return <>
            <Descriptions
                title={name}
                layout={layout}
                items={

                    data.filter(item => !('hidden' in item) || !item.hidden)
                        .map((item: IPropertiesConfig, index: number) => {

                            if ([ 'rich-text', 'wysiwyg' ].includes(item.fieldType)) {
                                return {
                                    key: index,
                                    label: item.label,
                                    children: <CustomBlockNoteEditor value={item.initialValue as any} readOnly={true} />
                                }
                            }

                            if (item.fieldType === 'image') {
                                return {
                                    key: index,
                                    label: item.label,
                                    children: <img src={item.initialValue} alt={item.label} style={{ width: '100px', height: '100px' }} />
                                }
                            }

                            if (item.type === 'list' && item.fieldType !== 'multi-select') {

                                return {
                                    key: index,
                                    label: item.label,
                                    children: <List
                                        itemLayout="horizontal"
                                        dataSource={item.initialValue as unknown as any[]}
                                        renderItem={(item, index) => (
                                            <List.Item>
                                                {/* <pre>
                                                    <code>
                                                        {JSON.stringify(item, null, 2)}
                                                    </code>
                                                </pre> */}

                                                {makeDescriptionCard({ name: item.label + " - " + index, layout: 'vertical', data: item })}
                                            </List.Item>
                                        )}
                                    />
                                }
                            }

                            return {
                                key: index,
                                label: item.label,
                                children: item.initialValue
                            }

                        })} />

        </>
    }

    // Determine columns to render
    const items = recordInfo.filter(item => !item.hidden);
    const columns = determineColumnLayout(items, columnsConfig, 3); // Details can have up to 3 columns

    return <>
        <Spin spinning={!dataLoaded}>
            <div style={detailsStyles.container}>
                {columns.map((columnItems, colIdx) => (
                    <div
                        key={colIdx}
                        style={detailsStyles.column}
                    >
                        {columnItems.filter(item => !item.hidden).map((item: IPropertiesConfig, index: number) => {
                            // Render each field as before
                            const value = item.initialValue;

                            if (item.isLink && item.linkConfig) {
                                const linkUrl = substituteUrlParams(item.linkConfig.routePattern, { ...routeParams, ...detailResponse });
                                const displayText = item.linkConfig.displayText || value;
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        <HelpText helpText={item.helpText} />
                                        {value ? (
                                            <Link url={linkUrl} className="details-link">
                                                {displayText} ({value})
                                            </Link>
                                        ) : <span>—</span>}
                                    </div>
                                );
                            }

                            if (item.openInModal) {
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        <HelpText helpText={item.helpText} />
                                        {value ? <OpenInModal
                                            modalType="details"
                                            primaryIndex={value}
                                            modalPageConfig={{
                                                pageTitle: item.label,
                                                propertiesConfig: [ item ]
                                            }}
                                        >{value}</OpenInModal> : <span>—_-</span>}
                                    </div>
                                );
                            }


                            if (item.type === 'list' && item.fieldType !== 'multi-select') {
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        <HelpText helpText={item.helpText} />
                                        {Array.isArray(value) && value.length > 0 ? (
                                            <JsonDescription data={value} />
                                        ) : <span>—</span>}
                                    </div>
                                );
                            }
                            if (item.type === 'map' || item.fieldType === 'json') {
                                // Since we already deserialized JSON strings in valueFormatter, 
                                // we can directly check if it's an object
                                if (value && typeof value === 'object' && !Array.isArray(value)) {
                                    // Show as definition list
                                    return (
                                        <div key={index} className="details-field-container">
                                            <div className="details-field-label">{item.label}</div>
                                            <HelpText helpText={item.helpText} />
                                            <JsonDescription data={value} />
                                        </div>
                                    );
                                } else if (typeof value === 'string') {
                                    // Fallback: show as code block for non-JSON strings
                                    return (
                                        <div key={index} className="details-field-container">
                                            <div className="details-field-label">{item.label}</div>
                                            <HelpText helpText={item.helpText} />
                                            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                <code>{value ? value : '—'}</code>
                                            </pre>
                                        </div>
                                    );
                                } else {
                                    // Show as JsonDescription for any other type
                                    return (
                                        <div key={index} className="details-field-container">
                                            <div className="details-field-label">{item.label}</div>
                                            <HelpText helpText={item.helpText} />
                                            <JsonDescription data={value} />
                                        </div>
                                    );
                                }
                            }

                            if ([ 'rich-text', 'wysiwyg' ].includes(item.fieldType)) {
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        <HelpText helpText={item.helpText} />
                                        {value ? <div className="details-fixed-block"><CustomBlockNoteEditor value={value as any} readOnly={true} /></div> : <span>—</span>}
                                    </div>
                                );
                            }
                            if ([ 'textarea', 'code', 'markdown' ].includes(item.fieldType) || item.label === 'content') {
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        <HelpText helpText={item.helpText} />
                                        <div className="details-fixed-block">
                                            {value ? (typeof value === 'object' ? <JsonDescription data={value} /> : String(value)) : <span>—</span>}
                                        </div>
                                    </div>
                                );
                            }
                            if (item.fieldType === 'image') {
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        <HelpText helpText={item.helpText} />
                                        {value ? <img src={value} alt={item.label} className="details-image" /> : <span>—</span>}
                                    </div>
                                );
                            }
                            if (item.fieldType === 'color') {
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        <HelpText helpText={item.helpText} />
                                        {value ? <CustomColorPicker value={value} disabled /> : <span>—</span>}
                                    </div>
                                );
                            }
                            if (item.fieldType === 'number') {
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        <HelpText helpText={item.helpText} />
                                        <div>{value !== undefined && value !== null ? Number(value) : <span>—</span>}</div>
                                    </div>
                                );
                            }
                            if (item.fieldType === 'range') {
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        <HelpText helpText={item.helpText} />
                                        <div>{value !== undefined && value !== null ? `${value}%` : <span>—</span>}</div>
                                    </div>
                                );
                            }
                            if (item.fieldType === 'rating') {
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        <HelpText helpText={item.helpText} />
                                        <div>{value !== undefined && value !== null ? `${value}/5` : <span>—</span>}</div>
                                    </div>
                                );
                            }
                            if (item.fieldType === 'file') {
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        <HelpText helpText={item.helpText} />
                                        {value ? <a href={value} target="_blank" rel="noopener noreferrer">Download File</a> : <span>—</span>}
                                    </div>
                                );
                            }

                            return (
                                <div key={index} className="details-field-container">
                                    <div className="details-field-label">{item.label}</div>
                                    <HelpText helpText={item.helpText} />
                                    <div>
                                        {value !== undefined && value !== null && value !== '' ? (
                                            typeof value === 'string' && value.match(/^https?:\/\//i) ? (
                                                <a href={value} target="_blank" rel="noopener noreferrer">{value}</a>
                                            ) : typeof value === 'object' ? (
                                                <JsonDescription data={value} />
                                            ) : String(value)
                                        ) : <span>—</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </Spin>
    </>

}
export { Details }