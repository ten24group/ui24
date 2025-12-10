import { useUi24Config } from '../context/UI24Context';

/**
 * Column configuration for entity pages.
 * Must match IEntityPageColumnConfig from @ten24group/fw24
 */
export interface IEntityPageColumnConfig {
  numColumns?: number;
  columns: Array<{ sortOrder: number; fields: string[] }>;
}

/**
 * API method types
 */
export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Basic API configuration for modals and details
 */
export interface IModalApiConfig {
  apiMethod: ApiMethod;
  responseKey?: string;
  apiUrl: string;
}

/**
 * Extended API configuration for list pages (single mode)
 */
export interface IListApiConfigSingle extends IModalApiConfig {
  useSearch?: boolean;
  defaultSort?: { field: string; order: 'asc' | 'desc' };
}

/**
 * Dual API configuration for list pages (search + database)
 */
export interface IListApiConfigDual {
  search: IModalApiConfig;
  database: IModalApiConfig;
}

/**
 * Union type for all API configuration formats
 * Matches the backend IEntityConfigReference.overrideConfig.apiConfig
 */
export type ApiConfigOverride = IModalApiConfig | IListApiConfigDual | IListApiConfigSingle;

/**
 * Entity Configuration Reference (from fw24)
 * This type must match IEntityConfigReference in @ten24group/fw24 EXACTLY
 */
export interface IEntityConfigReference {
  /** Entity name (e.g., 'team', 'game', 'user') */
  entityName: string;
  
  /** Which page config to reference: 'view', 'create', or 'list' */
  pageType: 'view' | 'create' | 'list';
  
  /** Optional overrides to apply to the referenced config */
  overrideConfig?: {
    /** Override page title */
    pageTitle?: string;
    
    /** Override columns configuration (for view pages) */
    columnsConfig?: IEntityPageColumnConfig;
    
    /** Override breadcrumbs */
    breadcrumbs?: Array<{ label: string; url?: string }>;
    
    /** Override form success redirect (for create pages) */
    submitSuccessRedirect?: string;
    
    /** Override form buttons (for create pages) */
    formButtons?: Array<{ text: string; action: string; url?: string }>;
    
    /** Add default filters (for list pages) */
    defaultFilters?: Record<string, any>;
    
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

/**
 * Type guard to check if API config is dual (search + database)
 */
function isDualApiConfig(config: any): config is IListApiConfigDual {
  return config && typeof config === 'object' && 'search' in config && 'database' in config;
}

/**
 * Type guard to check if API config is single with extended options
 */
function isListApiConfigSingle(config: any): config is IListApiConfigSingle {
  return config && typeof config === 'object' && 'apiMethod' in config && 'apiUrl' in config;
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

