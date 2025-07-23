import React, { useState, useEffect } from 'react';
import { Descriptions, DescriptionsProps, List, Spin } from 'antd';
import { useApi, IApiConfig, useAppContext } from '../core/context';
import { useParams } from "react-router-dom"
import { useFormat } from '../core/hooks';
import { CustomBlockNoteEditor, CustomColorPicker } from '../core/common';
import { OpenInModal } from '../modal/Modal';
import { substituteUrlParams } from '../core/utils';
import './Details.css';

interface IPropertiesConfig {
    name?: string; // Property path (supports dot notation for nested objects)
    label: string;
    column: string;
    hidden?: boolean;
    initialValue: string;
    fieldType?: string;

    // for list and map fields
    type?: string;
    properties?: Array<IPropertiesConfig>
    items?: {
        type: string,
        properties?: Array<IPropertiesConfig>
    },

    openInModal?: any,
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
    identifiers?: any;
    propertiesConfig: Array<IPropertiesConfig>;
    columnsConfig?: IColumnsConfig;
    routeParams?: Record<string, string>;
}

// Helper function to get nested property value using dot notation
const getNestedValue = (obj: any, path: string): any => {
    if (!path || !obj) return undefined;
    
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
};

// Helper to split array into N columns (vertical stacks)
function splitIntoColumns<T>(arr: T[], numCols: number): T[][] {
    const cols: T[][] = Array.from({ length: numCols }, () => []);
    arr.forEach((item, idx) => {
        cols[ idx % numCols ].push(item);
    });
    return cols;
}

const Details: React.FC<IDetailsConfig> = ({ pageTitle, propertiesConfig, detailApiConfig, identifiers, columnsConfig, routeParams = {} }) => {
    const [ recordInfo, setRecordInfo ] = useState<IPropertiesConfig[]>(propertiesConfig)
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
                acc[ prop.column ] = valueFormatter(prop, itemData?.[ prop.column ]);
                return acc;
            }, {});

        } else if (item?.type === "list") {
            initialValue = itemData?.map(it => valueFormatter(item.items as any, it)) ?? [];
        } else if ([ 'date', 'datetime', 'time' ].includes(item?.fieldType?.toLocaleLowerCase())) {
            // formate the date value using uiConfig's date-time-formats
            if (typeof initialValue === 'string' && initialValue.startsWith('0')) {
                initialValue = formatDate(new Date(parseInt(initialValue)).toISOString(), item.fieldType?.toLocaleLowerCase() as any);
            } else {
                initialValue = formatDate(initialValue, item.fieldType?.toLocaleLowerCase() as any);
            }
        } else if ([ 'boolean', 'switch', 'toggle' ].includes(item?.fieldType?.toLocaleLowerCase())) {
            // format the boolean value using uiConfig's boolean-formats
            initialValue = formatBoolean(initialValue);
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

    const makeDescriptionCard = (options: { name: string, layout: DescriptionsProps[ 'layout' ], data: any[] }) => {
        const { name, data, layout } = options;
        return <>
            <Descriptions
                title={name}
                layout={layout}
                items={

                    data.filter(item => !item.hidden)
                        .map((item: IPropertiesConfig, index: number) => {

                            if ([ 'rich-text', 'wysiwyg' ].includes(item.fieldType.toLocaleLowerCase())) {
                                return {
                                    key: index,
                                    label: item.label,
                                    children: <CustomBlockNoteEditor value={item.initialValue as any} readOnly={true} />
                                }
                            }

                            if (item.fieldType.toLocaleLowerCase() === 'image') {
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
                                                <pre>
                                                    <code>
                                                        {JSON.stringify(item, null, 2)}
                                                    </code>
                                                </pre>

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
                            padding: 24,
                            borderRadius: 12,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                            border: '1px solid #f0f0f0',
                            overflowWrap: 'break-word',
                            wordBreak: 'break-word',
                        }}
                    >
                        {columnItems.filter(item => !item.hidden).map((item: IPropertiesConfig, index: number) => {
                            // Render each field as before
                            const value = item.initialValue;
                            if ([ 'rich-text', 'wysiwyg' ].includes(item.fieldType?.toLocaleLowerCase?.())) {
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        {value ? <div className="details-fixed-block"><CustomBlockNoteEditor value={value as any} readOnly={true} /></div> : <span>—</span>}
                                    </div>
                                );
                            }
                            if ([ 'textarea' ].includes(item.fieldType?.toLocaleLowerCase?.()) || item.label.toLocaleLowerCase() === 'content') {
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        <div className="details-fixed-block">
                                            {value ? (typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)) : <span>—</span>}
                                        </div>
                                    </div>
                                );
                            }
                            if (item.fieldType?.toLocaleLowerCase?.() === 'image') {
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        {value ? <img src={value} alt={item.label} className="details-image" /> : <span>—</span>}
                                    </div>
                                );
                            }
                            if (item.fieldType?.toLocaleLowerCase?.() === 'color') {
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        {value ? <CustomColorPicker value={value} disabled /> : <span>—</span>}
                                    </div>
                                );
                            }
                            if (item.type === 'list' && item.fieldType !== 'multi-select') {
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        {Array.isArray(value) && value.length > 0 ? (
                                            <ul style={{ paddingLeft: 20, margin: 0 }}>
                                                {value.map((listItem, listIdx) => (
                                                    <li key={listIdx} style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                                        {typeof listItem === 'object' ? JSON.stringify(listItem) : String(listItem)}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : <span>—</span>}
                                    </div>
                                );
                            }
                            if (item.type === 'map') {
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
                                            <dl style={{ margin: 0, padding: 0 }}>
                                                {Object.entries(objValue).map(([ k, v ]) => (
                                                    <React.Fragment key={k}>
                                                        <dt style={{ fontWeight: 500, color: '#555', float: 'left', clear: 'left', minWidth: 120 }}>{k}:</dt>
                                                        <dd style={{ marginLeft: 130, marginBottom: 8 }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                                                    </React.Fragment>
                                                ))}
                                            </dl>
                                        </div>
                                    );
                                } else {
                                    // Fallback: show as code block
                                    return (
                                        <div key={index} className="details-field-container">
                                            <div className="details-field-label">{item.label}</div>
                                            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                <code>{value ? value : '—'}</code>
                                            </pre>
                                        </div>
                                    );
                                }
                            }
                            if (item.openInModal) {
                                return (
                                    <div key={index} className="details-field-container">
                                        <div className="details-field-label">{item.label}</div>
                                        {value ? <OpenInModal {...item.openInModal} primaryIndex={value}>{value}</OpenInModal> : <span>—</span>}
                                    </div>
                                );
                            }
                            return (
                                <div key={index} className="details-field-container">
                                    <div className="details-field-label">{item.label}</div>
                                    <div>
                                        {value !== undefined && value !== null && value !== '' ? (
                                            typeof value === 'string' && value.match(/^https?:\/\//i) ? (
                                                <a href={value} target="_blank" rel="noopener noreferrer">{value}</a>
                                            ) : typeof value === 'object' ? (
                                                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                                                    <code>{JSON.stringify(value, null, 2)}</code>
                                                </pre>
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