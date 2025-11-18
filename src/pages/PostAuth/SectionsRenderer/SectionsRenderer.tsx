import React, { useState, useCallback, useMemo } from 'react';
import { Tabs, Collapse, Card, Alert } from 'antd';
import type { TabsProps, CollapseProps } from 'antd';
import { CaretRightOutlined, WarningOutlined } from '@ant-design/icons';
import { evaluateTemplateValue } from '../../../core/utils/template';
import { RenderFromPageType, IRenderFromPageType } from '../PostAuthPage';
import type { Template } from '../../../core/types/field-config';
import { ITableConfig } from '../../../table/type';
import { IDetailsConfig } from '../../../detail/Details';
import { IForm } from '../../../core/forms/formConfig';
import { IDashboardPageConfig } from '../DashboardPage';
import { useEntityConfig } from '../../../core/hooks';
import type { VisibilityConfig } from '../../../core/types/evaluation';
import type { IEntityConfigReference } from '../../../core/hooks/useEntityConfig';
import { universalEvaluator } from '../../../core/utils/UniversalEvaluator';
import { useEvaluationContext } from '../../../core/context/EvaluationContext';

/**
 * Section configuration interface
 * Defines a single section that can render any page type (list, details, form, dashboard)
 */
export interface ISectionConfig {
  readonly label: Template;
  readonly icon?: string;
  readonly badge?: Template;
  readonly visibility?: VisibilityConfig;
  readonly sortOrder?: number;
  readonly pageType: 'list' | 'details' | 'form' | 'dashboard';
  readonly listPageConfig?: ITableConfig;
  readonly detailsPageConfig?: IDetailsConfig & {
    readonly useParentData?: boolean;
  };
  readonly formPageConfig?: IForm;
  readonly dashboardPageConfig?: IDashboardPageConfig;

  /** 
   * Reference to existing entity config (recommended - avoids duplication)
   * Use this instead of inline configs to reference entity's list/view/create configs with optional overrides.
   * 
   * @example
   * entityConfigRef: {
   *   entityName: 'order',
   *   pageType: 'list',
   *   overrideConfig: {
   *     defaultFilters: { userId: ':userId' }
   *   }
   * }
   */
  readonly entityConfigRef?: IEntityConfigReference;

}

/**
 * Section group configuration
 * Groups multiple sections into a labeled card with its own tabs/accordion
 */
export interface ISectionGroup {
  readonly id: string;
  readonly label?: Template;
  readonly icon?: string;
  readonly visibility?: VisibilityConfig;
  readonly sortOrder?: number;
  readonly renderMode?: 'tabs' | 'accordion';
  readonly lazyLoad?: boolean;
  readonly keepMounted?: boolean;
  readonly sections: Record<string, ISectionConfig>;
}

/**
 * Sections configuration for multi-section pages
 * Enables tabbed or accordion-based section rendering
 * 
 * Supports two formats:
 * 1. Single group: Use `sections` directly (backward compatible)
 * 2. Multiple groups: Use `sectionGroups` array (new)
 */
export interface ISectionsConfig {
  // Single group format (backward compatible)
  readonly renderMode?: 'tabs' | 'accordion';
  readonly position?: 'below' | 'right';
  readonly lazyLoad?: boolean;
  readonly keepMounted?: boolean;
  readonly sections?: Record<string, ISectionConfig>;

  // Multiple groups format (new)
  readonly sectionGroups?: ReadonlyArray<ISectionGroup> | Array<ISectionGroup>;

  // Common properties
  readonly maxDepth?: number;
}

/**
 * Section item component - wraps content and handles visibility
 */
