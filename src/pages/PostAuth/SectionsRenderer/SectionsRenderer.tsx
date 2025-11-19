import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Tabs, Collapse, Alert, theme, Badge, ConfigProvider, Skeleton } from 'antd';
import type { TabsProps, CollapseProps, CardProps } from 'antd';
import { CaretRightOutlined, WarningOutlined } from '@ant-design/icons';
import * as AntIcons from '@ant-design/icons';
import { useLocation } from 'react-router-dom';

const { useToken } = theme;
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
import { CollapsibleSectionCard } from './CollapsibleSectionCard';
import { substituteUrlParams, useApi } from '../../../core';

/**
 * Badge configuration for sections.
 * Supports:
 * - Simple templates with JSONPath: '{$.lineItems.length()} items'
 * - Advanced config: { template: '{$.items.length()}', showZero: true }
 * - API-based counts: { apiEndpoint: '/admin/order/count', responseKey: 'count' }
 */
export type SectionBadgeConfig =
  | Template  // Template with JSONPath support: '{$.lineItems.length()} items', '{$.items[?(@.status=="active")].length()}'
  | {
    /** Template for badge text with JSONPath support */
    template: Template;
    /** Show badge even if evaluated to 0. Default: false */
    showZero?: boolean;
  }
  | {
    /** API endpoint to fetch count/value from (e.g., '/admin/order/count?userId.eq=:userId') */
    apiEndpoint: string;
    /** Key in response to extract value from. Supports JSONPath. Default: 'count' */
    responseKey?: string;
    /** Optional template for formatting the badge text (e.g., '{count} orders') */
    template?: string;
    /** Show badge even if count is 0. Default: false */
    showZero?: boolean;
  };

/**
 * Section configuration interface
 * Defines a single section that can render any page type (list, details, form, dashboard)
 */
export interface ISectionConfig {
  readonly label: Template;
  readonly icon?: string;
  readonly badge?: SectionBadgeConfig | ReadonlyArray<SectionBadgeConfig> | Array<SectionBadgeConfig>;
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
  readonly defaultCollapsed?: boolean;
  readonly collapsedSummary?: Template;
  readonly allowCollapse?: boolean;
  readonly allowMaximize?: boolean;
  readonly autoCollapse?: boolean;
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
  readonly rememberState?: boolean;
  readonly scrollSpyHighlight?: boolean;
}

/**
 * Hook to handle badge value extraction
 * Supports Template (with JSONPath) and API fetching
 */
