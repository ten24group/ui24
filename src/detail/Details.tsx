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
import React, { useEffect, useMemo, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from "react-router-dom";
import { CustomBlockNoteEditor, ErrorFallback, JsonDescription, JsonField, Link, EmptyState } from '../core/common';
import { IApiConfig, useApi, useAppContext } from '../core/context';
import { resolveHelpConfig, HelpText, HelpIcon } from '../core/forms/FormField/components';
import { determineColumnLayout, IColumnsConfig } from '../core/forms/shared/utils';
import { useEntityConfig, useFormat } from '../core/hooks';
import { useEvaluatedItems } from '../core/hooks/useEvaluatedItems';
import { getNestedValue, substituteUrlParams } from '../core/utils';
import { handleApiError } from '../core/utils/api-error-handler';
import { OpenInModal } from '../modal/Modal';
import './Details.css';
import { detailsStyles } from './styles';

import { IDetailFieldConfig, Template } from '../core/types/field-config';
import { resolveStringOrDefault } from '../core/types/evaluation';
import { FreshnessIndicator } from '../core/common/FreshnessIndicator';
import { ISectionsConfig } from '../pages/PostAuth/SectionsRenderer';
import { RelationFieldRenderer } from '../table/renderers/RelationFieldRenderer';
import { useCoreNavigator } from '../routes/Navigation';
import { evaluateTemplate } from '../core/utils/template';
import { getFieldRenderer, buildDetailFieldProps, type DetailFieldConfig } from '../core/registry';
import { queryClient } from '../core/query/QueryProvider';
import { queryKeys } from '../core/query/queryKeys';
import { fieldTypeRegistry } from '../core/registry/FieldTypeRegistry';
import '../core/registry/field-types'; // ensure built-in registrations run

// For backwards compatibility, alias the old name
type IPropertiesConfig = IDetailFieldConfig;

/**
 * Reusable wrapper for each field in the detail view.
 * Renders the label (with optional help icon), help text, and children content.
 * Eliminates the repeated container/label/help pattern across all field branches.
 */
const DetailsFieldWrapper: React.FC<{
  item: IPropertiesConfig;
  index: number;
  children: React.ReactNode;
}> = ({ item, index, children }) => {
  const help = resolveHelpConfig({
    helpText: resolveStringOrDefault(item.helpText),
    help: item.help,
  });

  return (
    <div key={index} className="details-field-container">
      <div className="details-field-label">
        {resolveStringOrDefault(item.label)}
        <HelpIcon help={help} />
      </div>
      <HelpText help={help} />
      {children}
    </div>
  );
};

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
  const [ dataUpdatedAt, setDataUpdatedAt ] = useState<string | null>(null);
  const [ recordNotFound, setRecordNotFound ] = useState(false);
  const { resolveConfigRef } = useEntityConfig();
  const { formatDate, formatBoolean } = useFormat();
  const coreNavigate = useCoreNavigator();
  // NOTE: registry resolution is handled via getFieldRenderer() (non-hook, safe for loops)

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
      // Skip formatting if value is null/undefined/empty
      if (initialValue == null || initialValue === '') {
        initialValue = null;  // Will render as "—" by default
      } else {
        // formate the date value using uiConfig's date-time-formats
        if (typeof initialValue === 'string' && initialValue.startsWith('0')) {
          initialValue = new Date(parseInt(initialValue)).toISOString();
        }

        initialValue = formatDate(
          initialValue,
          item.fieldType as 'date' | 'datetime' | 'time',
          item.timezone
        );
      }
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

  // Derive entity name from apiUrl for React Query cache keying
  const detailEntityName = React.useMemo(() => {
    const url = detailApiConfig?.apiUrl || entityName || '';
    if (entityName) return entityName;
    const parts = url.split('/').filter(Boolean);
    const lastPart = parts[ parts.length - 1 ] || 'unknown';
    return lastPart.startsWith(':') ? (parts[ parts.length - 2 ] || 'unknown') : lastPart;
  }, [ detailApiConfig?.apiUrl, entityName ]);

  // Store callApiMethod in a ref for use in queryFn
  const callApiMethodRef = React.useRef(callApiMethod);
  callApiMethodRef.current = callApiMethod;

  // Standard data fetch function (can be called on mount or on-demand)
  const fetchRecordInfo = React.useCallback(async (showLoader = true) => {
    if (showLoader) {
      setIsRefreshing(true);
    }

    const identifier = identifiers || dynamicID;
    let apiUrl = detailApiConfig?.apiUrl;

    if (!apiUrl) return;

    apiUrl = substituteUrlParams(apiUrl, routeParams, identifier);

    try {
      // Use queryClient.fetchQuery for caching + dedup while keeping the imperative interface
      const cacheIdentifiers: Record<string, string> = {};
      if (identifier) cacheIdentifiers.id = String(identifier);
      if (routeParams) Object.assign(cacheIdentifiers, routeParams);

      const responseData = await queryClient.fetchQuery({
        queryKey: queryKeys.entity(detailEntityName).detail(cacheIdentifiers),
        queryFn: async () => {
          const response: any = await callApiMethodRef.current({ ...detailApiConfig, apiUrl });

          if (response.status >= 200 && response.status < 300) {
            return response.data;
          }

          throw response;
        },
        staleTime: 30 * 1000, // 30s for detail data
      });

      const fetchedDetailResponse = detailApiConfig.responseKey ? responseData[ detailApiConfig.responseKey ] : responseData;

      // Detect empty/missing record
      if (!fetchedDetailResponse || (typeof fetchedDetailResponse === 'object' && Object.keys(fetchedDetailResponse).length === 0)) {
        setRecordNotFound(true);
        setDataLoaded(true);
        setIsRefreshing(false);
        return;
      }

      setRecordNotFound(false);
      setDetailResponse(fetchedDetailResponse)

      const formatted = recordInfo.map(item => {
        const propertyPath = item.column || item.name || item.id;
        const nestedValue = getNestedValue(fetchedDetailResponse, propertyPath);
        const formattedValue = valueFormatter(item, nestedValue);
        return { ...item, initialValue: formattedValue }
      });

      setRecordInfo(formatted)

      setDataLoaded(true);
      setIsRefreshing(false);
      setDataUpdatedAt(new Date().toISOString());

    } catch (error: any) {
      // Detect 404 — record genuinely doesn't exist
      if (error?.status === 404 || error?.response?.status === 404) {
        setRecordNotFound(true);
        setDataLoaded(true);
        setIsRefreshing(false);
        return;
      }

      const errorResult = handleApiError(error, 'Failed to load details');
      notifyError(errorResult.formattedErrors.join('\n'));
      setDataLoaded(true);
      setIsRefreshing(false);
    }
  }, [ identifiers, dynamicID, detailApiConfig, routeParams, recordInfo, notifyError, detailEntityName ]);

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
      setDataUpdatedAt(new Date().toISOString());
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
                  label: resolveStringOrDefault(item.label),
                  children: <CustomBlockNoteEditor value={item.initialValue as any} readOnly={true} />
                }
              }

              if (item.fieldType === 'image') {
                return {
                  key: index,
                  label: resolveStringOrDefault(item.label),
                  children: <img src={item.initialValue} alt={resolveStringOrDefault(item.label)} style={{ width: '100px', height: '100px' }} />
                }
              }

              if (item.type === 'list' && item.fieldType !== 'multi-select') {

                return {
                  key: index,
                  label: resolveStringOrDefault(item.label),
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

                        {makeDescriptionCard({ name: resolveStringOrDefault(item.label, 'Item') + " - " + index, layout: 'vertical', data: item })}
                      </List.Item>
                    )}
                  />
                }
              }

              return {
                key: index,
                label: resolveStringOrDefault(item.label),
                children: item.initialValue
              }

            })} />

    </>
  }

  // ── Condition evaluation for detail fields ──
  const { visibilityResults: detailVisibilities } = useEvaluatedItems(recordInfo);

  // Determine columns to render — filter by condition + static hidden
  const items = recordInfo.filter((item, idx) => {
    // If there's a visibility condition, use its result
    if (item.visibility !== undefined) return detailVisibilities[ idx ];
    // Otherwise, use legacy static hidden check
    return !item.hidden;
  });
  const columns = determineColumnLayout(items, columnsConfig, columnsConfig?.numColumns || 3); // Details can have up to 3 columns

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Re-fetch data on error boundary reset
        fetchRecordInfo(false);
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
      ) : recordNotFound ? (
        // Record not found — show contextual empty state
        <EmptyState
          variant="noData"
          entityName={detailEntityName}
          config={{
            noData: {
              title: `${detailEntityName || 'Record'} not found`,
              description: 'The record you are looking for may have been deleted or does not exist.',
              action: { label: 'Go Back', url: '..' }
            }
          }}
          onNavigate={coreNavigate}
        />
      ) : (
        // Show spinner overlay only for refresh (keeps content visible)
        <Spin spinning={isRefreshing}>
          {dataUpdatedAt && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <FreshnessIndicator timestamp={dataUpdatedAt} onRefresh={() => fetchRecordInfo(true)} />
            </div>
          )}
          <div style={detailsStyles.container}>
            {columns.map((columnItems, colIdx) => (
              <div key={colIdx} style={detailsStyles.column}>
                {columnItems
                  .filter((item) => !item.hidden)
                  .map((item: IPropertiesConfig, index: number) => {
                    const value = item.initialValue;

                    // Relation field rendering
                    if (item.relationConfig) {
                      return (
                        <DetailsFieldWrapper key={index} item={item} index={index}>
                          <RelationFieldRenderer
                            relationConfig={item.relationConfig}
                            value={value}
                            record={detailResponse || {}}
                            routeParams={routeParams}
                            label={resolveStringOrDefault(item.label)}
                          />
                        </DetailsFieldWrapper>
                      );
                    }

                    // Custom renderer from ExtensionRegistry
                    const CustomDetailRenderer = getFieldRenderer(
                      '' + (item.fieldType || ''),
                      'detail',
                      {
                        fieldName: item.name || item.column || '',
                        entityName,
                        explicitRenderer: typeof item.renderer === 'string' ? item.renderer : undefined,
                        routeParams
                      }
                    );

                    if (CustomDetailRenderer) {
                      const customDetailProps = buildDetailFieldProps(
                        '' + (item.fieldType || ''),
                        {
                          fieldName: item.name || item.column || '',
                          value,
                          label: resolveStringOrDefault(item.label),
                          config: item as DetailFieldConfig,
                          routeParams
                        }
                      );
                      const Renderer = CustomDetailRenderer as React.ComponentType<typeof customDetailProps>;
                      return (
                        <DetailsFieldWrapper key={index} item={item} index={index}>
                          <Renderer {...customDetailProps} />
                        </DetailsFieldWrapper>
                      );
                    }

                    // Null/undefined → em dash
                    if (value === null || value === undefined) {
                      return (
                        <DetailsFieldWrapper key={index} item={item} index={index}>
                          <span>—</span>
                        </DetailsFieldWrapper>
                      );
                    }

                    // Link fields
                    if (item.linkConfig) {
                      const linkUrl = substituteUrlParams(
                        item.linkConfig.routePattern,
                        { ...routeParams, ...detailResponse },
                        value
                      );

                      const templateContext = { ...routeParams, ...detailResponse };
                      const displayText = item.linkConfig.displayText
                        ? (typeof item.linkConfig.displayText === 'string'
                          ? evaluateTemplate(item.linkConfig.displayText, templateContext)
                          : evaluateTemplate(item.linkConfig.displayText, templateContext))
                        : value;

                      return (
                        <DetailsFieldWrapper key={index} item={item} index={index}>
                          <Link url={linkUrl} className="details-link" target={item.target || '_blank'}>
                            {displayText} ({value})
                          </Link>
                        </DetailsFieldWrapper>
                      );
                    }

                    // Modal fields
                    if (item.openInModal) {
                      return (
                        <DetailsFieldWrapper key={index} item={item} index={index}>
                          <OpenInModal
                            modalType="details"
                            primaryIndex={value}
                            modalPageConfig={{
                              pageTitle: resolveStringOrDefault(item.label),
                              propertiesConfig: [ { ...item, label: resolveStringOrDefault(item.label) } ],
                            }}
                          >
                            {value}
                          </OpenInModal>
                        </DetailsFieldWrapper>
                      );
                    }

                    // Complex data (json, map, list, objects)
                    const isComplexData =
                      !['rich-text', 'wysiwyg', 'multi-select', 'timeline'].includes(item.fieldType) && (
                        item.type === 'list' ||
                        item.type === 'map' ||
                        (item.fieldType && typeof item.fieldType === 'string' && item.fieldType.toLowerCase() === 'json') ||
                        (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0)
                      );

                    if (isComplexData) {
                      return (
                        <DetailsFieldWrapper key={index} item={item} index={index}>
                          <JsonField data={value} title={resolveStringOrDefault(item.label)} maxDepth={2} />
                        </DetailsFieldWrapper>
                      );
                    }

                    // Registry-based detail renderer
                    const DetailRenderer = fieldTypeRegistry.get(item.fieldType || '', 'detail');
                    if (DetailRenderer) {
                      const detailDefaults = fieldTypeRegistry.getDefaults(item.fieldType || '', 'detail');
                      const mergedConfig = detailDefaults ? { ...detailDefaults, ...item } : item;
                      return (
                        <DetailsFieldWrapper key={index} item={item} index={index}>
                          <DetailRenderer
                            value={value}
                            label={resolveStringOrDefault(item.label)}
                            config={mergedConfig}
                            routeParams={routeParams}
                            record={detailResponse || {}}
                          />
                        </DetailsFieldWrapper>
                      );
                    }

                    // Default fallback — smart text rendering
                    return (
                      <DetailsFieldWrapper key={index} item={item} index={index}>
                        <div>
                          {value !== undefined && value !== null && value !== '' ? (
                            typeof value === 'string' && value.match(/^https?:\/\//i) ? (
                              <a href={value} target={item.target || '_blank'} rel={(item.target || '_blank') === '_blank' ? 'noopener noreferrer' : undefined}>
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
                      </DetailsFieldWrapper>
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