const SectionContent: React.FC<{
  section: ISectionConfig;
  shouldLoad: boolean;
  routeParams: Record<string, any>;
  parentData: Record<string, any>;
  depth: number;
}> = ({ section, shouldLoad, routeParams, parentData, depth }) => {
  const { resolveConfigRef } = useEntityConfig();

  // Resolve entityConfigRef if provided (like OpenRouteInModal does)
  const resolvedConfig = useMemo(() => {
    if (!section.entityConfigRef) return null;
    return resolveConfigRef(section.entityConfigRef);
  }, [ section.entityConfigRef, resolveConfigRef ]);

  // Determine final page config (entityConfigRef takes precedence)
  let finalListPageConfig = section.listPageConfig;
  let finalDetailsPageConfig = section.detailsPageConfig;
  let finalFormPageConfig = section.formPageConfig;
  let finalDashboardPageConfig = section.dashboardPageConfig;

  if (resolvedConfig) {
    // Use resolved config and apply section's config as overrides
    if (section.pageType === 'list') {
      finalListPageConfig = resolvedConfig.listPageConfig || section.listPageConfig;
    } else if (section.pageType === 'details') {
      finalDetailsPageConfig = {
        ...(resolvedConfig.detailsPageConfig || {}),
        ...(section.detailsPageConfig || {})
      };
    } else if (section.pageType === 'form') {
      finalFormPageConfig = resolvedConfig.formPageConfig || section.formPageConfig;
    } else if (section.pageType === 'dashboard') {
      finalDashboardPageConfig = resolvedConfig.dashboardPageConfig || section.dashboardPageConfig;
    }
  }

  // Early return if section shouldn't load yet (lazy loading optimization)
  if (!shouldLoad) return null;

  // If this is a details page with useParentData, inject the parent record
  // This must happen after shouldLoad check to avoid unnecessary work
  if (section.pageType === 'details' && section.detailsPageConfig?.useParentData && parentData.record) {
    finalDetailsPageConfig = {
      ...finalDetailsPageConfig,
      detailResponse: parentData.record
    };
  }

  // Apply identifier mapping from entityConfigRef if provided
  // This allows mapping parent routeParams to different names for the child section
  // Example: { source: 'subscriptionId', target: 'id' } maps parent's subscriptionId to child's 'id'
  let finalRouteParams = routeParams;
  if (section.entityConfigRef?.overrideConfig?.identifierMapping) {
    const mapping = section.entityConfigRef.overrideConfig.identifierMapping;
    const mappings = Array.isArray(mapping) ? mapping : [ mapping ];

    finalRouteParams = { ...routeParams };
    mappings.forEach(({ source, target }) => {
      if (routeParams[ source ] !== undefined) {
        finalRouteParams[ target ] = routeParams[ source ];
      }
    });
  }

  const pageProps: IRenderFromPageType = {
    pageType: section.pageType,
    routeParams: finalRouteParams,
    listPageConfig: finalListPageConfig,
    detailsPageConfig: finalDetailsPageConfig,
    formPageConfig: finalFormPageConfig,
    dashboardPageConfig: finalDashboardPageConfig,
    depth // Pass depth to nested pages
  };

  return (
    <RenderFromPageType {...pageProps} />
  );
};

/**
 * Single section group renderer - handles tabs or accordion for one group of sections
 */