function useSectionBadge(
  badgeConfig: SectionBadgeConfig | undefined,
  parentData: Record<string, any>,
  routeParams: Record<string, any>
): { badgeText: string | number | undefined; loading: boolean; showZero: boolean } {
  const { callApiMethod } = useApi();
  const [ apiFetchedValue, setApiFetchedValue ] = useState<number | undefined>(undefined);
  const [ loading, setLoading ] = useState(false);

  useEffect(() => {
    if (!badgeConfig || typeof badgeConfig === 'string' || (typeof badgeConfig === 'object' && 'composite' in badgeConfig)) {
      // Template type - no API fetch needed
      return;
    }

    if ('apiEndpoint' in badgeConfig && badgeConfig.apiEndpoint) {
      // API fetch
      let cancelled = false;
      setLoading(true);

      const fetchCount = async () => {
        try {
          const url = substituteUrlParams(badgeConfig.apiEndpoint, routeParams);
          const response = await callApiMethod<any>({ apiUrl: url, apiMethod: 'GET' });
          if (cancelled) return;

          const responseData = response.data as Record<string, any>;
          const responseKey = badgeConfig.responseKey || 'count';

          // Use evaluateTemplateValue to handle JSONPath in responseKey
          const countValue = evaluateTemplateValue(`{${responseKey}}`, responseData);
          const numValue = typeof countValue === 'string' ? parseFloat(countValue) : countValue;

          setApiFetchedValue(typeof numValue === 'number' && !isNaN(numValue) ? numValue : undefined);
        } catch (error) {
          console.warn('[useSectionBadge] API fetch failed:', error);
          if (!cancelled) setApiFetchedValue(undefined);
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      fetchCount();
      return () => { cancelled = true; };
    }
  }, [ badgeConfig, routeParams, callApiMethod ]);

  const result = useMemo(() => {
    if (!badgeConfig) return { badgeText: undefined, showZero: false };

    // Flatten parentData if it has a 'record' property (from DetailPage)
    // This allows templates to access fields directly: $.lineItems instead of $.record.lineItems
    const flattenedParentData = parentData.record ? parentData.record : parentData;
    const context = { ...routeParams, ...flattenedParentData };

    // 1. Simple Template (string or complex template)
    if (typeof badgeConfig === 'string' || (typeof badgeConfig === 'object' && 'composite' in badgeConfig)) {
      const text = evaluateTemplateValue(badgeConfig as Template, context);
      // Don't show empty badges, but show "0" by default
      return {
        badgeText: text && text.trim() !== '' ? text : undefined,
        showZero: true  // Default to showing zero for simple templates
      };
    }

    // 2. Template config with showZero option
    if ('template' in badgeConfig && badgeConfig.template) {
      const text = evaluateTemplateValue(badgeConfig.template, context);
      return {
        badgeText: text && text.trim() !== '' ? text : undefined,
        showZero: badgeConfig.showZero ?? false
      };
    }

    // 3. API fetched value
    if ('apiEndpoint' in badgeConfig && badgeConfig.apiEndpoint) {
      if (loading) return { badgeText: undefined, showZero: false };
      if (apiFetchedValue === undefined || (apiFetchedValue === 0 && !badgeConfig.showZero)) {
        return { badgeText: undefined, showZero: badgeConfig.showZero ?? false };
      }

      // Format with template if provided
      let text: string | number;
      if (badgeConfig.template) {
        text = evaluateTemplateValue(badgeConfig.template, { count: apiFetchedValue, ...context });
      } else {
        text = apiFetchedValue;
      }

      return {
        badgeText: text,
        showZero: badgeConfig.showZero ?? false
      };
    }

    return { badgeText: undefined, showZero: false };
  }, [ badgeConfig, parentData, routeParams, apiFetchedValue, loading ]);

  return { ...result, loading };
}

/**
 * Section item component - wraps content and handles visibility
 */
const SectionContent: React.FC<{
  section: ISectionConfig;
  sectionKey: string;
  shouldLoad: boolean;
  routeParams: Record<string, any>;
  parentData: Record<string, any>;
  depth: number;
  isParentLoading: boolean;
  children?: React.ReactNode;
}> = ({ section, sectionKey, shouldLoad, routeParams, parentData, depth, isParentLoading, children }) => {
  // Special case: Render children for __main__ section
  if (sectionKey === '__main__' && children) {
    return <>{children}</>;
  }

  // CRITICAL: If parent record is still loading, show skeleton
  // This prevents sections from making API calls with incomplete/missing filter parameters
  if (isParentLoading) {
    return (
      <div style={{ padding: '24px' }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    );
  }

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
    depth: depth + 1 // Increment depth for nested entity pages to prevent infinite section nesting
  };

  return (
    <RenderFromPageType {...pageProps} />
  );
};

/**
 * Component to render section label with icon and badge(s)
 * Extracted as a component so it can use the useSectionBadge hook
 */
const SectionLabelWithBadge: React.FC<{
  section: ISectionConfig;
  routeParams: Record<string, any>;
  parentData: Record<string, any>;
}> = ({ section, routeParams, parentData }) => {
  const label = evaluateTemplateValue(section.label, routeParams);

  // Render icon if provided
  let iconNode = null;
  if (section.icon) {
    if (typeof section.icon === 'string') {
      const IconComponent = (AntIcons as any)[ section.icon ];
      if (IconComponent) {
        iconNode = React.createElement(IconComponent);
      }
    } else if (React.isValidElement(section.icon)) {
      iconNode = section.icon;
    }
  }

  // Handle single or multiple badges
  const badgeConfigs: SectionBadgeConfig[] = section.badge
    ? Array.isArray(section.badge)
      ? (section.badge as SectionBadgeConfig[])
      : [ section.badge as SectionBadgeConfig ]
    : [];

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {iconNode}
      <span>{label}</span>
      {badgeConfigs.map((badgeConfig, index) => (
        <SingleBadge
          key={index}
          badgeConfig={badgeConfig}
          parentData={parentData}
          routeParams={routeParams}
        />
      ))}
    </span>
  );
};

/**
 * Renders a single badge using the useSectionBadge hook
 */
const SingleBadge: React.FC<{
  badgeConfig: SectionBadgeConfig;
  parentData: Record<string, any>;
  routeParams: Record<string, any>;
}> = ({ badgeConfig, parentData, routeParams }) => {
  const { badgeText, showZero } = useSectionBadge(badgeConfig, parentData, routeParams);

  if (badgeText === undefined) return null;

  return <Badge count={badgeText} showZero={showZero} />;
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
  isParentLoading: boolean;
  children?: React.ReactNode;
}> = ({
  sections,
  renderMode = 'accordion',
  lazyLoad = true,
  keepMounted = false,
  routeParams,
  parentData,
  evaluationContext,
  depth,
  maxDepth,
  isParentLoading,
  children
}) => {
    const { token } = useToken();

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

    // Default to first section (for tabs) or empty (for accordions)
    const defaultActiveKey = renderMode === 'tabs' ? (sortedSections[ 0 ]?.[ 0 ] || '') : '';
    const [ activeKey, setActiveKey ] = useState<string>(defaultActiveKey);

    // Initialize loaded sections based on render mode, count, and lazyLoad setting
    // If lazyLoad is false: load ALL sections immediately
    // For single section: always load (rendered directly, no wrapper)
    // For tabs: load first section immediately (tab is visible by default)
    // For accordion: start empty (nothing is expanded by default)
    const initialLoadedSections = useMemo(() => {
      // If lazy loading is disabled, load all sections immediately
      if (!lazyLoad) {
        return new Set(sortedSections.map(([ key ]) => key));
      }

      if (sortedSections.length === 1) {
        // Single section is rendered directly without tabs/accordion wrapper
        const firstKey = sortedSections[ 0 ]?.[ 0 ];
        return new Set(firstKey ? [ firstKey ] : []);
      }
      if (renderMode === 'tabs' && sortedSections.length > 0) {
        const firstKey = sortedSections[ 0 ]?.[ 0 ];
        return new Set(firstKey ? [ firstKey ] : []);
      }
      return new Set<string>();
    }, [ renderMode, sortedSections, lazyLoad ]);

    const [ loadedSections, setLoadedSections ] = useState<Set<string>>(initialLoadedSections);

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

          if (!visible) return null;

          // Build label with icon and badge using the dedicated component
          const labelContent = (
            <SectionLabelWithBadge
              section={section}
              routeParams={routeParams}
              parentData={parentData}
            />
          );

          return {
            key,
            label: labelContent,
            children: (
              <SectionContent
                section={section}
                sectionKey={key}
                shouldLoad={shouldLoad}
                routeParams={routeParams}
                parentData={parentData}
                depth={depth}
                isParentLoading={isParentLoading}
                children={children}
              />
            )
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
    }, [ sortedSections, routeParams, lazyLoad, loadedSections, parentData, evaluationContext, depth, isParentLoading, children ]);

    // Add subtle visual feedback for nested depth
    const nestedStyle: React.CSSProperties = depth > 0 ? {
      opacity: Math.max(0.85, 1 - (depth * 0.05)),
      filter: depth > 1 ? `grayscale(${depth * 10}%)` : undefined,
    } : {};

    // UX Enhancement: If only one section, skip Tabs/Collapse wrapper and render content directly
    // But preserve the section's label, icon, and badge as a simple header
    if (items.length === 1) {
      const singleItem = items[ 0 ];
      const singleSection = sortedSections[ 0 ]?.[ 1 ];

      // Check if we need to show a header (has icon, badge, or label different from group label)
      const hasIconOrBadge = singleSection?.icon || singleSection?.badge;

      return (
        <>
          {hasIconOrBadge && (
            <div style={{
              padding: '8px 12px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '14px',
              fontWeight: 500,
            }}>
              {singleItem.label}
            </div>
          )}
          {singleItem.children}
        </>
      );
    }

    // Render as Tabs - uses Ant Design's built-in motion
    if (renderMode === 'tabs') {
      const tabsProps: TabsProps = {
        items,
        activeKey,
        onChange: (key) => handleChange(key),
        destroyOnHidden: !keepMounted,
        animated: true, // Let Ant Design handle animations
        style: nestedStyle
      };

      return (
        <ConfigProvider
          theme={{
            token: {
              motionDurationSlow: '0.4s',
              motionDurationMid: '0.3s',
            },
          }}
        >
          <Tabs {...tabsProps} />
        </ConfigProvider>
      );
    }

    // Render as Accordion (Collapse) - uses Ant Design's built-in motion
    // Don't set defaultActiveKey - let user expand items manually (lazy loading)
    const collapseProps: CollapseProps = {
      items,
      onChange: (keys) => handleChange(keys),
      expandIcon: ({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />,
      expandIconPosition: 'end',
      style: nestedStyle,
    };

    return (
      <ConfigProvider
        theme={{
          token: {
            motionDurationSlow: '0.4s',
            motionDurationMid: '0.3s',
          },
        }}
      >
        <Collapse {...collapseProps} />
      </ConfigProvider>
    );
  };

/**
 * Helper: Injects main content as a synthetic section group
 * Keeps SectionsRenderer component cleaner by extracting this logic
 */
function injectMainContentGroup(
  sectionsConfig: ISectionsConfig,
  mainSectionConfig?: ISectionsRendererProps[ 'mainSectionConfig' ]
): ISectionsConfig {
  const mainSection: ISectionConfig = {
    label: mainSectionConfig?.label,
    icon: mainSectionConfig?.icon,
    sortOrder: mainSectionConfig?.sortOrder ?? 0,
    badge: mainSectionConfig?.badge,
    pageType: 'details',
    detailsPageConfig: {
      useParentData: true,
      propertiesConfig: [] // Not used, we render children directly
    }
  };

  // Create a dedicated synthetic group for main content
  // This group: 
  // 1) Always renders first (sortOrder: -1)
  // 2) Can be collapsed/maximized interactively
  // 3) Always starts expanded on page load
  // 4) State is NOT saved to localStorage (always resets on reload)
  // 5) Always loads immediately (lazyLoad: false)
  const mainContentGroup: ISectionGroup = {
    id: '__main_content_group__',
    label: 'Overview',
    icon: 'FileTextOutlined',
    sortOrder: -1,
    renderMode: 'tabs',
    sections: {
      __main__: mainSection
    },
    lazyLoad: false,
    keepMounted: true,
    defaultCollapsed: false,
    allowCollapse: true,
    allowMaximize: true,
  };

  // If sectionsConfig has groups, prepend main group
  if (sectionsConfig.sectionGroups && sectionsConfig.sectionGroups.length > 0) {
    return {
      ...sectionsConfig,
      sectionGroups: [ mainContentGroup, ...sectionsConfig.sectionGroups ]
    };
  }
  // If sectionsConfig has sections (single group mode), convert to multi-group
  else if (sectionsConfig.sections && Object.keys(sectionsConfig.sections).length > 0) {
    const existingGroup: ISectionGroup = {
      id: '__existing_sections__',
      label: '',
      sortOrder: 0,
      renderMode: sectionsConfig.renderMode,
      sections: sectionsConfig.sections,
      lazyLoad: sectionsConfig.lazyLoad,
      keepMounted: sectionsConfig.keepMounted,
      defaultCollapsed: false,
      allowCollapse: true,
      allowMaximize: true,
    };

    return {
      ...sectionsConfig,
      sectionGroups: [ mainContentGroup, existingGroup ],
      sections: undefined
    };
  }
  // Edge case: sectionsConfig exists but is empty
  else {
    return {
      ...sectionsConfig,
      sectionGroups: [ mainContentGroup ]
    };
  }
}

/**
 * Props for SectionsRenderer component
 */
export interface ISectionsRendererProps {
  sectionsConfig?: ISectionsConfig;
  routeParams: Record<string, any>;
  parentData?: Record<string, any>;
  cardStyle?: React.CSSProperties;
  depth?: number; // Current nesting depth (for recursive sections)
  /** 
   * Indicates if parent record is still loading. 
   * Sections will show skeleton and won't load until parent data is ready.
   */
  isParentLoading?: boolean;
  /** 
   * Main page content (e.g., Details component) to render as first section.
   * If provided with sectionsConfig, main content becomes integrated into the sections UI.
   */
  children?: React.ReactNode;
  /**
   * Configuration for how main content (children) appears in sections UI.
   * Only used when both children and sectionsConfig are provided.
   */
  mainSectionConfig?: {
    /** Label for main section. Default: 'Overview' */
    label?: Template;
    /** Icon for main section. Default: 'FileTextOutlined' */
    icon?: string;
    /** Sort order for main section. Default: 0 (appears first) */
    sortOrder?: number;
    /** Badge for main section */
    badge?: SectionBadgeConfig | ReadonlyArray<SectionBadgeConfig> | Array<SectionBadgeConfig>;
  };
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

/**
 * Helper component: Pure spatial hierarchy for nested content
 * Clean and elegant - just indentation and subtle background progression
 */
const DepthWrapper: React.FC<{ depth: number; token: any; children: React.ReactNode }> = React.memo(({ depth, token, children }) => {
  if (depth === 0) return <>{children}</>;

  return (
    <div style={{
      padding: 8,
      paddingLeft: 16,
      marginLeft: 8,
      marginTop: 8,
      borderLeft: `1px solid ${token.colorPrimary}`,
      borderRadius: 8,
    }}>
      {children}
    </div>
  );
});

/**
 * Helper component: Renders main content at nested depths
 */
const MainContentAtDepth: React.FC<{ depth: number; children?: React.ReactNode }> = React.memo(({ depth, children }) => {
  if (depth === 0 || !children) return null;
  return <div style={{ marginBottom: 16 }}>{children}</div>;
});

export const SectionsRenderer: React.FC<ISectionsRendererProps> = ({
  sectionsConfig,
  routeParams,
  parentData = {},
  depth = 0,
  cardStyle,
  isParentLoading = false,
  children,
  mainSectionConfig
}) => {
  // Case 1: Only children (no sections) - render children directly
  if (children && !sectionsConfig) {
    return <>{children}</>;
  }

  // Case 2: No children and no sectionsConfig - return null
  if (!sectionsConfig) {
    return null;
  }

  const maxDepth = sectionsConfig.maxDepth ?? 4;
  const rememberState = sectionsConfig.rememberState ?? true;
  const scrollSpyHighlight = sectionsConfig.scrollSpyHighlight ?? true;

  const location = useLocation();
  const { token } = useToken();
  const baseEvaluationContext = useEvaluationContext();
  const evaluationContext = useMemo(() => ({
    ...baseEvaluationContext,
    record: parentData.record
  }), [ baseEvaluationContext, parentData.record ]);

  // Inject main content as a synthetic section group at ALL depths if children exist
  // This ensures nested entities show their main content (Details component)
  // Allow sections up to maxDepth - 1, then clear to show only main content
  const enhancedSectionsConfig = useMemo<ISectionsConfig>(() => {
    const effectiveMaxDepth = sectionsConfig?.maxDepth ?? 4;

    // If we've reached the max nesting depth, clear all section groups
    // This prevents infinite recursion while allowing controlled multi-level nesting
    if (depth >= effectiveMaxDepth - 1 && sectionsConfig) {
      return {
        ...sectionsConfig,
        sectionGroups: undefined,
        sections: undefined
      };
    }

    // Inject main content if children are provided (at any depth)
    // At depth 0: creates "Overview" section group with no header
    // At depth > 0: also injects main content so nested entities show their Details
    if (!children) return sectionsConfig;

    // Only inject main content group at depth 0 (top level)
    // At deeper levels, the children will be rendered separately
    if (depth === 0) {
      return injectMainContentGroup(sectionsConfig, mainSectionConfig);
    }

    // At depth > 0, return config as-is, children will be rendered inline with depth indicator
    return sectionsConfig;
  }, [ children, sectionsConfig, mainSectionConfig, depth ]);

  const hasSectionGroups = !!enhancedSectionsConfig.sectionGroups;

  // Sort and filter visible groups
  const visibleGroups = useMemo(() => {
    if (!hasSectionGroups) return [];

    const sorted = [ ...(enhancedSectionsConfig.sectionGroups || []) ].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

    return sorted.filter(group => {
      if (!group.visibility) return true;
      try {
        return universalEvaluator.evaluateSync(group.visibility, evaluationContext).visible;
      } catch {
        return true;
      }
    });
  }, [ hasSectionGroups, enhancedSectionsConfig.sectionGroups, evaluationContext ]);

  // Stable storage key: route + record ID + depth
  const storageKey = useMemo(() => {
    const routePath = location.pathname.replace(/\//g, '_');
    const recordId = routeParams.id || 'noId';
    return `sections_${routePath}_${recordId}_d-${depth}`;
  }, [ location.pathname, routeParams.id, depth ]);

  // Collapsed state with localStorage
  const [ collapsedCards, setCollapsedCards ] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};

    // Load from localStorage if rememberState is enabled (only at depth 0)
    if (rememberState && depth === 0) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const savedState = JSON.parse(stored);
          // Copy saved state, but ensure main content group is always expanded
          Object.keys(savedState).forEach(key => {
            if (key !== '__main_content_group__') {
              initialState[ key ] = savedState[ key ];
            }
          });
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Initialize defaults for each group
    visibleGroups.forEach((group, index) => {
      // Main content group always starts expanded, never saved
      if (group.id === '__main_content_group__') {
        initialState[ group.id ] = false;
      }
      // Force collapse all cards if depth >= 1 (all nested content should be compact)
      else if (depth >= 1) {
        initialState[ group.id ] = true;
      }
      // Other groups use saved state or default (only at depth 0)
      else if (initialState[ group.id ] === undefined) {
        const defaultCollapsed = group.defaultCollapsed ?? (index > 0);
        initialState[ group.id ] = defaultCollapsed;
      }
    });

    return initialState;
  });

  // Save to localStorage whenever collapsedCards changes
  // Exclude main content group from being saved
  // Only save at depth 0 (all nested sections always start collapsed)
  useEffect(() => {
    if (rememberState && depth === 0) {
      const stateToSave = { ...collapsedCards };
      delete stateToSave[ '__main_content_group__' ]; // Never save main content group state
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    }
  }, [ collapsedCards, rememberState, storageKey, depth ]);

  // Scroll spy - tracks which section card is most visible
  const [ highlightedCard, setHighlightedCard ] = useState<string | null>(null);
  const intersectionRatiosRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!scrollSpyHighlight || !hasSectionGroups || visibleGroups.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Update intersection ratios for all observed cards
        entries.forEach(entry => {
          if (entry.target.id) {
            const cardId = entry.target.id.replace('section-card-', '');
            if (entry.isIntersecting) {
              intersectionRatiosRef.current.set(cardId, entry.intersectionRatio);
            } else {
              intersectionRatiosRef.current.delete(cardId);
            }
          }
        });

        // Find the card with highest intersection ratio (most visible)
        let maxRatio = 0;
        let mostVisibleCard: string | null = null;

        intersectionRatiosRef.current.forEach((ratio, cardId) => {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            mostVisibleCard = cardId;
          }
        });

        // Only update if we have a clear winner (at least 10% visible)
        if (mostVisibleCard && maxRatio > 0.1) {
          setHighlightedCard(mostVisibleCard);
        } else if (intersectionRatiosRef.current.size === 0) {
          // No cards visible - clear highlight
          setHighlightedCard(null);
        }
      },
      {
        threshold: [ 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0 ], // Multiple thresholds for better granularity
        rootMargin: '-80px 0px' // Account for fixed headers
      }
    );

    // Observe all cards
    visibleGroups.forEach(group => {
      const cardElement = document.getElementById(`section-card-${group.id}`);
      if (cardElement) {
        observer.observe(cardElement);
      }
    });

    return () => {
      observer.disconnect();
      intersectionRatiosRef.current.clear();
    };
  }, [ scrollSpyHighlight, hasSectionGroups, visibleGroups ]);

  // Handle collapsed change with auto-collapse logic
  const handleCollapsedChange = useCallback((groupId: string, group: ISectionGroup) => {
    return (collapsed: boolean) => {
      setCollapsedCards(prev => {
        const next = { ...prev, [ groupId ]: collapsed };

        // Auto-collapse: when opening an auto-collapse group, close other auto-collapse groups
        if (!collapsed && group.autoCollapse) {
          visibleGroups.forEach(g => {
            if (g.id !== groupId && g.autoCollapse) {
              next[ g.id ] = true;
            }
          });
        }

        return next;
      });
    };
  }, [ visibleGroups ]);

  // ========================================
  // ========================================
  // CASE 1: Multiple Groups
  // ========================================
  if (hasSectionGroups) {
    const content = (
      <>
        <MainContentAtDepth depth={depth}>{children}</MainContentAtDepth>
        {visibleGroups.map((group, index) => {
          const groupLabel = group.label ? evaluateTemplateValue(group.label, routeParams) : undefined;
          const summary = group.collapsedSummary ? evaluateTemplateValue(group.collapsedSummary, routeParams) : undefined;
          const defaultCollapsed = group.defaultCollapsed ?? (index > 0);
          const isCollapsed = collapsedCards[ group.id ] ?? defaultCollapsed;

          return (
            <CollapsibleSectionCard
              key={group.id}
              id={group.id}
              title={groupLabel}
              icon={group.icon}
              summary={summary}
              collapsed={isCollapsed}
              allowCollapse={group.allowCollapse ?? true}
              allowMaximize={group.allowMaximize ?? true}
              isHighlighted={scrollSpyHighlight && highlightedCard === group.id}
              onCollapsedChange={handleCollapsedChange(group.id, group)}
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
                isParentLoading={isParentLoading}
                children={children}
              />
            </CollapsibleSectionCard>
          );
        })}
      </>
    );

    return <DepthWrapper depth={depth} token={token}>{content}</DepthWrapper>;
  }

  // ========================================
  // CASE 2: No Sections (Just Children)
  // ========================================
  if (!enhancedSectionsConfig.sections || Object.keys(enhancedSectionsConfig.sections).length === 0) {
    // If we have children but no sections (depth > 0 with sections cleared), render children directly
    if (children) {
      return <DepthWrapper depth={depth} token={token}>{children}</DepthWrapper>;
    }
    return null;
  }

  // ========================================
  // CASE 3: Single Section Group
  // ========================================
  const content = (
    <>
      <MainContentAtDepth depth={depth}>{children}</MainContentAtDepth>
      <SectionGroupRenderer
        sections={enhancedSectionsConfig.sections}
        renderMode={enhancedSectionsConfig.renderMode}
        lazyLoad={enhancedSectionsConfig.lazyLoad}
        keepMounted={enhancedSectionsConfig.keepMounted}
        routeParams={routeParams}
        parentData={parentData}
        evaluationContext={evaluationContext}
        depth={depth}
        maxDepth={maxDepth}
        isParentLoading={isParentLoading}
        children={children}
      />
    </>
  );

  return <DepthWrapper depth={depth} token={token}>{content}</DepthWrapper>;
};

