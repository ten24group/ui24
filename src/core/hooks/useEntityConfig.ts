import { useUi24Config } from '../context/UI24Context';
import type { IApiConfig, IDualApiConfig } from '../context';
import { IFilterSegment, IFilterSegmentGroup } from '../../table/type';
import type { ConditionalValue } from '../types/evaluation';

/**
 * Column configuration for entity pages.
 * Must match IEntityPageColumnConfig from @ten24group/fw24
 */
export interface IEntityPageColumnConfig {
  numColumns?: number;
  columns: Array<{ sortOrder: number; fields: string[] }>;
}

/**
 * Union type for all API configuration formats.
 * Matches the backend IEntityConfigReference.overrideConfig.apiConfig.
 */
export type ApiConfigOverride = IApiConfig | IDualApiConfig | (IApiConfig & { defaultSort?: { field: string; order: 'asc' | 'desc' } });

/**
 * Entity Configuration Reference (from fw24)
 * This type must match IEntityConfigReference in @ten24group/fw24 EXACTLY
 */
export interface IEntityConfigReference {
  /** Entity name (e.g., 'team', 'game', 'user') */
  entityName: string;

  /** Which page config to reference */
  pageType: 'view' | 'create' | 'edit' | 'list';

  /** Optional overrides to apply to the referenced config */
  overrideConfig?: {
    /** Override page title */
    pageTitle?: string;

    /** Override columns configuration (for view pages) */
    columnsConfig?: IEntityPageColumnConfig;

    /** Override breadcrumbs */
    breadcrumbs?: Array<{ label: string; url?: string }>;

    /** Override form success redirect (for create pages). Supports ConditionalValue. */
    submitSuccessRedirect?: string | ConditionalValue<string>;

    /** Override form buttons (for create pages) */
    formButtons?: Array<{ text: string; action: string; url?: string }>;

    /** Add default filters (for list pages) */
    defaultFilters?: Record<string, any>;

    /**
     * Override filter segments completely (for list pages).
     * When provided, replaces all segments from base config.
     * Set to empty array [] to disable segments entirely.
     * 
     * @example
     * // Disable segments (useful in modal/section contexts)
     * segments: []
     * 
     * @example
     * // Replace with custom segments
     * segments: [
     *   { id: 'active', label: 'Active', filters: { status: { eq: 'active' } } },
     *   { id: 'inactive', label: 'Inactive', filters: { status: { eq: 'inactive' } } }
     * ]
     */
    segments?: ReadonlyArray<IFilterSegment | IFilterSegmentGroup> | Array<IFilterSegment | IFilterSegmentGroup>;

    /**
     * Hide specific segments by ID (for list pages).
     * Keeps all other segments from base config.
     * 
     * @example
     * hideSegments: ['root-only', 'child-only']
     */
    hideSegments?: ReadonlyArray<string> | Array<string>;

    /**
     * Show only these segments by ID (for list pages).
     * Mutually exclusive with hideSegments.
     * 
     * @example
     * showOnlySegments: ['all-levels', 'errors']
     */
    showOnlySegments?: ReadonlyArray<string> | Array<string>;

    /**
     * Add additional segments to base config (for list pages).
     * Merged with base segments using ID-based override logic.
     * 
     * @example
     * additionalSegments: [
     *   { id: 'archived', label: 'Archived', filters: { archived: { eq: true } } }
     * ]
     */
    additionalSegments?: ReadonlyArray<IFilterSegment | IFilterSegmentGroup> | Array<IFilterSegment | IFilterSegmentGroup>;

    /** Hide specific fields from rendering */
    hideFields?: string[];

    /** Show only specific fields (mutually exclusive with hideFields) */
    showOnlyFields?: string[];

    /** 
     * Override API configuration for fetching data.
     * Supports multiple formats for different page types and use cases.
     */
    apiConfig?: ApiConfigOverride;

    /** Map parent route params to different names for the child section */
    identifierMapping?: { source: string; target: string } | Array<{ source: string; target: string }>;
  };
}

// Re-export from centralized location
export { isEntityConfigReference } from '../types/pageConfig';

function isDualApiConfig(config: unknown): config is IDualApiConfig {
  return !!config && typeof config === 'object' && 'search' in config && 'database' in config;
}

function isSingleApiConfig(config: unknown): config is IApiConfig {
  return !!config && typeof config === 'object' && 'apiMethod' in config && 'apiUrl' in config;
}

/**
 * Merges segments using ID-based override logic (same pattern as buttons/actions).
 * Custom segments with matching IDs override defaults, new segments are appended.
 */
