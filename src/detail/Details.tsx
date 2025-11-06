import React, { useState, useEffect, useMemo } from 'react';
import { Descriptions, DescriptionsProps, List, Spin, Typography, Space, Tooltip, Button } from 'antd';
import { EyeOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useApi, IApiConfig, useAppContext } from '../core/context';
import { useParams } from "react-router-dom"
import { useFormat, useEntityConfig } from '../core/hooks';
import { CustomBlockNoteEditor, CustomColorPicker, JsonDescription, Link, ErrorFallback } from '../core/common';
import { OpenInModal } from '../modal/Modal';
import { getNestedValue, substituteUrlParams } from '../core/utils';
import { handleApiError } from '../core/utils/api-error-handler';
import { determineColumnLayout, IColumnsConfig } from '../core/forms/shared/utils';
import { detailsStyles } from './styles';
import { HelpText } from '../core/forms/FormField/components';
import { ErrorBoundary } from 'react-error-boundary';
import { evaluateTemplateValue } from '../core/utils/template';
import './Details.css';

import { IDetailFieldConfig } from '../core/types/field-config';

// For backwards compatibility, alias the old name
type IPropertiesConfig = IDetailFieldConfig;

export interface IDetailApiConfig {
    detailApiConfig?: IApiConfig;
}

export interface IDetailsConfig extends IDetailApiConfig {
    pageTitle?: string;
    entityName?: string;  // NEW: Entity name from backend config generation
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
    onDataChange?: (data: { record?: any; pageType?: string; entityName?: string }) => void;
    refreshRef?: React.MutableRefObject<(() => Promise<void>) | null>;  // Ref to expose refresh function
}

