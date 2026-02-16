/**
 * RelationFieldRenderer - Universal relation field renderer for tables and details
 * 
 * Renders relation fields with proper template evaluation, identifier mapping, and lazy modal opening.
 * This component extracts and reuses the relation rendering logic from Details.tsx.
 * 
 * Features:
 * - Template-based display using duplicated relation data in records
 * - Fallback templates when only IDs are available
 * - Lazy modal opening using OpenRouteInModal
 * - Support for custom actions
 * - Proper icon and link rendering
 * - Composite key support via identifier mapping
 * 
 * Performance:
 * - No N+1 queries - uses duplicated data in records
 * - Lazy modal config resolution - only when user clicks to open
 * 
 * @see fw24/src/entity/base-entity.ts - IRelationFieldConfig type definition
 * @see fw24/src/ui-config-gen/templates/util.ts - Backend auto-generation logic
 */
import React, { useMemo } from 'react';
import { Space, Tooltip, Button } from 'antd';
import { EyeOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Link } from '../../core/common';
import { OpenRouteInModal } from '../../modal/OpenRouteInModal';
import { substituteUrlParams, getNestedValue } from '../../core/utils';
import { evaluateTemplateValue } from '../../core/utils/template';
import type { Template } from '../../core/types';
import { RelatedRecordPeek } from './RelatedRecordPeek';

/**
 * Relation identifier mapping from source entity field to target entity parameter.
 * Supports nested paths (e.g., 'order.userId').
 * 
 * Matches backend type from fw24/src/entity/base-entity.ts (RelationIdentifier)
 */
export interface RelationIdentifier {
  /** Source field path (supports dot notation: 'order.userId') */
  source: string;
  /** Target parameter name */
  target: string;
}

/**
 * Entity configuration reference for lazy loading modal configs.
 * Instead of embedding full configs, we reference them by entity name and page type.
 * 
 * Matches backend type from fw24/src/entity/base-entity.ts (IEntityConfigReference)
 */
export interface IEntityConfigReference {
  /** Entity name (e.g., 'team', 'game', 'user') */
  entityName: string;
  /** Page type to reference */
  pageType: 'view' | 'create' | 'list';
  /** Optional config overrides */
  overrideConfig?: {
    pageTitle?: string;
    defaultFilters?: Record<string, any>;
    hideFields?: string[];
    showOnlyFields?: string[];
    [ key: string ]: any;
  };
}

/**
 * Display configuration for relation fields.
 * Controls templates, fallbacks, icons, and actions.
 * 
 * Matches backend type from fw24/src/entity/base-entity.ts (IRelationFieldConfig.displayConfig)
 */
export interface IRelationDisplayConfig {
  /** Template for displaying hydrated relation data */
  template?: Template;

  /** Fallback configuration when only ID is available */
  fallback?: {
    /** Fallback template (string only - backend pre-generates) */
    template: string;
    /** Link text override */
    linkText?: string;
    /** Modal button text override */
    modalButtonText?: string;
  };

  /** Icon name (Ant Design icon) */
  icon?: string;

  /** Show navigation link? Default: true for to-one, false for to-many */
  showLink?: boolean;

  /** Show modal button? Default: true */
  showModalIcon?: boolean;

  /** Configure which actions to render */
  actions?: boolean | {
    link?: boolean;
    modal?: boolean;
    custom?: Array<{
      label: string;
      /** Dynamic custom action label template */
      template?: Template;
      icon?: string;
      /** Function body as string - will be eval'd */
      onClick: string;
    }>;
  };

  /**
   * Hover preview (peek) configuration.
   * When enabled, hovering over relation links shows a popover with key fields.
   */
  preview?: {
    /** Enable hover preview. @default false */
    enabled: boolean;
    /** Fields to display in the popover. Defaults to auto-detected from entity config. */
    fields?: string[];
    /** Delay before showing popover (ms). @default 300 */
    delay?: number;
    /** Popover placement. @default 'right' */
    placement?: 'right' | 'top' | 'auto';
    /** Max width of popover (px). @default 400 */
    maxWidth?: number;
  };
}