function mergeSegments<T extends { id: string }>(
  defaults: Array<T>,
  customs: ReadonlyArray<T> | Array<T> = []
): Array<T> {
  const customsArray = [ ...customs ];
  const customMap = new Map(customsArray.map(c => [ c.id, c ]));

  // Start with defaults, replace if custom has same id
  const merged = defaults.map(defaultSeg =>
    customMap.has(defaultSeg.id) ? customMap.get(defaultSeg.id)! : defaultSeg
  );

  // Add custom segments that don't override defaults
  customsArray.forEach(customSeg => {
    if (!defaults.some(d => d.id === customSeg.id)) {
      merged.push(customSeg);
    }
  });

  return merged;
}

/**
 * Gets all segment IDs from a mixed array of segments and segment groups
 */
function getAllSegmentIds(segments: Array<IFilterSegment | IFilterSegmentGroup>): string[] {
  const ids: string[] = [];
  segments.forEach(item => {
    if ('segments' in item) {
      // It's a group - add the group id and all segment ids within it
      ids.push(item.id);
      item.segments.forEach(seg => ids.push(seg.id));
    } else {
      // It's a flat segment
      ids.push(item.id);
    }
  });
  return ids;
}

/**
 * Filters segments by ID (supports both flat segments and groups)
 */
function filterSegmentsByIds(
  segments: Array<IFilterSegment | IFilterSegmentGroup>,
  idsToKeep: Set<string>
): Array<IFilterSegment | IFilterSegmentGroup> {
  return segments
    .map(item => {
      if ('segments' in item) {
        // It's a group - check if the group itself should be kept first
        if (!idsToKeep.has(item.id)) return null; // Remove entire group if group id not in idsToKeep
        // Then filter segments within it
        const filteredSegments = item.segments.filter(seg => idsToKeep.has(seg.id));
        if (filteredSegments.length === 0) return null; // Remove empty groups
        return { ...item, segments: filteredSegments };
      } else {
        // It's a flat segment
        return idsToKeep.has(item.id) ? item : null;
      }
    })
    .filter((item): item is IFilterSegment | IFilterSegmentGroup => item !== null);
}

/**
 * Hook to resolve entity config references and apply overrides
 * 
 * This hook dramatically reduces JSON payload size by referencing
 * existing entity configurations instead of embedding full configs.
 * 
 * Usage:
 * ```tsx
 * const { resolveConfigRef } = useEntityConfig();
 * const config = resolveConfigRef({
 *   entityName: 'team',
 *   pageType: 'view',
 *   overrideConfig: { pageTitle: 'Team Details' }
 * });
 * ```
 */
