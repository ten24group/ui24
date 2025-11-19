/**
 * @fileoverview Details Component for FW24 Framework
 * 
 * This is the main details component that provides comprehensive read-only detail views
 * for displaying record data. It supports multi-column layouts, rich field types (images,
 * JSON, rich text), relation rendering, and nested data structures.
 * 
 * ## Key Features
 * 
 * - **Multi-Column Layouts**: Flexible column layouts (1-3 columns) with automatic responsive behavior
 * - **Rich Field Types**: Support for text, images, JSON, rich text, code, colors, files, etc.
 * - **Relation Rendering**: Automatic rendering of relation fields with links and modals
 * - **Nested Data**: Support for nested objects (maps) and arrays (lists)
 * - **Data Formatting**: Automatic formatting of dates, booleans, numbers, etc.
 * - **API Integration**: Automatic data loading from API or accepts pre-loaded data
 * - **State Lifting**: Lifts detail state to parent for visibility conditions and context
 * - **Refresh Support**: Exposes refresh function for on-demand data reloading
 * 
 * ## Architecture
 * 
 * The Details component follows a layered architecture:
 * 1. **Details.tsx** (this file): Detail orchestration, data loading, field rendering
 * 2. **RelationFieldRenderer**: Specialized renderer for relation fields
 * 3. **Field Renderers**: Specialized renderers for each field type (image, JSON, rich text, etc.)
 * 4. **API Integration**: Uses `useApi` hook for data fetching
 * 
 * ## Data Flow
 * 
 * ### With API
 * 1. Fetch record data from `detailApiConfig`
 * 2. Format data for display (dates, booleans, JSON, etc.)
 * 3. Render fields in multi-column layout
 * 
 * ### With Pre-loaded Data
 * 1. Accept record data via `detailResponse` prop
 * 2. Format data for display
 * 3. Render fields in multi-column layout
 * 
 * ## Field Type Handling
 * 
 * The details component uses a unified smart rendering system:
 * 
 * **Complex Data (maps, lists, objects, fieldType: 'json')**
 * - All handled by JsonDescription's smart per-property depth-based rendering:
 *   - Shallow properties (depth ≤ 2): Formatted as table rows
 *   - Deep properties (depth > 2): Automatically switched to JsonViewer
 * - No manual configuration needed - automatically chooses best display per property
 * - Works for: API responses, nested objects, arrays, metadata, etc.
 * - Example: syncMetadata shows simple fields as rows, but deeply nested apiResponse as JSON
 * 
 * **Simple Field Types:**
 * - **Text**: Simple string display with URL auto-detection
 * - **Dates**: Formatted using configured date/time formats
 * - **Booleans**: Formatted as Yes/No or custom labels
 * - **Images**: Rendered as responsive images
 * - **Rich Text**: Rendered using BlockNote editor (read-only)
 * - **Code/Markdown**: Rendered as formatted code blocks
 * - **Relations**: Rendered with links and modal icons
 * - **Numbers/Range/Rating**: Formatted with appropriate units
 * 
 * ## Usage
 * 
 * @example
 * ```tsx
 * // With API fetching
 * <Details
 *   propertiesConfig={[
 *     { name: 'teamName', label: 'Name', column: 'teamName', fieldType: 'text' },
 *     { name: 'city', label: 'City', column: 'city', fieldType: 'text' },
 *     { name: 'logo', label: 'Logo', column: 'logo', fieldType: 'image' }
 *   ]}
 *   detailApiConfig={{
 *     apiMethod: 'GET',
 *     apiUrl: '/api/team/:teamId',
 *     responseKey: 'data'
 *   }}
 *   identifiers="123"
 *   columnsConfig={{
 *     numColumns: 2,
 *     columns: [
 *       { sortOrder: 0, fields: ['teamName', 'city'] },
 *       { sortOrder: 1, fields: ['logo'] }
 *     ]
 *   }}
 * />
 * 
 * // With pre-loaded data (expandable rows, modals, etc.)
 * <Details
 *   propertiesConfig={[...]}
 *   detailResponse={{ teamName: 'Lakers', city: 'Los Angeles', logo: '...' }}
 * />
 * ```
 * 
 * @see {@link RelationFieldRenderer} for relation field rendering
 * @see {@link useFormat} for date/boolean formatting
 */