/**
 * Relation field configuration (UI Layer).
 * 
 * This is the UI layer config for rendering relation fields in detail pages and tables.
 * Separate from the DATA layer (Relation<E> in entity attribute's `relation` property).
 * 
 * Matches backend type from fw24/src/entity/base-entity.ts (IRelationFieldConfig)
 */
export interface IRelationFieldConfig {
  /** Route pattern for navigation (e.g., '/view-team/:teamId' or '/list-game') */
  routePattern: string;

  /** Identifier mappings from source fields to target params */
  identifierMapping?: RelationIdentifier | RelationIdentifier[];

  /** Reference to entity config for modal display (for lazy loading) */
  modalConfigRef?: IEntityConfigReference;

  /** Modal width in pixels or CSS string. Default: 800 for to-one, 1200 for to-many */
  modalWidth?: number | string;

  /** Modal title override. Default: uses page title from config */
  modalTitle?: string;

  /** Display configuration */
  displayConfig?: IRelationDisplayConfig;
}

export interface RelationFieldRendererProps {
  /** Relation configuration from backend */
  relationConfig: IRelationFieldConfig;
  /** Raw value of the relation field (e.g., 'team-123' or ['game-1', 'game-2']) */
  value: any;
  /** Full record object (contains duplicated relation data for template evaluation) */
  record: Record<string, any>;
  /** Current route parameters */
  routeParams: Record<string, string>;
  /** Field label */
  label: string;
}

/**
 * RelationFieldRenderer Component
 * 
 * Renders relation fields with templates, links, and modal actions.
 * Used in both table cells and detail pages for consistent relation rendering.
 */
