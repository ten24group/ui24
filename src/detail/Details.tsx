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

import { Spin, Typography } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { PageSkeleton } from '../core/common/PageSkeleton';
import { useParams } from "react-router-dom";
import { ErrorFallback, JsonDescription, JsonField, Link, EmptyState } from '../core/common';
import { IApiConfig, useAppContext } from '../core/context';
import { resolveHelpConfig, HelpText, HelpIcon } from '../core/forms/FormField/components';
import { determineColumnLayout, IColumnsConfig } from '../core/forms/shared/utils';
import { useEntityConfig, useFormat } from '../core/hooks';
import { useEvaluatedItems } from '../core/hooks/useEvaluatedItems';
import { getNestedValue, substituteUrlParams } from '../core/utils';
import { handleApiError, isHttpStatus } from '../core/utils/api-error-handler';
import { OpenInModal } from '../modal/Modal';
import './Details.css';
import { detailsStyles } from './styles';

import { IDetailFieldConfig, Template } from '../core/types/field-config';
import { resolveStringOrDefault } from '../core/types/evaluation';
import { ISectionsConfig } from '../pages/PostAuth/SectionsRenderer';
import { RelationFieldRenderer } from '../table/renderers/RelationFieldRenderer';
import { useCoreNavigator } from '../routes/Navigation';
import { evaluateTemplate } from '../core/utils/template';
import { getFieldRenderer, buildDetailFieldProps, type DetailFieldConfig } from '../core/registry';
import { useEntityDetail } from '../core/query/useEntityDetail';
import { fieldTypeRegistry } from '../core/registry/FieldTypeRegistry';
import { useRenderPipeline } from '../core/rendering';
import '../core/registry/field-types'; // ensure built-in registrations run

// Stable empty object to avoid re-creating {} on every render (used as default for routeParams)
const EMPTY_ROUTE_PARAMS: Record<string, string> = {};

// For backwards compatibility, alias the old name
type IPropertiesConfig = IDetailFieldConfig;

/**
 * Recursively deserialize JSON strings embedded in values.
 * Handles nested strings that may contain JSON (e.g., DynamoDB metadata
 * stored as serialized JSON strings within a map field).
 *
 * Pure function — no component dependencies, safe at module scope.
 */
const deserializeJsonStrings = (value: unknown): unknown => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return deserializeJsonStrings(parsed);
      } catch {
        return value;
      }
    }
    return value;
  } else if (Array.isArray(value)) {
    return value.map(item => deserializeJsonStrings(item));
  } else if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [ key, val ] of Object.entries(value)) {
      result[ key ] = deserializeJsonStrings(val);
    }
    return result;
  }
  return value;
};

/**
 * Reusable wrapper for each field in the detail view.
 * Renders the label (with optional help icon), help text, and children content.
 * Eliminates the repeated container/label/help pattern across all field branches.
 */
