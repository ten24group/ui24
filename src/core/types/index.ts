/**
 * Core type definitions and utilities.
 * 
 * Barrel export file for centralized type access.
 */

// Re-export all types from field-types
export * from './field-types';

// Re-export all types from field-config
export * from './field-config';

// Re-export all types from evaluation
export * from './evaluation';

// Re-export all types from pageData
export * from './pageData';

// Page configuration types and utilities (NEW)
export {
  PageConfigEntry,
  isPageConfigEntry,
  isEntityConfigReference,
  isValidPageType,
  toRenderProps,
} from './pageConfig';

// Re-export commonly used page types
export type { IEntityConfigReference } from '../hooks/useEntityConfig';
export type { IPageType, IRenderFromPageType } from '../../pages/PostAuth/PostAuthPage';