export const RelationFieldRenderer: React.FC<RelationFieldRendererProps> = ({
  relationConfig,
  value,
  record,
  routeParams,
  label,
}) => {
  const {
    routePattern,
    identifierMapping,
    modalConfigRef,
    modalWidth,
    modalTitle,
    displayConfig,
  } = relationConfig;

  // Build route params using full record data for placeholder resolution
  // This includes mapping identifier sources to targets for proper filtering
  const modalRouteParams = useMemo(() => {
    const params: Record<string, any> = {
      ...routeParams,
      ...record, // Include full record for template evaluation
    };

    // Extract and map identifiers from source to target
    // Supports nested paths (e.g., 'order.userId') via getNestedValue
    // Handles both single and multiple identifier mappings (composite keys)
    if (identifierMapping) {
      const mappings = Array.isArray(identifierMapping)
        ? identifierMapping
        : [ identifierMapping ];

      mappings.forEach((mapping) => {
        // Extract value from record using source path (supports nesting)
        let sourceValue = getNestedValue(record, mapping.source);

        // Fallback: if source field doesn't exist, try using 'id' or routeParams.id
        // This handles cases where backend config uses entity name (e.g., 'teamId') but entity has 'id'
        if (sourceValue == null) {
          sourceValue = record.id || routeParams.id;
        }

        // Map to target parameter for API call
        // ONLY set the target field - that's what the filter expects
        if (sourceValue != null) {
          params[ mapping.target as string ] = sourceValue;
        } else {
          console.warn(
            `[RelationFieldRenderer] No value found for identifier source path: "${mapping.source}"`,
            `Field: ${label}`
          );
        }
      });
    }
    return params;
  }, [ record, routeParams, identifierMapping, label ]);

  // Resolve the URL with mapped identifiers and filters (for link)
  const resolvedUrl = useMemo(() => {
    let url = substituteUrlParams(routePattern, modalRouteParams, value);
    
    // For to-many relations, append filters from modalConfigRef.overrideConfig.defaultFilters as query params
    // This ensures the target page shows filtered data (e.g., games for specific team)
    if (modalConfigRef?.pageType === 'list' && modalConfigRef.overrideConfig?.defaultFilters) {
      const filters = modalConfigRef.overrideConfig.defaultFilters;
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, filterValue]) => {
        // Resolve placeholder like ':gameId' from modalRouteParams
        let resolvedValue = filterValue;
        if (typeof filterValue === 'string' && filterValue.startsWith(':')) {
          const paramName = filterValue.substring(1); // Remove ':'
          resolvedValue = modalRouteParams[paramName];
        }
        
        if (resolvedValue != null) {
          // Add filter as query param (e.g., gameId=game-123)
          // The table parser will automatically convert this to {gameId: {eq: "game-123"}}
          queryParams.set(key, String(resolvedValue));
        }
      });
      
      // Append query params to URL
      const queryString = queryParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }
    
    return url;
  }, [ routePattern, modalRouteParams, value, modalConfigRef ]);

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

  // Check if relation value exists (null/undefined check)
  const hasValue = value != null && value !== '' &&
    !(typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);

  // Smart display value with template support
  // Priority:
  // 1. Hydrated data with template (object value + displayConfig.template)
  // 2. Fallback template for ID-only data (string/number value + displayConfig.fallback.template)
  // 3. Default for to-many lists (show count or 'View related items')
  // 4. Empty value fallback ('—')
  // 5. Raw value as-is
  const displayValue: string = useMemo(() => {
    // 1. Primary template evaluation
    // Try to evaluate primary template against:
    // a) Hydrated object data (for detail pages with expanded relations)
    // b) Full record context (for list pages with duplicated fields like homeTeamName, seasonName)
    if (displayConfig?.template && hasValue) {
      try {
        // If value is a hydrated object, use it directly
        if (typeof value === 'object' && !Array.isArray(value)) {
          return evaluateTemplateValue(displayConfig.template, value);
        }

        // Otherwise (value is just an ID string), try evaluating against full record
        // This supports smart detection of duplicated fields (e.g., {homeTeamName} for homeTeamId)
        // modalRouteParams includes the full record (line 177: ...record)
        const result = evaluateTemplateValue(displayConfig.template, modalRouteParams);

        // If template evaluation succeeded and returned a non-empty result, use it
        // Otherwise, fall through to fallback template
        if (result && result !== '' && result !== 'undefined' && !result.includes('undefined')) {
          return result;
        }
      } catch (e) {
        console.warn(`[RelationFieldRenderer] Primary template evaluation failed for relation ${label}:`, e);
        // Fall through to fallback
      }
    }

    // 2. Fallback for partially resolved data (only ID present)
    // Use backend-provided fallback template - evaluate it with full context (modalRouteParams)
    // Backend generates templates like 'Team: {teamId}' not '{id}', so we need full context
    if (displayConfig?.fallback?.template && hasValue && (typeof value === 'string' || typeof value === 'number')) {
      try {
        return evaluateTemplateValue(displayConfig.fallback.template, modalRouteParams);
      } catch (e) {
        console.warn(`[RelationFieldRenderer] Fallback template evaluation failed for relation ${label}:`, e);
        return String(value);
      }
    }

    // 3. Default fallbacks for different relation types
    if (modalType === 'list') {
      return (Array.isArray(value) && value.length > 0) ? `${value.length} items` : 'View related items';
    }

    // 4. Handle missing/null values
    if (!hasValue) {
      return '—'; // Em dash for 'not assigned'
    }

    // 5. Last resort: use value as-is
    return (Array.isArray(value) && value.length > 0) ? `${value.length} items` : String(value);
  }, [ displayConfig, hasValue, value, modalType, modalRouteParams, label ]);

  // Evaluate modal title (static or template)
  // Use modalRouteParams (includes full record) for rich title templates like "{teamName} - Away Games"
  const effectiveModalTitle = useMemo(() => {
    // If modalTitle is provided, evaluate it as template
    if (modalTitle) {
      // Evaluate template if it's a string with placeholders
      if (typeof modalTitle === 'string') {
        return evaluateTemplateValue(modalTitle, modalRouteParams, label);
      }
      // For complex templates, evaluate with full context
      return evaluateTemplateValue(modalTitle, modalRouteParams, label);
    }

    // Default: Use the field label (e.g., "Away Games", "Home Team")
    // This is better than generic page title like "Game Listing"
    return label;
  }, [ modalTitle, modalRouteParams, label ]);

  // Rendering strategy:
  // - To-many (list): Show action icons only (link icon for navigation + eye icon for modal)
  //   No text to avoid duplication with section header
  // - To-one: Show value as link/text + action icons
  const isToMany = modalType === 'list';

  // Preview (peek) config — only for to-one relations with a modal config ref
  const previewConfig = displayConfig?.preview;
  const peekEnabled = !isToMany && previewConfig?.enabled && modalConfigRef;

  // Build resolved identifiers for peek (reuse modalRouteParams which already has them)
  const peekIdentifiers = useMemo(() => {
    if (!peekEnabled || !identifierMapping) return {};
    const mappings = Array.isArray(identifierMapping) ? identifierMapping : [identifierMapping];
    const ids: Record<string, string> = {};
    mappings.forEach((m) => {
      const v = getNestedValue(record, m.source) ?? record.id ?? routeParams.id;
      if (v != null) ids[m.target as string] = String(v);
    });
    return ids;
  }, [peekEnabled, identifierMapping, record, routeParams.id]);

  // Conditionally wrap content with hover preview
  const wrapWithPeek = (content: React.ReactNode) => {
    if (!peekEnabled || !modalConfigRef) return content;
    return (
      <RelatedRecordPeek
        entityConfigRef={modalConfigRef}
        identifiers={peekIdentifiers}
        detailUrl={resolvedUrl}
        fields={previewConfig?.fields}
        delay={previewConfig?.delay}
        placement={previewConfig?.placement}
        maxWidth={previewConfig?.maxWidth}
      >
        {content}
      </RelatedRecordPeek>
    );
  };

  return (
    <Space size="small">
      {/* For to-one relations: Show value as link or plain text */}
      {!isToMany && (
        <>
          {hasValue && shouldShowLink && shouldShowActions && (!actionConfig || actionConfig.link !== false)
            ? wrapWithPeek(
              <Link url={resolvedUrl} className="details-link">
                {displayValue}
              </Link>
            )
            : hasValue
            ? wrapWithPeek(<span>{displayValue}</span>)
            : <span style={{ color: '#999' }}>—</span>
          }
        </>
      )}

      {/* Action buttons */}
      {shouldShowActions && (
        <>
          {/* Navigation link icon (for to-many only, to avoid text duplication) */}
          {isToMany && shouldShowLink && (!actionConfig || actionConfig.link !== false) && (
            <Tooltip title={`Go to ${label} page`}>
              <Link url={resolvedUrl}>
                <Button
                  type="link"
                  size="small"
                  icon={<IconComponent />}
                  style={{ padding: '0 4px' }}
                />
              </Link>
            </Tooltip>
          )}

          {/* Modal icon - for both to-one and to-many */}
          {(isToMany || hasValue) && (!actionConfig || actionConfig.modal !== false) && displayConfig?.showModalIcon !== false && modalConfigRef && (
            <Tooltip title={`View ${label} in modal`}>
              <OpenRouteInModal
                url={routePattern}
                routeParams={modalRouteParams}
                modalConfigRef={modalConfigRef}
                primaryIndex={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}
                modalWidth={modalWidth}
                modalTitle={effectiveModalTitle}
              >
                <Button
                  type="link"
                  size="small"
                  icon={<EyeOutlined />}
                  style={{ padding: '0 4px' }}
                />
              </OpenRouteInModal>
            </Tooltip>
          )}

          {/* Custom action buttons */}
          {actionConfig?.custom && actionConfig.custom.map((customAction, idx) => {
            // For to-many: always show custom actions
            // For to-one: only show if value exists
            if (!isToMany && !hasValue) return null;

            const customActionLabel = customAction.template
              ? evaluateTemplateValue(customAction.template, typeof value === 'object' && !Array.isArray(value) ? value : { id: value })
              : customAction.label;

            return (
              <Tooltip key={idx} title={customActionLabel}>
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    // Execute custom onClick handler (string as function reference)
                    if (customAction.onClick && typeof window !== 'undefined') {
                      try {
                        // eslint-disable-next-line no-eval
                        const fn = eval(`(${customAction.onClick})`);
                        if (typeof fn === 'function') {
                          fn(value, record, routeParams);
                        }
                      } catch (e) {
                        console.error(`[RelationFieldRenderer] Failed to execute custom action for ${label}:`, e);
                      }
                    }
                  }}
                  icon={customAction.icon ? <span className={customAction.icon} /> : undefined}
                  style={{ padding: '0 4px' }}
                >
                  {!customAction.icon && customActionLabel}
                </Button>
              </Tooltip>
            );
          })}
        </>
      )}
    </Space>
  );
};
