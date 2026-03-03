/**
 * Centralized page configuration types and type guards.
 * 
 * This file contains:
 * - Page configuration type definitions
 * - Type guards for runtime validation
 * - Utility functions for page config operations
 */

import type { IEntityConfigReference } from '../hooks/useEntityConfig';
import type { IRenderFromPageType, IPageType } from '../../pages/PostAuth/PostAuthPage';

/**
 * Type for page entries in pagesConfig (from backend entities.json).
 * These are runtime configs that may include additional dynamic properties.
 */
export interface PageConfigEntry {
  routePattern?: string;
  pageType?: string;
  pageTitle?: string;
  formPageConfig?: { entityName?: string;[ key: string ]: any };
  listPageConfig?: { entityName?: string;[ key: string ]: any };
  detailsPageConfig?: { entityName?: string;[ key: string ]: any };
  [ key: string ]: any;
}

/**
 * Type guard to check if config is a PageConfigEntry (from route resolution).
 * 
 * Distinguishes PageConfigEntry from IEntityConfigReference by checking for
 * the absence of the IEntityConfigReference pattern (entityName + specific pageType).
 */
export function isPageConfigEntry(config: unknown): config is PageConfigEntry {
  if (!config || typeof config !== 'object') return false;
  const c = config as Record<string, unknown>;

  // PageConfigEntry does NOT have the IEntityConfigReference signature
  // (entityName at root + pageType with specific values)
  return !(
    'entityName' in c &&
    typeof c.entityName === 'string' &&
    'pageType' in c &&
    (c.pageType === 'view' || c.pageType === 'create' || c.pageType === 'edit' || c.pageType === 'list')
  );
}

/**
 * Type guard to check if config is an IEntityConfigReference.
 * 
 * IEntityConfigReference has entityName at root level and specific pageType values.
 */
export function isEntityConfigReference(config: unknown): config is IEntityConfigReference {
  if (!config || typeof config !== 'object') return false;
  const c = config as Record<string, unknown>;

  return (
    'entityName' in c &&
    typeof c.entityName === 'string' &&
    'pageType' in c &&
    (c.pageType === 'view' || c.pageType === 'create' || c.pageType === 'edit' || c.pageType === 'list')
  );
}

/**
 * Type guard to check if a string is a valid IPageType.
 */
export function isValidPageType(value: unknown): value is IPageType {
  return (
    value === 'list' ||
    value === 'details' ||
    value === 'form' ||
    value === 'accordion' ||
    value === 'dashboard' ||
    value === 'system' ||
    value === 'custom' ||
    value === 'wizard' ||
    value === 'kanban' ||
    value === 'tree' ||
    value === 'calendar' ||
    value === 'map'
  );
}

/**
 * Safely convert PageConfigEntry to IRenderFromPageType props.
 * 
 * Runtime configs from backend are trusted to have the correct structure.
 * Additional props can include runtime-only callbacks not in IRenderFromPageType.
 * 
 * @param pageConfig - The page configuration (PageConfigEntry or IEntityConfigReference)
 * @param additionalProps - Additional props to merge (e.g., routeParams, callbacks)
 * @returns Props suitable for RenderFromPageType component
 */
export function toRenderProps(
  pageConfig: PageConfigEntry | IEntityConfigReference | null,
  additionalProps: Record<string, any>
): IRenderFromPageType {
  if (!pageConfig) return additionalProps as IRenderFromPageType;

  if (isEntityConfigReference(pageConfig)) {
    // For entity config references, useEntityConfig hook will resolve them
    // We don't spread them here, just pass through additional props
    return additionalProps as IRenderFromPageType;
  }

  if (isPageConfigEntry(pageConfig)) {
    // PageConfigEntry from backend config is structurally compatible with IRenderFromPageType
    // The backend config generation ensures correct shapes for all page configs
    // We use structural typing here - the object has the right shape even if TypeScript
    // can't verify all nested properties at compile time
    return {
      ...pageConfig,
      ...additionalProps,
    } as IRenderFromPageType;
  }

  return additionalProps as IRenderFromPageType;
}