import { Descriptions, DescriptionsProps, List, Skeleton, Spin } from 'antd';
import React, { useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from "react-router-dom";
import { CustomBlockNoteEditor, CustomColorPicker, ErrorFallback, JsonDescription, JsonField, Link } from '../core/common';
import { IApiConfig, useApi, useAppContext } from '../core/context';
import { HelpText } from '../core/forms/FormField/components';
import { determineColumnLayout, IColumnsConfig } from '../core/forms/shared/utils';
import { useEntityConfig, useFormat } from '../core/hooks';
import { getNestedValue, substituteUrlParams } from '../core/utils';
import { handleApiError } from '../core/utils/api-error-handler';
import { OpenInModal } from '../modal/Modal';
import './Details.css';
import { detailsStyles } from './styles';

import { IDetailFieldConfig, Template } from '../core/types/field-config';
import { ISectionsConfig } from '../pages/PostAuth/SectionsRenderer';
import { RelationFieldRenderer } from '../table/renderers/RelationFieldRenderer';

// For backwards compatibility, alias the old name
type IPropertiesConfig = IDetailFieldConfig;

/**
 * Detail API configuration interface.
 */
export interface IDetailApiConfig {
  detailApiConfig?: IApiConfig;
}

/**
 * Core details configuration interface.
 */
export interface IDetailsConfig extends IDetailApiConfig {
  pageTitle?: Template;
  entityName?: string;  // NEW: Entity name from backend config generation
  identifiers?: string | number | Array<string | number>;
  propertiesConfig: Array<IPropertiesConfig>;
  columnsConfig?: IColumnsConfig;
  routeParams?: Record<string, any>;
  detailResponse?: any;  // Pre-provided response data (bypasses API call)
  /**
   * Additional sections to display below or alongside the main detail view.
   * From backend: entitySchema.model.viewPageConfig.sectionsConfig
   * 
   * Enables multi-section detail pages with tabs or accordion UI.
   * Sections have access to the parent record via routeParams.
   */
  sectionsConfig?: ISectionsConfig;
}

/**
 * Details component props with state lifting and refresh support.
 */
export interface IDetailsComponentProps extends IDetailsConfig {
  propertiesConfig: Array<IPropertiesConfig>;
  detailApiConfig?: IApiConfig;
  identifiers?: string | number;
  columnsConfig?: IColumnsConfig;
  routeParams?: Record<string, any>;
  detailResponse?: any;  // Pre-provided response data (bypasses API call)
  onDataChange?: (data: { record?: any; pageType?: string; entityName?: string }) => void;
  refreshRef?: React.MutableRefObject<(() => Promise<void>) | null>;  // Ref to expose refresh function
}

/**
 * Main Details component for rendering read-only record details.
 * 
 * Provides a complete detail view solution with data loading, formatting,
 * multi-column layouts, and support for various field types including relations,
 * images, JSON, rich text, and more.
 * 
 * @param props - Details configuration props
 * @param props.propertiesConfig - Field configurations from backend
 * @param props.detailApiConfig - API configuration for loading data (optional if detailResponse provided)
 * @param props.identifiers - Record identifier for API fetching
 * @param props.columnsConfig - Multi-column layout configuration
 * @param props.routeParams - Route parameters for URL substitution
 * @param props.detailResponse - Pre-loaded record data (bypasses API call)
 * @param props.entityName - Entity name for context
 * @param props.onDataChange - Callback to lift detail state to parent
 * @param props.refreshRef - Ref to expose refresh function to parent
 * 
 * @returns Rendered details component
 */
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

    // Format recursively based on type
    // JsonDescription will handle depth detection and rendering automatically
    if (item?.type === "map" && Array.isArray(item.properties) && item.properties.length > 0) {
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

                    // Only show "—" for null/undefined, not for falsy values like 0, false, "", [], {}
                    if(value === null || value === undefined) {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          <span>—</span>
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
                          <Link url={linkUrl} className="details-link">
                            {displayText} ({value})
                          </Link>
                        </div>
                      );
                    }

                    if (item.openInModal) {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
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
                        </div>
                      );
                    }

                    // ============================================================================
                    // Smart Complex Data Rendering - All complex types handled by JsonField
                    // ============================================================================
                    // JsonField provides interactive JSON viewing with:
                    // - Toggle between Description (formatted table) and JSON (raw) views
                    // - Copy to clipboard button
                    // - Smart depth-based rendering in both modes
                    // 
                    // Works for: fieldType: 'json', type: 'map', type: 'list', and generic objects
                    // Example: syncMetadata with toggle to switch between views + copy button
                    
                    const isComplexData = 
                      item.type === 'list' ||
                      item.type === 'map' ||
                      (item.fieldType && typeof item.fieldType === 'string' && item.fieldType.toLowerCase() === 'json') ||
                      (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0);
                    
                    if (isComplexData && item.fieldType !== 'multi-select') {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          <JsonField data={value} title={item.label} maxDepth={2} />
                        </div>
                      );
                    }

                    if ([ 'rich-text', 'wysiwyg' ].includes(item.fieldType)) {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                            <div className="details-fixed-block">
                              <CustomBlockNoteEditor value={value as any} readOnly={true} />
                            </div>
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
                            <JsonDescription data={value} />
                          </div>
                        </div>
                      );
                    }
                    if (item.fieldType === 'image') {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          <img src={value} alt={item.label} className="details-image" />
                        </div>
                      );
                    }
                    if (item.fieldType === 'color') {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          <CustomColorPicker value={value} disabled />
                        </div>
                      );
                    }
                    if (item.fieldType === 'number') {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                          <div>
                            {Number(value)}
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
                            {`${value}%`}
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
                            {`${value}/5`}
                          </div>
                        </div>
                      );
                    }
                    if (item.fieldType === 'file') {
                      return (
                        <div key={index} className="details-field-container">
                          <div className="details-field-label">{item.label}</div>
                          <HelpText helpText={item.helpText} />
                            <a href={value} target="_blank" rel="noopener noreferrer">
                              Download File
                            </a>
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