const SectionGroupRenderer: React.FC<{
  sections: Record<string, ISectionConfig>;
  renderMode?: 'tabs' | 'accordion';
  lazyLoad?: boolean;
  keepMounted?: boolean;
  routeParams: Record<string, any>;
  parentData: Record<string, any>;
  evaluationContext: any;
  depth: number;
  maxDepth: number;
}> = ({
  sections,
  renderMode = 'accordion',
  lazyLoad = true,
  keepMounted = false,
  routeParams,
  parentData,
  evaluationContext,
  depth,
  maxDepth
}) => {
    // Check depth limit
    if (depth > maxDepth) {
      return (
        <Alert
          message="Maximum Nesting Depth Reached"
          description={`Sections can only be nested up to ${maxDepth} levels deep to prevent infinite recursion. This section exceeds the limit (depth: ${depth}). Consider reducing nesting or configuring a higher maxDepth.`}
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          style={{ margin: '16px 0' }}
        />
      );
    }

    // Sort sections by sortOrder
    const sortedSections = useMemo(() => {
      return Object.entries(sections).sort(([ , a ], [ , b ]) => {
        const orderA = a.sortOrder ?? 999;
        const orderB = b.sortOrder ?? 999;
        return orderA - orderB;
      });
    }, [ sections ]);

    // Default to first section
    const [ activeKey, setActiveKey ] = useState<string>(sortedSections[ 0 ]?.[ 0 ] || '');
    const [ loadedSections, setLoadedSections ] = useState<Set<string>>(
      new Set([ sortedSections[ 0 ]?.[ 0 ] ])
    );

    const handleChange = useCallback((key: string | string[]) => {
      const newKey = Array.isArray(key) ? key[ key.length - 1 ] : key;
      if (newKey) {
        setActiveKey(newKey);
        if (lazyLoad) {
          setLoadedSections(prev => new Set([ ...Array.from(prev), newKey ]));
        }
      }
    }, [ lazyLoad ]);

    // Build items for Tabs/Collapse (filter out invisible sections)
    const items = useMemo(() => {
      return sortedSections
        .map(([ key, section ]) => {
          // Evaluate visibility at tab level (not inside content)
          // Use synchronous evaluator (not a hook) since we're inside useMemo
          let visible = true;
          if (section.visibility) {
            try {
              // Use provided evaluation context (includes actor, record, etc.)
              const result = universalEvaluator.evaluateSync(section.visibility, evaluationContext);
              visible = result.visible;
            } catch (error) {
              // If sync evaluation fails (requires async), default to visible
              // This shouldn't happen for simple record-based visibility checks
              console.warn('[SectionGroupRenderer] Sync evaluation failed, defaulting to visible:', error);
              visible = true;
            }
          }

          const shouldLoad = !lazyLoad || loadedSections.has(key);
          const label = evaluateTemplateValue(section.label, routeParams);
          const badge = section.badge ? evaluateTemplateValue(section.badge, routeParams) : undefined;

          if (!visible) return null;

          return {
            key,
            label: badge ? `${label} (${badge})` : label,
            children: (
              <SectionContent
                section={section}
                shouldLoad={shouldLoad}
                routeParams={routeParams}
                parentData={parentData}
                depth={depth}
              />
            )
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
    }, [ sortedSections, routeParams, lazyLoad, loadedSections, parentData, evaluationContext, depth ]);

    // Add subtle visual feedback for nested depth
    const nestedStyle: React.CSSProperties = depth > 0 ? {
      opacity: Math.max(0.85, 1 - (depth * 0.05)), // Subtle opacity decrease
      filter: depth > 1 ? `grayscale(${depth * 10}%)` : undefined // Very subtle grayscale
    } : {};

    // Render as Tabs
    if (renderMode === 'tabs') {
      const tabsProps: TabsProps = {
        items,
        activeKey,
        onChange: (key) => handleChange(key),
        destroyInactiveTabPane: !keepMounted,
        style: nestedStyle
      };

      return <Tabs {...tabsProps} />;
    }

    // Render as Accordion (Collapse)
    const collapseProps: CollapseProps = {
      items,
      defaultActiveKey: [ activeKey ],
      onChange: (keys) => handleChange(keys),
      expandIcon: ({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />,
      style: nestedStyle
    };

    return <Collapse {...collapseProps} />;
  };

/**
 * Props for SectionsRenderer component
 */
export interface ISectionsRendererProps {
  sectionsConfig: ISectionsConfig;
  routeParams: Record<string, any>;
  parentData?: Record<string, any>;
  cardStyle?: React.CSSProperties;
  depth?: number; // Current nesting depth (for recursive sections)
}

/**
 * SectionsRenderer - Renders additional sections (tabs or accordion) for any page type.
 * 
 * Provides a generic way to add multi-section UIs to list, detail, form, and create pages.
 * Sections can render any page type and have access to parent page data via routeParams.
 * 
 * Supports two formats:
 * - Single group (backward compatible): Renders one card with tabs/accordion
 * - Multiple groups: Renders multiple cards, each with its own tabs/accordion
 * 
 * @example
 * // Single group (backward compatible)
 * <SectionsRenderer
 *   sectionsConfig={{
 *     renderMode: 'tabs',
 *     sections: {
 *       players: { label: 'Players', pageType: 'list', ... }
 *     }
 *   }}
 *   routeParams={{ teamId: '123' }}
 * />
 * 
 * @example
 * // Multiple groups
 * <SectionsRenderer
 *   sectionsConfig={{
 *     sectionGroups: [
 *       {
 *         id: 'basic',
 *         label: 'Basic Info',
 *         icon: 'InfoCircleOutlined',
 *         renderMode: 'tabs',
 *         sections: { details: {...}, metadata: {...} }
 *       },
 *       {
 *         id: 'relations',
 *         label: 'Relations',
 *         renderMode: 'accordion',
 *         sections: { players: {...}, games: {...} }
 *       }
 *     ]
 *   }}
 *   routeParams={{ teamId: '123' }}
 * />
 */
export const SectionsRenderer: React.FC<ISectionsRendererProps> = ({
  sectionsConfig,
  routeParams,
  parentData = {},
  depth = 0,
  cardStyle
}) => {
  const maxDepth = sectionsConfig.maxDepth ?? 4; // Default max depth is 4

  // Get full evaluation context (includes actor, queryParams, etc.)
  const baseEvaluationContext = useEvaluationContext();

  // Memoize evaluation context with parent record to avoid recreating on every render
  const evaluationContext = useMemo(() => ({
    ...baseEvaluationContext,
    record: parentData.record
  }), [ baseEvaluationContext, parentData.record ]);

  // Check if using multiple groups format
  const hasSectionGroups = !!sectionsConfig.sectionGroups;

  // CASE 1: Multiple Groups (New Format)
  if (hasSectionGroups) {
    // Sort groups by sortOrder
    const sortedGroups = useMemo(() => {
      return [ ...(sectionsConfig.sectionGroups || []) ].sort((a, b) => {
        const orderA = a.sortOrder ?? 999;
        const orderB = b.sortOrder ?? 999;
        return orderA - orderB;
      });
    }, [ sectionsConfig.sectionGroups ]);

    // Filter groups by visibility
    const visibleGroups = useMemo(() => {
      return sortedGroups.filter(group => {
        if (!group.visibility) return true;

        try {
          const result = universalEvaluator.evaluateSync(group.visibility, evaluationContext);
          return result.visible;
        } catch (error) {
          console.warn('[SectionsRenderer] Group visibility evaluation failed, defaulting to visible:', error);
          return true;
        }
      });
    }, [ sortedGroups, evaluationContext ]);

    // Render each group as a card
    return (
      <>
        {visibleGroups.map(group => {
          const groupLabel = group.label ? evaluateTemplateValue(group.label, routeParams) : undefined;

          return (
              <Card
                key={group.id}
                title={groupLabel}
                style={{ marginTop: 16, ...cardStyle }}
                size="small"
              >
                <SectionGroupRenderer
                  sections={group.sections}
                  renderMode={group.renderMode}
                  lazyLoad={group.lazyLoad}
                  keepMounted={group.keepMounted}
                  routeParams={routeParams}
                  parentData={parentData}
                  evaluationContext={evaluationContext}
                  depth={depth}
                  maxDepth={maxDepth}
                />
              </Card>
          );
        })}
      </>
    );
  }

  // CASE 2: Single Group (Backward Compatible)
  if (!sectionsConfig.sections || Object.keys(sectionsConfig.sections).length === 0) {
    return null; // No sections to render
  }

  return (
    <SectionGroupRenderer
      sections={sectionsConfig.sections}
      renderMode={sectionsConfig.renderMode}
      lazyLoad={sectionsConfig.lazyLoad}
      keepMounted={sectionsConfig.keepMounted}
      routeParams={routeParams}
      parentData={parentData}
      evaluationContext={evaluationContext}
      depth={depth}
      maxDepth={maxDepth}
    />
  );
};