const Details: React.FC<IDetailsComponentProps> = ({ 
    pageTitle, 
    propertiesConfig, 
    detailApiConfig, 
    identifiers, 
    columnsConfig, 
    routeParams = {},
    detailResponse: initialDetailResponse,
    entityName,  // From backend config
    onDataChange,  // Callback to lift state to wrapper
    refreshRef,  // Ref to expose refresh function to wrapper
}) => {
    const [ recordInfo, setRecordInfo ] = useState<IPropertiesConfig[]>(propertiesConfig)
    const [ detailResponse, setDetailResponse ] = useState<any>(initialDetailResponse || null)
    // TODO: remove the dynamic-id option from here and use the identifiers prop instead
    const { dynamicID } = useParams()
    const { notifyError } = useAppContext();
    const { callApiMethod } = useApi();
    const [ dataLoaded, setDataLoaded ] = useState(false);
    const [ isRefreshing, setIsRefreshing ] = useState(false);  // Separate loading state for refresh
    const { resolveConfigRef } = useEntityConfig();
    const { formatDate, formatBoolean } = useFormat()
    
    // Lift detail state to wrapper (if callback provided)
    useEffect(() => {
      if (!onDataChange || !detailResponse) return;
      
      onDataChange({
        record: detailResponse,
        pageType: 'view',
        entityName
      });
    }, [detailResponse, entityName, onDataChange]);

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
        } else if (typeof itemData === 'boolean') {
            // Auto-detect boolean values even if fieldType is missing
            // This makes the UI more resilient to missing fieldType configurations
            initialValue = formatBoolean(itemData);
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

    // Standard data fetch function (can be called on mount or on-demand)
    const fetchRecordInfo = React.useCallback(async (showLoader = true) => {
        if (showLoader) {
            setIsRefreshing(true);
        }
        
        const identifier = identifiers || dynamicID;
        let apiUrl = detailApiConfig?.apiUrl;
        
        if (!apiUrl) return;
        
        // Use the clean utility function for URL parameter substitution
        apiUrl = substituteUrlParams(apiUrl, routeParams, identifier);

        try {
            const response: any = await callApiMethod({ ...detailApiConfig, apiUrl });

            if (response.status === 200) {
                const fetchedDetailResponse = detailApiConfig.responseKey ? response.data[ detailApiConfig.responseKey ] : response.data;
                setDetailResponse(fetchedDetailResponse)

                const formatted = recordInfo.map(item => {
                    const propertyPath = item.column || item.name || item.id;
                    const nestedValue = getNestedValue(fetchedDetailResponse, propertyPath);
                    const formattedValue = valueFormatter(item, nestedValue);
                    return { ...item, initialValue: formattedValue }
                });

                setRecordInfo(formatted)
            } else if (response.status >= 400 && response.status < 600) {
                const errorResult = handleApiError(response, 'Failed to load details');
                notifyError(errorResult.formattedErrors.join('\n'));
            }

            setDataLoaded(true);
            setIsRefreshing(false);
            
        } catch (error: any) {
            const errorResult = handleApiError(error, 'Failed to load details');
            notifyError(errorResult.formattedErrors.join('\n'));
            setDataLoaded(true);
            setIsRefreshing(false);
        }
    }, [identifiers, dynamicID, detailApiConfig, routeParams, callApiMethod, recordInfo, notifyError]);
    
    // Expose refresh function to parent wrapper via ref
    useEffect(() => {
        if (refreshRef) {
            refreshRef.current = fetchRecordInfo;
        }
    }, [fetchRecordInfo, refreshRef]);
    
    // Initial load
    useEffect(() => {
        // If we have pre-provided detail response, format it immediately
        if (initialDetailResponse) {
            const formatted = recordInfo.map(item => {
                const propertyPath = item.column || item.name || item.id;
                const nestedValue = getNestedValue(initialDetailResponse, propertyPath);
                const formattedValue = valueFormatter(item, nestedValue);
                return { ...item, initialValue: formattedValue }
            });
            
            setRecordInfo(formatted);
            setDataLoaded(true);
        } else if (detailApiConfig) {
            // Otherwise, fetch from API
            fetchRecordInfo(false);  // Don't show refresh loader on initial load
        }
    }, [])  // Only on mount

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
        <Spin spinning={!dataLoaded || isRefreshing}>
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
                          let sourceValue = getNestedValue(detailResponse, mapping.source);
                          
                          // Fallback: if source field doesn't exist, try using 'id' or routeParams.id
                          // This handles cases where backend config uses entity name (e.g., "teamId") but entity has "id"
                          if (sourceValue == null) {
                            sourceValue = detailResponse.id || routeParams.id;
                          }
                          
                          // Map to target parameter for API call
                          // ONLY set the target field - that's what the filter expects
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
                      const shouldShowActions = displayConfig?.actions !== false;
                      const actionConfig = typeof displayConfig?.actions === 'object' ? displayConfig.actions : undefined;
                      
                      // Determine modal type from page type
                      const modalType = modalConfigRef?.pageType === 'list' ? 'list' : 'details';
                      
                      // Check if relation ID exists (null/undefined check)
                      const hasValue = value != null && value !== '' && 
                        !(typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
                      
                      // Smart display value with template support
                      let displayValue: string;
                      
                      // 1. Check if fully hydrated data is available (object) and template is configured
                      if (displayConfig?.template && hasValue && typeof value === 'object' && !Array.isArray(value)) {
                        try {
                          displayValue = evaluateTemplateValue(displayConfig.template, value);
                        } catch (e) {
                          console.warn(`[Details] Template evaluation failed for relation ${item.label}:`, e);
                          displayValue = String(value);
                        }
                      }
                      // 2. Fallback for partially resolved data (only ID present)
                      else if (displayConfig?.fallback?.template && hasValue && (typeof value === 'string' || typeof value === 'number')) {
                        // Use backend-provided fallback template - evaluate it with full context (modalRouteParams)
                        // Backend generates templates like "Seasons: {seasonId}" not "{id}", so we need full context
                        try {
                          displayValue = evaluateTemplateValue(displayConfig.fallback.template, modalRouteParams);
                        } catch (e) {
                          console.warn(`[Details] Fallback template evaluation failed for relation ${item.label}:`, e);
                          displayValue = String(value);
                        }
                      }
                      // 3. Default fallbacks for different relation types
                      else if (modalType === 'list') {
                        displayValue = (Array.isArray(value) && value.length > 0) ? `${value.length} items` : `View related items`;
                      }
                      // 4. Handle missing/null values
                      else if (!hasValue) {
                        displayValue = '—'; // Em dash for "not assigned"
                      }
                      // 5. Last resort: use value as-is
                      else {
                        displayValue = (Array.isArray(value) && value.length > 0) ? `${value.length} items` : String(value);
                      }
                      
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          {/* For to-many relations (lists), always show icon even if no value
                              For to-one relations, only show if there's a value */}
                          {(modalType === 'list' || hasValue) ? (
                            <Space>
                              {/* Show value as link or plain text (only if value exists) */}
                              {hasValue && shouldShowLink && shouldShowActions && (!actionConfig || actionConfig.link !== false) && (
                                <Link url={resolvedUrl} className="details-link">
                                  {displayValue}
                                </Link>
                              )}
                              {hasValue && (!shouldShowLink || !shouldShowActions || (actionConfig && actionConfig.link === false)) && (
                                <span>{displayValue}</span>
                              )}
                              
                              {/* Show modal icon if enabled - use resolved config directly (only if value exists for to-one) */}
                              {(modalType === 'list' || hasValue) && shouldShowActions && (!actionConfig || actionConfig.modal !== false) && displayConfig?.showModalIcon !== false && resolvedModalConfig && (
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
                              
                              {/* Custom actions if provided */}
                              {hasValue && shouldShowActions && actionConfig?.custom && actionConfig.custom.map((customAction, idx) => {
                                const customActionLabel = customAction.template 
                                  ? evaluateTemplateValue(customAction.template, value && typeof value === 'object' ? value : { id: value })
                                  : customAction.label;
                                
                                return (
                                  <Tooltip key={idx} title={customActionLabel}>
                                    <Button 
                                      type="text" 
                                      size="small" 
                                      onClick={() => {
                                        // Execute custom onClick handler (string as function reference)
                                        if (customAction.onClick && typeof window !== 'undefined') {
                                          try {
                                            const fn = eval(`(${customAction.onClick})`);
                                            if (typeof fn === 'function') {
                                              fn(value, detailResponse, routeParams);
                                            }
                                          } catch (e) {
                                            console.error(`[Details] Failed to execute custom action for ${item.label}:`, e);
                                          }
                                        }
                                      }}
                                      style={{ padding: '0 4px' }}
                                    >
                                      {customAction.icon && <span className={customAction.icon} />}
                                      {customActionLabel}
                                    </Button>
                                  </Tooltip>
                                );
                              })}
                            </Space>
                          ) : (
                            <span>{displayValue}</span>
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