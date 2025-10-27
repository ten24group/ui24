import React, { useState, useEffect } from 'react';
import { Descriptions, DescriptionsProps, List, Spin, Typography, Space, Tooltip, Button } from 'antd';
import { EyeOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useApi, IApiConfig, useAppContext } from '../core/context';
import { useParams } from "react-router-dom"
import { useFormat, useEntityConfig } from '../core/hooks';
import { CustomBlockNoteEditor, CustomColorPicker, JsonDescription, Link, ErrorFallback } from '../core/common';
import { OpenInModal } from '../modal/Modal';
import { getNestedValue, substituteUrlParams } from '../core/utils';
import { determineColumnLayout, IColumnsConfig } from '../core/forms/shared/utils';
import { detailsStyles } from './styles';
import { HelpText } from '../core/forms/FormField/components';
import { ErrorBoundary } from 'react-error-boundary';
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
    timezone?: string;

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
    
    // Raw relation data (from backend schema)
    relation?: {
        entityName: string;
        type: string;
        identifiers: any;
    };
    
    // NEW: Entity config reference for relation fields
    relationConfig?: {
        routePattern: string;
        identifierMapping?: 
            | { source: string; target: string; }
            | Array<{ source: string; target: string; }>;  // Support composite keys
        modalConfigRef?: {
            entityName: string;
            pageType: 'view' | 'create' | 'list';
            overrideConfig?: Record<string, any>;
        };
        modalWidth?: number | string;
        modalTitle?: string;
        displayConfig?: {
            showModalIcon?: boolean;
            icon?: string;
            showLink?: boolean;
        };
    };
    
    // NEW: Entity config reference for addNewOption (handled in OptionSelector)
    addNewOptionConfig?: {
        entityName: string;
        pageType: 'view' | 'create' | 'list';
        overrideConfig?: Record<string, any>;
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

export interface IDetailsComponentProps extends IDetailsConfig {
    pageTitle?: string;
    propertiesConfig: Array<IPropertiesConfig>;
    detailApiConfig?: IApiConfig;
    identifiers?: string | number;
    columnsConfig?: IColumnsConfig;
    routeParams?: Record<string, string>;
    detailResponse?: any;  // Pre-provided response data (bypasses API call)
}

const Details: React.FC<IDetailsComponentProps> = ({ 
    pageTitle, 
    propertiesConfig, 
    detailApiConfig, 
    identifiers, 
    columnsConfig, 
    routeParams = {},
    detailResponse: initialDetailResponse
}) => {
    const [ recordInfo, setRecordInfo ] = useState<IPropertiesConfig[]>(propertiesConfig)
    const [ detailResponse, setDetailResponse ] = useState<any>(initialDetailResponse || null)
    // TODO: remove the dynamic-id option from here and use the identifiers prop instead
    const { dynamicID } = useParams()
    const { notifyError } = useAppContext();
    const { callApiMethod } = useApi();
    const [ dataLoaded, setDataLoaded ] = useState(false);
    const { resolveConfigRef } = useEntityConfig();
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
                initialValue = new Date(parseInt(initialValue)).toISOString();
            }

            initialValue = formatDate(
                initialValue,
                item.fieldType as 'date' | 'datetime' | 'time',
                item.timezone
            );
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
        
        // If we have pre-provided detail response, format it immediately
        if (initialDetailResponse) {
            const formatted = recordInfo.map(item => {
                const propertyPath = item.column || item.name || item.id;
                const nestedValue = getNestedValue(initialDetailResponse, propertyPath);
                const formatted = valueFormatter(item, nestedValue);
                return { ...item, initialValue: formatted }
            });
            
            setRecordInfo(formatted);
            setDataLoaded(true);
        } else if (detailApiConfig) {
            // Otherwise, fetch from API
            fetchRecordInfo();
        }
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
    const columns = determineColumnLayout(items, columnsConfig, columnsConfig?.numColumns || 3); // Details can have up to 3 columns

    return (
      <ErrorBoundary
        FallbackComponent={({
          error,
          resetErrorBoundary,
        }) => (
          <ErrorFallback
            error={new Error(`Error loading details: ${error.message}`)}
            resetErrorBoundary={resetErrorBoundary}
          />
        )}
        onReset={() => {
          console.log("Details ErrorBoundary Reset");
          // Potentially re-fetch data here if appropriate
        }}
      >
        <Spin spinning={!dataLoaded}>
          <div style={detailsStyles.container}>
            {columns.map((columnItems, colIdx) => (
              <div key={colIdx} style={detailsStyles.column}>
                {columnItems
                  .filter((item) => !item.hidden)
                  .map((item: IPropertiesConfig, index: number) => {
                    // Render each field as before
                    const value = item.initialValue;

                    // NEW: Relation field rendering with icon + link
                    if (item.relationConfig) {
                      const { 
                        routePattern, 
                        identifierMapping, 
                        modalConfigRef, 
                        modalWidth,
                        modalTitle,
                        displayConfig 
                      } = item.relationConfig;
                      
                      // Skip rendering if data not loaded yet (avoid errors during initial render)
                      if (!detailResponse) {
                        return (
                          <div key={index} className="details-field-container">
                            <div className="details-field-label">{item.label}</div>
                            <HelpText helpText={item.helpText} />
                            <span>—</span>
                          </div>
                        );
                      }
                      
                      // Resolve modal config if provided
                      const resolvedModalConfig = modalConfigRef ? resolveConfigRef(modalConfigRef) : null;
                      
                      // Warn if modal config failed to resolve (for debugging)
                      if (modalConfigRef && !resolvedModalConfig) {
                        console.warn(
                          `[Details] Failed to resolve modal config for ${item.label}:`,
                          `${modalConfigRef.pageType}-${modalConfigRef.entityName}`
                        );
                      }
                      
                      // Extract modal title from config or use override
                      const effectiveModalTitle = modalTitle || 
                        (resolvedModalConfig && (
                          (modalConfigRef?.pageType === 'list' && resolvedModalConfig.listPageConfig?.pageTitle) ||
                          (modalConfigRef?.pageType === 'view' && resolvedModalConfig.detailsPageConfig?.pageTitle)
                        )) ||
                        item.label;
                      
                      // Build route params using full entity data for placeholder resolution
                      const modalRouteParams = {
                        ...routeParams,
                        ...detailResponse
                      };
                      
                      // Extract and map identifiers from source to target
                      // Supports nested paths (e.g., "order.userId") via getNestedValue
                      // Handles both single and multiple identifier mappings (composite keys)
                      if (identifierMapping) {
                        const mappings = Array.isArray(identifierMapping) 
                          ? identifierMapping 
                          : [identifierMapping];
                        
                        mappings.forEach(mapping => {
                          // Extract value from detailResponse using source path (supports nesting)
                          const sourceValue = getNestedValue(detailResponse, mapping.source);
                          
                          // Map to target parameter for API call
                          if (sourceValue != null) {
                            modalRouteParams[mapping.target] = sourceValue;
                          } else {
                            console.warn(
                              `[Details] No value found for identifier source path: "${mapping.source}"`,
                              `Field: ${item.label}`
                            );
                          }
                        });
                      }
                      
                      // Resolve the URL with mapped identifiers (for link)
                      const resolvedUrl = substituteUrlParams(routePattern, modalRouteParams, value);
                      
                      // Determine icon (default based on page type)
                      const iconName = displayConfig?.icon || 
                        (modalConfigRef?.pageType === 'list' ? 'UnorderedListOutlined' : 'EyeOutlined');
                      const IconComponent = iconName === 'UnorderedListOutlined' ? UnorderedListOutlined : EyeOutlined;
                      
                      // Determine if we should show as link (default: true for to-one, false for to-many)
                      const shouldShowLink = displayConfig?.showLink !== false;
                      
                      // For to-many relations, format value display (could be count or array length)
                      const displayValue = Array.isArray(value) ? `${value.length} items` : value;
                      
                      // Determine modal type from page type
                      const modalType = modalConfigRef?.pageType === 'list' ? 'list' : 'details';
                      
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          {/* For to-many relations (lists), always show icon even if no value
                              For to-one relations, only show if there's a value */}
                          {(modalType === 'list' || value) ? (
                            <Space>
                              {/* Show value as link or plain text (only if value exists) */}
                              {value && shouldShowLink && (
                                <Link url={resolvedUrl} className="details-link">
                                  {displayValue}
                                </Link>
                              )}
                              {value && !shouldShowLink && (
                                <span>{displayValue}</span>
                              )}
                              
                              {/* Show modal icon if enabled - use resolved config directly */}
                              {displayConfig?.showModalIcon !== false && resolvedModalConfig && (
                                <Tooltip title={`View ${item.label}`}>
                                  <OpenInModal 
                                    modalType={modalType}
                                    modalPageConfig={
                                      modalType === 'list' 
                                        ? resolvedModalConfig.listPageConfig 
                                        : resolvedModalConfig.detailsPageConfig
                                    }
                                    identifiers={value}
                                    routeParams={modalRouteParams}
                                    modalWidth={modalWidth}
                                    modalTitle={effectiveModalTitle}
                                  >
                                    <Button 
                                      type="text" 
                                      size="small" 
                                      icon={<IconComponent />}
                                      style={{ padding: '0 4px' }}
                                      />
                                  </OpenInModal>
                                </Tooltip>
                              )}
                            </Space>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      );
                    }
                    
                    if (item.isLink && item.linkConfig) {
                      const linkUrl = substituteUrlParams(
                        item.linkConfig.routePattern,
                        { ...routeParams, ...detailResponse },
                        value
                      );
                      const displayText = item.linkConfig.displayText || value;
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          {value ? (
                            <Link url={linkUrl} className="details-link">
                              {displayText} ({value})
                            </Link>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      );
                    }

                    if (item.openInModal) {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          {value ? (
                            <OpenInModal
                              modalType="details"
                              primaryIndex={value}
                              modalPageConfig={{
                                pageTitle: item.label,
                                propertiesConfig: [item],
                              }}
                            >
                              {value}
                            </OpenInModal>
                          ) : (
                            <span>—_-</span>
                          )}
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
                          ) : (
                            <span>—</span>
                          )}
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

                    if (['rich-text', 'wysiwyg'].includes(item.fieldType)) {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          {value ? (
                            <div className="details-fixed-block">
                              <CustomBlockNoteEditor value={value as any} readOnly={true} />
                            </div>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      );
                    }
                    if (
                      ['textarea', 'code', 'markdown'].includes(item.fieldType) ||
                      item.label === 'content'
                    ) {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          <div className="details-fixed-block">
                            {value ? (
                              typeof value === 'object' ? (
                                <JsonDescription data={value} />
                              ) : (String(value))
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                        </div>
                      );
                    }
                    if (item.fieldType === 'image') {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          {value ? (
                            <img src={value} alt={item.label} className="details-image" />
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      );
                    }
                    if (item.fieldType === 'color') {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          {value ? (
                            <CustomColorPicker value={value} disabled />
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      );
                    }
                    if (item.fieldType === 'number') {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          <div>
                            {value !== undefined && value !== null ? (
                              Number(value)
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                        </div>
                      );
                    }
                    if (item.fieldType === 'range') {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          <div>
                            {value !== undefined && value !== null ? (
                              `${value}%`
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                        </div>
                      );
                    }
                    if (item.fieldType === 'rating') {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          <div>
                            {value !== undefined && value !== null ? (
                              `${value}/5`
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                        </div>
                      );
                    }
                    if (item.fieldType === 'file') {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          {value ? (
                            <a href={value} target="_blank" rel="noopener noreferrer">
                              Download File
                            </a>
                          ) : (
                            <span>—</span>
                          )}
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
                              <a href={value} target="_blank" rel="noopener noreferrer">
                                {value}
                              </a>
                            ) : typeof value === 'object' ? (
                              <JsonDescription data={value} />
                            ) : typeof value === 'string' && value.length > 100 ? (
                              <div
                                style={{
                                  wordWrap: 'break-word',
                                  overflowWrap: 'break-word',
                                  whiteSpace: 'pre-wrap',
                                  maxWidth: '100%',
                                }}
                              >
                                {value}
                              </div>
                            ) : (
                              String(value)
                            )
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </Spin>
      </ErrorBoundary>
    );
  };

export { Details };