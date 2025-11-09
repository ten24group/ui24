import React, { useState, useEffect, useMemo } from 'react';
import { Descriptions, DescriptionsProps, List, Spin, Skeleton, Typography, Space, Tooltip, Button } from 'antd';
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

import { IDetailFieldConfig, Template } from '../core/types/field-config';
import { RelationFieldRenderer } from '../table/renderers/RelationFieldRenderer';

// For backwards compatibility, alias the old name
type IPropertiesConfig = IDetailFieldConfig;

export interface IDetailApiConfig {
  detailApiConfig?: IApiConfig;
}

export interface IDetailsConfig extends IDetailApiConfig {
  pageTitle?: Template;
  entityName?: string;  // NEW: Entity name from backend config generation
  identifiers?: string | number | Array<string | number>;
  propertiesConfig: Array<IPropertiesConfig>;
  columnsConfig?: IColumnsConfig;
  routeParams?: Record<string, string>;
  detailResponse?: any;  // Pre-provided response data (bypasses API call)
}

export interface IDetailsComponentProps extends IDetailsConfig {
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
  }, [ detailResponse, entityName, onDataChange ]);

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
      for (const [ key, val ] of Object.entries(value)) {
        result[ key ] = deserializeJsonStrings(val);
      }
      return result;
    }
    return value;
  };

  const valueFormatter = (item: IPropertiesConfig, itemData: any) => {
    let initialValue = itemData;

    // First, try to deserialize any JSON strings
    initialValue = deserializeJsonStrings(initialValue);

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
  }, [ identifiers, dynamicID, detailApiConfig, routeParams, callApiMethod, recordInfo, notifyError ]);

  // Expose refresh function to parent wrapper via ref
  useEffect(() => {
    if (refreshRef) {
      refreshRef.current = fetchRecordInfo;
    }
  }, [ fetchRecordInfo, refreshRef ]);

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
    layout: DescriptionsProps[ 'layout' ];
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
      {!dataLoaded ? (
        // Show skeleton loader on initial load for instant page transition
        <div style={detailsStyles.container}>
          {columns.map((_, colIdx) => (
            <div key={colIdx} style={detailsStyles.column}>
              <Skeleton active paragraph={{ rows: 8 }} />
            </div>
          ))}
        </div>
      ) : (
        // Show spinner overlay only for refresh (keeps content visible)
        <Spin spinning={isRefreshing}>
          <div style={detailsStyles.container}>
            {columns.map((columnItems, colIdx) => (
              <div key={colIdx} style={detailsStyles.column}>
                {columnItems
                  .filter((item) => !item.hidden)
                  .map((item: IPropertiesConfig, index: number) => {
                    // Render each field as before
                    const value = item.initialValue;

                    // Relation field rendering using shared RelationFieldRenderer
                    if (item.relationConfig) {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          <RelationFieldRenderer
                            relationConfig={item.relationConfig}
                            value={value}
                            record={detailResponse || {}}
                            routeParams={routeParams}
                            label={item.label}
                          />
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
                                propertiesConfig: [ item ],
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

                    if ([ 'rich-text', 'wysiwyg' ].includes(item.fieldType)) {
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
                      [ 'textarea', 'code', 'markdown' ].includes(item.fieldType) ||
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
      )}
    </ErrorBoundary>
  );
};

export { Details };