export const useEntityConfig = () => {
  const { getPageConfig } = useUi24Config();

  /**
   * Resolve entity config reference and apply overrides
   * @param configRef - Entity config reference with optional overrides
   * @returns Resolved and merged configuration, or null if not found
   */
  const resolveConfigRef = (configRef: IEntityConfigReference): any | null => {
    const { entityName, pageType, overrideConfig } = configRef;

    // Generate config key: "view-team", "create-team", "list-team"
    const configKey = `${pageType}-${entityName.toLowerCase()}`;

    // Get base config from entity registry
    const baseConfig = getPageConfig(configKey);

    if (!baseConfig) {
      console.warn(`[useEntityConfig] Config not found for key: ${configKey}`);
      return null;
    }

    // If no overrides, return base config as-is
    if (!overrideConfig || Object.keys(overrideConfig).length === 0) {
      return baseConfig;
    }

    // Apply overrides based on page type
    return mergeConfigOverrides(baseConfig, overrideConfig, pageType);
  };

  /**
   * Merge override config into base config
   * Handles page-type-specific merging logic
   */
  const mergeConfigOverrides = (baseConfig: any, overrides: any, pageType: string): any => {
    // Deep clone base config to prevent mutation
    const merged = JSON.parse(JSON.stringify(baseConfig));

    // Top-level overrides (common to all page types)
    if (overrides.pageTitle !== undefined) {
      merged.pageTitle = overrides.pageTitle;
    }
    if (overrides.breadcrumbs !== undefined) {
      merged.breadcrumbs = overrides.breadcrumbs;
    }

    // Page-type-specific overrides
    if (pageType === 'view') {
      if (!merged.detailsPageConfig) {
        console.warn(
          `[useEntityConfig] Expected detailsPageConfig for view page, but not found in config`
        );
        return merged;
      }

      // View page overrides
      if (overrides.columnsConfig !== undefined) {
        merged.detailsPageConfig.columnsConfig = overrides.columnsConfig;
      }

      // API config override for view pages
      if (overrides.apiConfig !== undefined && merged.detailsPageConfig.detailApiConfig) {
        merged.detailsPageConfig.detailApiConfig = {
          ...merged.detailsPageConfig.detailApiConfig,
          ...overrides.apiConfig
        };
      }

      // Field visibility overrides
      if (overrides.hideFields && merged.detailsPageConfig.propertiesConfig) {
        merged.detailsPageConfig.propertiesConfig = merged.detailsPageConfig.propertiesConfig.filter(
          (prop: any) => !overrides.hideFields!.includes(prop.name || prop.column)
        );
      }
      if (overrides.showOnlyFields && merged.detailsPageConfig.propertiesConfig) {
        merged.detailsPageConfig.propertiesConfig = merged.detailsPageConfig.propertiesConfig.filter(
          (prop: any) => overrides.showOnlyFields!.includes(prop.name || prop.column)
        );
      }
    }

    if (pageType === 'create') {
      if (!merged.formPageConfig) {
        console.warn(
          `[useEntityConfig] Expected formPageConfig for create page, but not found in config`
        );
        return merged;
      }

      // Create page overrides
      if (overrides.submitSuccessRedirect !== undefined) {
        merged.formPageConfig.submitSuccessRedirect = overrides.submitSuccessRedirect;
      }
      if (overrides.formButtons !== undefined) {
        merged.formPageConfig.formButtons = overrides.formButtons;
      }
      if (overrides.columnsConfig !== undefined) {
        merged.formPageConfig.columnsConfig = overrides.columnsConfig;
      }

      // Field visibility overrides
      if (overrides.hideFields && merged.formPageConfig.propertiesConfig) {
        merged.formPageConfig.propertiesConfig = merged.formPageConfig.propertiesConfig.filter(
          (prop: any) => !overrides.hideFields!.includes(prop.name || prop.column)
        );
      }
      if (overrides.showOnlyFields && merged.formPageConfig.propertiesConfig) {
        merged.formPageConfig.propertiesConfig = merged.formPageConfig.propertiesConfig.filter(
          (prop: any) => overrides.showOnlyFields!.includes(prop.name || prop.column)
        );
      }
    }

    if (pageType === 'list') {
      if (!merged.listPageConfig) {
        console.warn(
          `[useEntityConfig] Expected listPageConfig for list page, but not found in config`
        );
        return merged;
      }

      // List page overrides
      if (overrides.defaultFilters !== undefined) {
        merged.listPageConfig.defaultFilters = {
          ...(merged.listPageConfig.defaultFilters || {}),
          ...overrides.defaultFilters
        };
      }
      if (overrides.columnsConfig !== undefined) {
        merged.listPageConfig.columnsConfig = overrides.columnsConfig;
      }

      // Segment overrides - flexible control over filter segments
      // Priority: segments (full override) > hideSegments/showOnlySegments (filter) > additionalSegments (merge)
      const baseSegments = merged.listPageConfig.segments || [];

      if (overrides.segments !== undefined) {
        // Complete override - replaces all segments (or disables with [])
        merged.listPageConfig.segments = overrides.segments;
      } else if (overrides.showOnlySegments !== undefined) {
        // Show only specific segments by ID
        const idsToShow = new Set<string>(overrides.showOnlySegments as string[]);
        merged.listPageConfig.segments = filterSegmentsByIds(baseSegments, idsToShow);
      } else if (overrides.hideSegments !== undefined) {
        // Hide specific segments by ID  
        const allIds = getAllSegmentIds(baseSegments);
        const hideIds = new Set<string>(overrides.hideSegments as string[]);
        const idsToKeep = new Set<string>(allIds.filter(id => !hideIds.has(id)));
        merged.listPageConfig.segments = filterSegmentsByIds(baseSegments, idsToKeep);
      } else if (overrides.additionalSegments !== undefined) {
        // Merge additional segments with base (ID-based override)
        merged.listPageConfig.segments = mergeSegments(baseSegments, overrides.additionalSegments);
      }

      // API config override for list pages
      // List pages can have either single apiConfig or dual search/database configs
      if (overrides.apiConfig !== undefined && merged.listPageConfig.apiConfig) {
        const overrideConfig = overrides.apiConfig;
        const baseConfig = merged.listPageConfig.apiConfig;

        if (isDualApiConfig(overrideConfig)) {
          // Override is dual config - replace entirely
          merged.listPageConfig.apiConfig = overrideConfig;
        } else if (isDualApiConfig(baseConfig)) {
          // Base has dual config, override is single - merge into both
          merged.listPageConfig.apiConfig = {
            search: { ...baseConfig.search, ...overrideConfig },
            database: { ...baseConfig.database, ...overrideConfig }
          };
        } else {
          // Both are single configs - simple merge
          merged.listPageConfig.apiConfig = {
            ...baseConfig,
            ...overrideConfig
          };
        }
      }

      // Field visibility overrides (for columns)
      if (overrides.hideFields && merged.listPageConfig.columnsConfig) {
        merged.listPageConfig.columnsConfig = merged.listPageConfig.columnsConfig.filter(
          (col: any) => !overrides.hideFields!.includes(col.name || col.dataIndex)
        );
      }
      if (overrides.showOnlyFields && merged.listPageConfig.columnsConfig) {
        merged.listPageConfig.columnsConfig = merged.listPageConfig.columnsConfig.filter(
          (col: any) => overrides.showOnlyFields!.includes(col.name || col.dataIndex)
        );
      }
    }

    return merged;
  };

  return { resolveConfigRef };
};

