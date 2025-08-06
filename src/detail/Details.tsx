import React, { useState, useEffect } from 'react';
import { Descriptions, DescriptionsProps, List, Spin, Typography } from 'antd';
import { useApi, IApiConfig, useAppContext } from '../core/context';
import { useParams } from "react-router-dom"
import { useFormat } from '../core/hooks';
import { CustomBlockNoteEditor, CustomColorPicker, JsonDescription, Link } from '../core/common';
import { OpenInModal } from '../modal/Modal';
import { getNestedValue, substituteUrlParams } from '../core/utils';
import './Details.css';

const { Text } = Typography;

// Reusable HelpText component
const HelpText: React.FC<{ helpText?: string }> = ({ helpText }) => {
  if (!helpText) return null;
  
  return (
    <Text type="secondary" style={{ fontSize: '12px', fontStyle: 'italic', marginBottom: '8px', display: 'block' }}>
      {helpText}
    </Text>
  );
};

import { FieldType, PropertyType } from '../core/types/field-types';

interface IPropertiesConfig {
    name?: string; // Property path (supports dot notation for nested objects)
    label: string;
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

// Add new types for columnsConfig
interface IColumnLayoutConfig {
    sortOrder: number;
    fields: string[]; // array of field keys (column names)
}
interface IColumnsConfig {
    numColumns?: number;
    columns: IColumnLayoutConfig[];
}

export interface IDetailsConfig extends IDetailApiConfig {
    pageTitle?: string;
    identifiers?: string | number | Array<string | number>;
    propertiesConfig: Array<IPropertiesConfig>;
    columnsConfig?: IColumnsConfig;
    routeParams?: Record<string, string>;
}

// Helper to split array into N columns (vertical stacks)
function splitIntoColumns<T>(arr: T[], numCols: number): T[][] {
    const cols: T[][] = Array.from({ length: numCols }, () => []);
    arr.forEach((item, idx) => {
        cols[ idx % numCols ].push(item);
    });
    return cols;
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

    const valueFormatter = (item: IPropertiesConfig, itemData: any) => {
        let initialValue = itemData;

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
                        const propertyPath = item.name || item.column;
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
    let columns: IPropertiesConfig[][] = [];
    if (columnsConfig && columnsConfig.columns && columnsConfig.columns.length > 0) {
        // Sort columns by sortOrder
        columns = columnsConfig.columns
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(col =>
                col.fields
                    .map(fieldKey => recordInfo.find(f => f.column === fieldKey))
                    .filter(item => item && !item.hidden) as IPropertiesConfig[]
            );
    } else {
        // Fallback: split recordInfo into columns, filtering out hidden fields
        columns = splitIntoColumns(recordInfo.filter(item => !item.hidden), 3);
    }

    return <>
        <Spin spinning={!dataLoaded}>
            <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
                {columns.map((columnItems, colIdx) => (
                    <div
                        key={colIdx}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                            background: '#fff',
                            overflowWrap: 'break-word',
                            wordBreak: 'break-word',
                        }}
                    >
                        {columnItems.filter(item => !item.hidden).map((item: IPropertiesConfig, index: number) => {
                            // Render each field as before
                            const value = item.initialValue;

                            if (item.isLink && item.linkConfig) {
                                let linkUrl = substituteUrlParams(item.linkConfig.routePattern, routeParams);
                                linkUrl = substituteUrlParams(linkUrl, detailResponse);
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
                                let objValue = value;
                                if (typeof value === 'string') {
                                    try {
                                        objValue = JSON.parse(value);
                                    } catch {
                                        objValue = null;
                                    }
                                }
                                if (objValue && typeof objValue === 'object') {
                                    // Show as definition list
                                    return (
                                        <div key={index} className="details-field-container">
                                            <div className="details-field-label">{item.label}</div>
                                            <HelpText helpText={item.helpText} />
                                            <JsonDescription data={objValue} />
                                        </div>
                                    );
                                } else {
                                    // Fallback: show as code block
                                    return (
                                        <div key={index} className="details-field-container">
                                            <div className="details-field-label">{item.label}</div>
                                            <HelpText helpText={item.helpText} />
                                            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                <code>{value ? value : '—'}</code>
                                            </pre>
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