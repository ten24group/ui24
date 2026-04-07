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
 * 1. Accept record data via `dataSource` prop
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
 *   dataSource={{ teamName: 'Lakers', city: 'Los Angeles', logo: '...' }}
 * />
 * ```
 * 
 * @see {@link RelationFieldRenderer} for relation field rendering
 * @see {@link useFormat} for date/boolean formatting
 */

import { Button, Spin, Tooltip, Typography } from 'antd';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { DataLoadingState } from '../core/common/DataLoadingState';
import { useParams } from "react-router-dom";
import { ErrorFallback, JsonDescription, JsonField, Link, EmptyState } from '../core/common';
import { QueryErrorState } from '../core/common/ErrorFallback';
import { MaskedDisplay } from '../core/common/MaskedDisplay';
import { computeDerivedValue } from '../core/hooks/useDerivedFields';
import { IApiConfig, useApi, useAppContext, useModalContext } from '../core/context';
import { resolveHelpConfig, HelpText, HelpIcon } from '../core/forms/FormField/components';
import { determineColumnLayout, IColumnsConfig } from '../core/forms/shared/utils';
import { useEntityConfig, useFormat } from '../core/hooks';
import { useTranslation } from '../core/hooks';
import { useEvaluatedItems } from '../core/hooks/useEvaluatedItems';
import { getNestedValue, substituteUrlParams } from '../core/utils';
import { handleApiError, isHttpStatus } from '../core/utils/api-error-handler';
import { OpenInModal } from '../modal/Modal';
import './Details.css';
import { detailsStyles } from './styles';

import { IDetailFieldConfig, Template, type IDetailDataChangePayload, type IDetailsConfig, type IDetailsComponentProps } from '../core/types/field-config';
import { resolveStringOrDefault } from '../core/types/evaluation';
import { ISectionsConfig } from '../pages/PostAuth/SectionsRenderer';
import { RelationFieldRenderer } from '../table/renderers/RelationFieldRenderer';
import { useCoreNavigator } from '../routes/Navigation';
import { evaluateTemplate } from '../core/utils/template';
import { getFieldRenderer, buildDetailFieldProps, type DetailFieldConfig } from '../core/registry';
import { useEntityDetail } from '../core/query/useEntityDetail';
import { fieldTypeRegistry } from '../core/registry/FieldTypeRegistry';
import { useRenderPipeline } from '../core/rendering';
import { DisplayOverrideEditModal, resolveDisplayValueForPath } from '../core/display-overrides';
import type { DisplayOverrideEntry, DisplayOverrideStorage } from '../core/types/display-override';
import { DataQualityIndicator, type IDataQualityConfig } from '../core/common/DataQualityIndicator';
import '../core/registry/field-types'; // ensure built-in registrations run
import { EditOutlined } from '@ant-design/icons';

// Stable empty object to avoid re-creating {} on every render (used as default for routeParams)
const EMPTY_ROUTE_PARAMS: Record<string, string> = {};

type DisplayOverrideActions = {
  patchDisplayOverride: (path: string, entry: DisplayOverrideEntry | null) => Promise<void>;
  record: Record<string, unknown> | null;
};

const DisplayOverrideActionsContext = createContext<DisplayOverrideActions | null>(null);

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
  /** Raw or formatted value — used for clipboard copy when copyable is true */
  value?: unknown;
}> = ({ item, index, children, resolvedLabel, formattingStyles, formattingClassName, value }) => {
  const [ overrideModalOpen, setOverrideModalOpen ] = useState(false);
  const [ overrideSaving, setOverrideSaving ] = useState(false);
  const overrideActions = useContext(DisplayOverrideActionsContext);
  const { t } = useTranslation(); // i18n (#22)
  const help = resolveHelpConfig({
    helpText: resolveStringOrDefault(item.helpText),
    help: item.help,
  });

  // When copyable, wrap the value content with Typography.Text copyable.
  // Only wraps for primitive values (string/number/boolean) — not complex objects.
  const isPrimitive = value != null && value !== '' && typeof value !== 'object';
  const content = item.copyable && isPrimitive
    ? (
      <Typography.Text
        copyable={{ text: String(value), tooltips: [ 'Copy', 'Copied' ] }}
        style={{ display: 'inline' }}
      >
        {children}
      </Typography.Text>
    )
    : children;

  const displayLabel = t(resolvedLabel ?? resolveStringOrDefault(item.label)); // i18n (#22)
  const containerClassName = [ 'details-field-container', formattingClassName ].filter(Boolean).join(' ');
  const ov = item.displayOverride;
  const chrome = ov?.chrome ?? 'tag';
  const showOverrideChrome =
    item.displayOverrideActive && chrome !== 'none';
  const overrideTitle = showOverrideChrome
    ? 'Override set (click to edit)'
    : 'Set display override';
  const propertyPath = item.column || item.name || item.id;
  const canonicalRaw =
    overrideActions?.record && propertyPath
      ? getNestedValue(overrideActions.record, propertyPath)
      : undefined;
  const currentOverride: DisplayOverrideEntry | null =
    item.displayOverrideActive && item.displayOverrideValue !== undefined
      ? { value: item.displayOverrideValue, kind: 'value' }
      : null;

  const handleSaveOverride = async (entry: DisplayOverrideEntry) => {
    if (!overrideActions || !ov?.path) return;
    setOverrideSaving(true);
    try {
      await overrideActions.patchDisplayOverride(ov.path, entry);
      setOverrideModalOpen(false);
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleClearOverride = async () => {
    if (!overrideActions || !ov?.path) return;
    setOverrideSaving(true);
    try {
      await overrideActions.patchDisplayOverride(ov.path, null);
      setOverrideModalOpen(false);
    } finally {
      setOverrideSaving(false);
    }
  };

  return (
    <div key={index} className={containerClassName} style={formattingStyles}>
      <div className="details-field-label">
        {displayLabel}
        {ov && overrideActions && (
          <Tooltip title={overrideTitle}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ color: showOverrideChrome ? '#faad14' : '#8c8c8c' }} />}
              onClick={() => setOverrideModalOpen(true)}
              style={{ padding: 0, marginLeft: 6, minWidth: 18, height: 'auto' }}
            />
          </Tooltip>
        )}
        <HelpIcon help={help} />
      </div>
      <HelpText help={help} />
      {content}
      {ov && overrideActions && (
        <DisplayOverrideEditModal
          open={overrideModalOpen}
          onClose={() => setOverrideModalOpen(false)}
          fieldConfig={item}
          canonicalRaw={canonicalRaw}
          currentOverride={currentOverride}
          saving={overrideSaving}
          onSave={handleSaveOverride}
          onClear={handleClearOverride}
        />
      )}
    </div>
  );
};

// IDetailsConfig and IDetailsComponentProps are now in core/types/field-config.ts
export type { IDetailsConfig, IDetailsComponentProps };

/**
 * RecordNotFoundState - Smart error state for missing records.
 * Uses modal context to close modal/drawer if inside one, otherwise navigates back.
 */
const RecordNotFoundState: React.FC<{ entityName?: string }> = ({ entityName }) => {
  const { isInModal, closeModal } = useModalContext();
  const navigate = useCoreNavigator();

  const handleGoBack = () => {
    if (isInModal && closeModal) {
      closeModal();
    } else {
      navigate(-1);
    }
  };

  return (
    <EmptyState
      variant="noData"
      entityName={entityName}
      config={{
        noData: {
          title: `${entityName || 'Record'} not found`,
          description: 'The record you are looking for may have been deleted or does not exist.',
          action: {
            label: isInModal ? 'Close' : 'Go Back',
            onClick: handleGoBack
          }
        }
      }}
    />
  );
};

/**
 * Main Details component for rendering read-only record details.
 * 
 * Provides a complete detail view solution with data loading, formatting,
 * multi-column layouts, and support for various field types including relations,
 * images, JSON, rich text, and more.
 * 
 * @param props - Details configuration props
 * @param props.propertiesConfig - Field configurations from backend
 * @param props.detailApiConfig - API configuration for loading data (optional if dataSource provided)
 * @param props.identifiers - Record identifier for API fetching
 * @param props.columnsConfig - Multi-column layout configuration
 * @param props.routeParams - Route parameters for URL substitution
 * @param props.dataSource - Pre-loaded record data (bypasses API call)
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
  dataSource: initialDataSource,
  entityName,
  onDataChange,
  refreshRef,
  loading: loadingConfig,
  dataQuality: dataQualityConfig,
  errorHandling: errorHandlingConfig,
  retry: retryConfig,
  displayOverrides,
}) => {
  // TODO(#7): Remove dynamicID fallback once all routes pass `identifiers` prop explicitly.
  // Currently, some routes use :dynamicID as the URL param and rely on this fallback.
  // Requires backend config generation to consistently set `identifiers` on detail pages.
  const { dynamicID } = useParams()
  const { notifyError, notifySuccess } = useAppContext();
  const { callApiMethod } = useApi();
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

  // ── Declarative data fetching via useEntityDetail ──
  const identifier = identifiers || dynamicID;

  const {
    data: fetchedData,
    entityName: detailEntityName,
    isLoading: detailLoading,
    isFetching: detailFetching,
    error: detailError,
    refetch: refetchDetail,
    invalidate: invalidateDetail,
  } = useEntityDetail({
    apiConfig: detailApiConfig || { apiUrl: '', apiMethod: 'GET' },
    routeParams,
    identifier,
    entityName,
    enabled: !!detailApiConfig && !initialDataSource,
    staleTime: 30 * 1000,
  });

  // Source data: pre-loaded takes priority over fetched
  const resolvedData = initialDataSource || fetchedData || null;

  // Detect record-not-found (404 or empty response)
  const recordNotFound = useMemo(() => {
    if (detailError && isHttpStatus(detailError, 404)) {
      return true;
    }
    if (!initialDataSource && fetchedData !== undefined &&
      fetchedData && typeof fetchedData === 'object' && Object.keys(fetchedData).length === 0) {
      return true;
    }
    return false;
  }, [ detailError, fetchedData, initialDataSource ]);

  // Data is ready when pre-loaded OR hook finished loading OR 404 detected
  const dataLoaded = !!initialDataSource || !detailLoading || recordNotFound;

  // Format record info: combine propertiesConfig with formatted values from source data
  const recordInfo = useMemo(() => {
    if (!resolvedData) return propertiesConfig;
    const rawOverrideMap = displayOverrides
      ? getNestedValue(resolvedData as Record<string, unknown>, displayOverrides.storageAttribute)
      : undefined;

    return propertiesConfig.map(item => {
      // Derived / computed fields (#35) — compute value from record at render time
      if (item.derived) {
        const derivedValue = computeDerivedValue(item.derived, resolvedData as Record<string, unknown>);
        return { ...item, initialValue: derivedValue };
      }
      const propertyPath = item.column || item.name || item.id;
      const pathStr = typeof propertyPath === 'string' ? propertyPath : String(propertyPath ?? '');
      const nestedValue = getNestedValue(resolvedData, propertyPath);

      let valueForFormat = nestedValue;
      let displayOverrideActive = false;
      let displayOverrideValue: unknown = undefined;
      const overrideSpec = item.displayOverride;
      if (
        displayOverrides &&
        overrideSpec &&
        pathStr.length > 0 &&
        pathStr === overrideSpec.path
      ) {
        const { hasOverride, entry } = resolveDisplayValueForPath({
          canonical: nestedValue,
          overrides: rawOverrideMap as DisplayOverrideStorage | undefined,
          path: overrideSpec.path,
          channel: overrideSpec.channels?.[ 0 ],
        });
        if (hasOverride) {
          displayOverrideActive = true;
          displayOverrideValue = entry?.value;
        }
      }

      const formattedValue = valueFormatter(item, valueForFormat);
      return { ...item, initialValue: formattedValue, displayOverrideActive, displayOverrideValue };
    });
  }, [ resolvedData, propertiesConfig, valueFormatter, displayOverrides ]);

  const patchDisplayOverride = useCallback(
    async (path: string, entry: DisplayOverrideEntry | null) => {
      if (!detailApiConfig?.apiUrl || !resolvedData || !displayOverrides?.storageAttribute) return;
      const storage = displayOverrides.storageAttribute;
      const raw = getNestedValue(resolvedData as Record<string, unknown>, storage);
      const currentMap: Record<string, unknown> =
        raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
      if (entry === null) {
        delete currentMap[ path ];
      } else {
        currentMap[ path ] = entry;
      }
      const url = substituteUrlParams(detailApiConfig.apiUrl, routeParams, identifier);
      try {
        await callApiMethod({
          ...detailApiConfig,
          apiMethod: 'PATCH',
          apiUrl: url,
          payload: { [ storage ]: currentMap },
        });
        notifySuccess('Display override saved');
        await invalidateDetail();
      } catch (e) {
        const err = handleApiError(e, 'Failed to save display override');
        notifyError(err.formattedErrors.join('\n'));
      }
    },
    [
      detailApiConfig,
      resolvedData,
      displayOverrides,
      identifier,
      routeParams,
      callApiMethod,
      notifySuccess,
      notifyError,
      invalidateDetail,
    ]
  );

  const displayOverrideContextValue = useMemo((): DisplayOverrideActions | null => {
    if (!displayOverrides || !detailApiConfig?.apiUrl || !resolvedData) return null;
    return {
      patchDisplayOverride,
      record: resolvedData as Record<string, unknown>,
    };
  }, [ displayOverrides, detailApiConfig?.apiUrl, resolvedData, patchDisplayOverride ]);

  // Track data update timestamp
  useEffect(() => {
    if (resolvedData) {
      setDataUpdatedAt(new Date().toISOString());
    }
  }, [ resolvedData ]);

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
    if (!onDataChange || !resolvedData) return;

    onDataChange({
      record: resolvedData,
      pageType: 'view',
      entityName,
      dataUpdatedAt: dataUpdatedAt || undefined,
    });
  }, [ resolvedData, entityName, onDataChange, dataUpdatedAt ]);

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
    <DisplayOverrideActionsContext.Provider value={displayOverrideContextValue}>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => {
          // Re-fetch data on error boundary reset
          refetchDetail();
        }}
      >
        {!dataLoaded ? (
          <DataLoadingState type={loadingConfig?.type} pageType="detail" columns={columns.length || 2} rows={loadingConfig?.rows} />
        ) : detailError && !recordNotFound ? (
          <QueryErrorState
            error={detailError}
            onRetry={refetchDetail}
            errorHandling={errorHandlingConfig}
            retry={retryConfig}
          />
        ) : recordNotFound ? (
          // Record not found — show contextual empty state with smart "Go Back" behavior
          <RecordNotFoundState entityName={detailEntityName} />
        ) : (
          // Show spinner overlay only for refresh (keeps content visible)
          <Spin spinning={detailFetching && !detailLoading}>
            {dataQualityConfig?.enabled && dataQualityConfig.showInDetail !== false && resolvedData && (
              <div style={{ marginBottom: 16 }}>
                <DataQualityIndicator
                  record={resolvedData as Record<string, unknown>}
                  config={dataQualityConfig}
                  propertiesConfig={propertiesConfig}
                  mode="full"
                />
              </div>
            )}
            <div style={detailsStyles.container}>
              {columns.map((columnItems, colIdx) => (
                <div key={colIdx} style={detailsStyles.column}>
                  {columnItems
                    .map((item: IPropertiesConfig, index: number) => {
                      const value = item.initialValue;

                      // Run rendering pipeline (#95) for resolved label, formatting metadata
                      const pipelineResult = processField(
                        item,
                        value,
                        resolvedData || {},
                      );
                      const { label: pLabel, _formattingStyles: pStyles, _formattingClassName: pClassName, _registryDefaults: pDefaults } = pipelineResult.resolvedProps;

                      // Relation field rendering
                      if (item.relationConfig) {
                        return (
                          <DetailsFieldWrapper key={index} item={item} index={index} resolvedLabel={pLabel} formattingStyles={pStyles} formattingClassName={pClassName} value={value}>
                            <RelationFieldRenderer
                              relationConfig={item.relationConfig}
                              value={value}
                              record={resolvedData || {}}
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
                          <DetailsFieldWrapper key={index} item={item} index={index} resolvedLabel={pLabel} formattingStyles={pStyles} formattingClassName={pClassName} value={value}>
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

                      // Data masking (#51) — wrap string values when masking is configured
                      if (item.masking?.enabled && typeof value === 'string') {
                        return (
                          <DetailsFieldWrapper key={index} item={item} index={index} resolvedLabel={pLabel} formattingStyles={pStyles} formattingClassName={pClassName} value={value}>
                            <MaskedDisplay value={value} config={item.masking} />
                          </DetailsFieldWrapper>
                        );
                      }

                      // Link fields
                      if (item.linkConfig) {
                        const linkUrl = substituteUrlParams(
                          item.linkConfig.routePattern,
                          { ...routeParams, ...resolvedData },
                          value
                        );

                        const templateContext = { ...routeParams, ...resolvedData };
                        const displayText = item.linkConfig.displayText
                          ? evaluateTemplate(item.linkConfig.displayText, templateContext)
                          : value;

                        return (
                          <DetailsFieldWrapper key={index} item={item} index={index} resolvedLabel={pLabel} formattingStyles={pStyles} formattingClassName={pClassName} value={value}>
                            <Link url={linkUrl} className="details-link" target={item.target || '_blank'}>
                              {displayText} ({value})
                            </Link>
                          </DetailsFieldWrapper>
                        );
                      }

                      // Modal fields
                      if (item.openInModal) {
                        return (
                          <DetailsFieldWrapper key={index} item={item} index={index} resolvedLabel={pLabel} formattingStyles={pStyles} formattingClassName={pClassName} value={value}>
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

                      // List-of-objects: render as an inline table instead of JSON
                      if (
                        item.type === 'list' &&
                        Array.isArray(value) &&
                        value.length > 0 &&
                        value.some(v => typeof v === 'object' && v !== null)
                      ) {
                        const rendererKey = item.fieldType === 'inline-table' ? 'inline-table' : 'list';
                        const ListRenderer = fieldTypeRegistry.get(rendererKey, 'detail');
                        if (ListRenderer) {
                          return (
                            <DetailsFieldWrapper key={index} item={item} index={index} resolvedLabel={pLabel} formattingStyles={pStyles} formattingClassName={pClassName}>
                              <ListRenderer value={value} config={item} />
                            </DetailsFieldWrapper>
                          );
                        }
                      }

                      // Complex data (json, map, list, objects)
                      const isComplexData =
                        ![ 'rich-text', 'wysiwyg', 'multi-select', 'timeline' ].includes(item.fieldType) && (
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
                          <DetailsFieldWrapper key={index} item={item} index={index} resolvedLabel={pLabel} formattingStyles={pStyles} formattingClassName={pClassName} value={value}>
                            <DetailRenderer
                              value={value}
                              label={pLabel ?? resolveStringOrDefault(item.label)}
                              config={mergedConfig}
                              routeParams={routeParams}
                              record={resolvedData || {}}
                            />
                          </DetailsFieldWrapper>
                        );
                      }

                      // Default fallback — smart text rendering
                      return (
                        <DetailsFieldWrapper key={index} item={item} index={index} resolvedLabel={pLabel} formattingStyles={pStyles} formattingClassName={pClassName} value={value}>
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
    </DisplayOverrideActionsContext.Provider>
  );
};

export { Details };