const DetailsFieldWrapper: React.FC<{
  item: IPropertiesConfig;
  index: number;
  children: React.ReactNode;
  resolvedLabel?: string;
  formattingStyles?: Record<string, string | number>;
  formattingClassName?: string;
}> = ({ item, index, children, resolvedLabel, formattingStyles, formattingClassName }) => {
  const help = resolveHelpConfig({
    helpText: resolveStringOrDefault(item.helpText),
    help: item.help,
  });

  // When copyable, wrap the value content with Typography.Text copyable
  // Pass explicit text to ensure the raw value is copied (not the rendered children markup)
  const content = item.copyable && item.initialValue != null
    ? (
      <Typography.Text
        copyable={{ text: String(item.initialValue), tooltips: ['Copy', 'Copied'] }}
        style={{ display: 'inline' }}
      >
        {children}
      </Typography.Text>
    )
    : children;

  const displayLabel = resolvedLabel ?? resolveStringOrDefault(item.label);
  const containerClassName = ['details-field-container', formattingClassName].filter(Boolean).join(' ');

  return (
    <div key={index} className={containerClassName} style={formattingStyles}>
      <div className="details-field-label">
        {displayLabel}
        <HelpIcon help={help} />
      </div>
      <HelpText help={help} />
      {content}
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
  onDataChange?: (data: { record?: any; pageType?: string; entityName?: string; dataUpdatedAt?: string }) => void;
  refreshRef?: React.MutableRefObject<(() => Promise<void>) | null>;  // Ref to expose refresh function
  /** Loading state configuration (#57) */
  loading?: { type: 'skeleton' | 'spinner'; rows?: number };
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
  routeParams = EMPTY_ROUTE_PARAMS,
  detailResponse: initialDetailResponse,
  entityName,  // From backend config
  onDataChange,  // Callback to lift state to wrapper
  refreshRef,  // Ref to expose refresh function to wrapper
  loading: loadingConfig,  // Loading state configuration (#57)
}) => {
  // TODO(#7): Remove dynamicID fallback once all routes pass `identifiers` prop explicitly.
  // Currently, some routes use :dynamicID as the URL param and rely on this fallback.
  // Requires backend config generation to consistently set `identifiers` on detail pages.
  const { dynamicID } = useParams()
  const { notifyError } = useAppContext();
  const [ dataUpdatedAt, setDataUpdatedAt ] = useState<string | null>(null);
  const { resolveConfigRef } = useEntityConfig();
  const { formatDate, formatBoolean } = useFormat();
  const coreNavigate = useCoreNavigator();

  // Rendering pipeline (#95) — provides processField() for unified label resolution, formatting metadata
  const { processField } = useRenderPipeline({ renderContext: 'detail', routeParams: routeParams || {} });
  // NOTE: registry resolution is handled via getFieldRenderer() (non-hook, safe for loops)

  const valueFormatter = useCallback((item: IPropertiesConfig, itemData: any) => {
    let initialValue = itemData;

    // First, try to deserialize any JSON strings
    initialValue = deserializeJsonStrings(initialValue);

    // Format recursively based on type
    // JsonDescription will handle depth detection and rendering automatically
    if (item?.type === "map" && Array.isArray(item.properties) && item.properties.length > 0) {
      initialValue = item.properties.reduce((acc, prop: IPropertiesConfig) => {
        // TODO(#7): `prop.column` is overloaded — it's the data access key AND the antd
        // Descriptions column layout prop. Needs a dedicated `dataKey` field in IDetailFieldConfig
        // to disambiguate. Part of the Type Safety initiative.
        acc[ prop.column ] = valueFormatter(prop, itemData?.[ prop.column ]);
        return acc;
      }, {});

    } else if (item?.type === "list") {
      // item.items is { type, properties } — a structural subset of IDetailFieldConfig.
      // Cast is safe because valueFormatter only reads type/properties/items/fieldType
      // from the first argument, and the missing fields simply don't trigger format branches.
      initialValue = itemData?.map((it: unknown) => valueFormatter(item.items as IDetailFieldConfig, it)) ?? [];
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
    } else if (item?.fieldType === 'number' || item?.fieldType === 'range' || item?.fieldType === 'rating') {
      // Coerce numeric field types to actual numbers
      initialValue = typeof initialValue === 'number' ? initialValue : parseFloat(initialValue) || 0;
    }
    // All other field types (color, code, markdown, json, rich-text, wysiwyg,
    // file, image, hidden, custom) pass through unchanged — no formatting needed.

    return initialValue;
  }, [ formatDate, formatBoolean ]);

  // Derive entity name from apiUrl for React Query cache keying
  const detailEntityName = React.useMemo(() => {
    const url = detailApiConfig?.apiUrl || entityName || '';
    if (entityName) return entityName;
    const parts = url.split('/').filter(Boolean);
    const lastPart = parts[ parts.length - 1 ] || 'unknown';
    return lastPart.startsWith(':') ? (parts[ parts.length - 2 ] || 'unknown') : lastPart;
  }, [ detailApiConfig?.apiUrl, entityName ]);

  // ── Declarative data fetching via useEntityDetail ──
  const identifier = identifiers || dynamicID;

  const resolvedApiUrl = useMemo(() => {
    if (!detailApiConfig?.apiUrl) return '';
    return substituteUrlParams(detailApiConfig.apiUrl, routeParams, identifier);
  }, [ detailApiConfig?.apiUrl, routeParams, identifier ]);

  const cacheIdentifiers = useMemo((): Record<string, string> => {
    const ids: Record<string, string> = {};
    if (identifier) ids.id = String(identifier);
    if (routeParams) Object.entries(routeParams).forEach(([ k, v ]) => { ids[ k ] = String(v); });
    return ids;
  }, [ identifier, routeParams ]);

  const {
    data: fetchedData,
    isLoading: detailLoading,
    isFetching: detailFetching,
    error: detailError,
    refetch: refetchDetail,
  } = useEntityDetail({
    entityName: detailEntityName,
    apiConfig: detailApiConfig || { apiUrl: '', apiMethod: 'GET' },
    apiUrl: resolvedApiUrl,
    identifiers: cacheIdentifiers,
    enabled: !!detailApiConfig && !!resolvedApiUrl && !initialDetailResponse,
    staleTime: 30 * 1000,
  });

  // Source data: pre-loaded takes priority over fetched
  const detailResponse = initialDetailResponse || fetchedData || null;

  // Detect record-not-found (404 or empty response)
  const recordNotFound = useMemo(() => {
    if (detailError && isHttpStatus(detailError, 404)) {
      return true;
    }
    if (!initialDetailResponse && fetchedData !== undefined &&
      fetchedData && typeof fetchedData === 'object' && Object.keys(fetchedData).length === 0) {
      return true;
    }
    return false;
  }, [ detailError, fetchedData, initialDetailResponse ]);

  // Data is ready when pre-loaded OR hook finished loading OR 404 detected
  const dataLoaded = !!initialDetailResponse || !detailLoading || recordNotFound;

  // Format record info: combine propertiesConfig with formatted values from source data
  const recordInfo = useMemo(() => {
    if (!detailResponse) return propertiesConfig;
    return propertiesConfig.map(item => {
      const propertyPath = item.column || item.name || item.id;
      const nestedValue = getNestedValue(detailResponse, propertyPath);
      const formattedValue = valueFormatter(item, nestedValue);
      return { ...item, initialValue: formattedValue };
    });
  }, [ detailResponse, propertiesConfig, valueFormatter ]);

  // Track data update timestamp
  useEffect(() => {
    if (detailResponse) {
      setDataUpdatedAt(new Date().toISOString());
    }
  }, [ detailResponse ]);

  // Show error toast for non-404 errors
  useEffect(() => {
    if (!detailError) return;
    if (isHttpStatus(detailError, 404)) return;
    const errorResult = handleApiError(detailError, 'Failed to load details');
    notifyError(errorResult.formattedErrors.join('\n'));
  }, [ detailError, notifyError ]);

  // Expose refresh function to parent wrapper via ref
  useEffect(() => {
    if (refreshRef) {
      refreshRef.current = async () => { await refetchDetail(); };
    }
  }, [ refetchDetail, refreshRef ]);

  // Lift detail state to wrapper (if callback provided)
  useEffect(() => {
    if (!onDataChange || !detailResponse) return;

    onDataChange({
      record: detailResponse,
      pageType: 'view',
      entityName,
      dataUpdatedAt: dataUpdatedAt || undefined,
    });
  }, [ detailResponse, entityName, onDataChange, dataUpdatedAt ]);

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
        refetchDetail();
      }}
    >
      {!dataLoaded ? (
        loadingConfig?.type === 'spinner'
          ? <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin size="large" /></div>
          : <PageSkeleton type="detail" columns={columns.length || 2} rows={loadingConfig?.rows} />
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
        <Spin spinning={detailFetching && !detailLoading}>
          <div style={detailsStyles.container}>
            {columns.map((columnItems, colIdx) => (
              <div key={colIdx} style={detailsStyles.column}>
                {columnItems
                  .filter((item) => !item.hidden)
                  .map((item: IPropertiesConfig, index: number) => {
                    const value = item.initialValue;

                    // Run rendering pipeline (#95) for resolved label, formatting metadata
                    const pipelineResult = processField(
                      item,
                      value,
                      detailResponse || {},
                    );
                    const { label: pLabel, _formattingStyles: pStyles, _formattingClassName: pClassName, _registryDefaults: pDefaults } = pipelineResult.resolvedProps;

                    // Relation field rendering
                    if (item.relationConfig) {
                      return (
                        <DetailsFieldWrapper key={index} item={item} index={index} resolvedLabel={pLabel} formattingStyles={pStyles} formattingClassName={pClassName}>
                          <RelationFieldRenderer
                            relationConfig={item.relationConfig}
                            value={value}
                            record={detailResponse || {}}
                            routeParams={routeParams}
                            label={pLabel ?? resolveStringOrDefault(item.label)}
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
                          label: pLabel ?? resolveStringOrDefault(item.label),
                          config: item,
                          routeParams
                        }
                      );
                      const Renderer = CustomDetailRenderer;
                      return (
                        <DetailsFieldWrapper key={index} item={item} index={index} resolvedLabel={pLabel} formattingStyles={pStyles} formattingClassName={pClassName}>
                          <Renderer {...customDetailProps} />
                        </DetailsFieldWrapper>
                      );
                    }

                    // Null/undefined → em dash
                    if (value === null || value === undefined) {
                      return (
                        <DetailsFieldWrapper key={index} item={item} index={index} resolvedLabel={pLabel} formattingStyles={pStyles} formattingClassName={pClassName}>
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
                        ? evaluateTemplate(item.linkConfig.displayText, templateContext)
                        : value;

                      return (
                        <DetailsFieldWrapper key={index} item={item} index={index} resolvedLabel={pLabel} formattingStyles={pStyles} formattingClassName={pClassName}>
                          <Link url={linkUrl} className="details-link" target={item.target || '_blank'}>
                            {displayText} ({value})
                          </Link>
                        </DetailsFieldWrapper>
                      );
                    }

                    // Modal fields
                    if (item.openInModal) {
                      return (
                        <DetailsFieldWrapper key={index} item={item} index={index} resolvedLabel={pLabel} formattingStyles={pStyles} formattingClassName={pClassName}>
                          <OpenInModal
                            modalType="details"
                            primaryIndex={value}
                            modalPageConfig={{
                              pageTitle: pLabel ?? resolveStringOrDefault(item.label),
                              propertiesConfig: [ { ...item, label: pLabel ?? resolveStringOrDefault(item.label) } ],
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
                        <DetailsFieldWrapper key={index} item={item} index={index} resolvedLabel={pLabel} formattingStyles={pStyles} formattingClassName={pClassName}>
                          <JsonField data={value} title={pLabel ?? resolveStringOrDefault(item.label)} maxDepth={2} />
                        </DetailsFieldWrapper>
                      );
                    }

                    // Registry-based detail renderer — use pipeline defaults, lookup component directly
                    const DetailRenderer = fieldTypeRegistry.get(item.fieldType || '', 'detail');
                    if (DetailRenderer) {
                      const detailDefaults = pDefaults ?? fieldTypeRegistry.getDefaults(item.fieldType || '', 'detail');
                      const mergedConfig = detailDefaults ? { ...detailDefaults, ...item } : item;
                      return (
                        <DetailsFieldWrapper key={index} item={item} index={index} resolvedLabel={pLabel} formattingStyles={pStyles} formattingClassName={pClassName}>
                          <DetailRenderer
                            value={value}
                            label={pLabel ?? resolveStringOrDefault(item.label)}
                            config={mergedConfig}
                            routeParams={routeParams}
                            record={detailResponse || {}}
                          />
                        </DetailsFieldWrapper>
                      );
                    }

                    // Default fallback — smart text rendering
                    return (
                      <DetailsFieldWrapper key={index} item={item} index={index} resolvedLabel={pLabel} formattingStyles={pStyles} formattingClassName={pClassName}>
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
