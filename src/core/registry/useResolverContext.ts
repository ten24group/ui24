/**
 * @fileoverview Hook for building resolver context
 * 
 * Provides a standardized way to build ResolverContext from various sources.
 */

import { useMemo } from 'react';
import { usePageStaticContext } from '../context/PageStaticContext';
import type { ResolverContext, RouteParams, UserContext, FeatureFlags } from './types';

/**
 * Options for building resolver context.
 */
export interface UseResolverContextOptions {
  /** Route parameters from URL */
  readonly routeParams?: Readonly<RouteParams>;
  /** Current nesting depth */
  readonly depth?: number;
  /** Field name (when resolving fields) */
  readonly fieldName?: string;
  /** Field type (when resolving fields) */
  readonly fieldType?: string;
  /** Parent data from containing component */
  readonly parentData?: unknown;
}

/**
 * Build resolver context from various sources.
 * 
 * Combines:
 * - Page static context (entityName, pageType)
 * - Route params
 * - User context (from auth)
 * - Feature flags (from config)
 * - Field context (when resolving fields)
 * 
 * @example
 * const context = useResolverContext({
 *   routeParams: { teamId: '123' },
 *   depth: 0
 * });
 */
export function useResolverContext(options: UseResolverContextOptions = {}): Readonly<ResolverContext> {
  const pageStatic = usePageStaticContext();

  const {
    routeParams = {},
    depth = 0,
    fieldName,
    fieldType,
    parentData
  } = options;

  // TODO: Get user context from auth provider
  // For now, return undefined - apps can inject via options later
  const user: UserContext | undefined = undefined;

  // TODO: Get feature flags from config provider
  // For now, return undefined - apps can inject via options later
  const featureFlags: FeatureFlags | undefined = undefined;

  return useMemo<ResolverContext>(() => ({
    entityName: pageStatic?.entityName,
    pageType: pageStatic?.pageType,
    fieldName,
    fieldType,
    user,
    featureFlags,
    routeParams,
    parentData,
    depth
  }), [
    pageStatic?.entityName,
    pageStatic?.pageType,
    fieldName,
    fieldType,
    user,
    featureFlags,
    routeParams,
    parentData,
    depth
  ]);
}

/**
 * Build resolver context outside of React (for utilities).
 * 
 * @param options - Context options
 * @returns Resolver context
 */
export function buildResolverContext(options: {
  readonly entityName?: string;
  readonly pageType?: string;
  readonly fieldName?: string;
  readonly fieldType?: string;
  readonly user?: Readonly<UserContext>;
  readonly featureFlags?: Readonly<FeatureFlags>;
  readonly routeParams?: Readonly<RouteParams>;
  readonly parentData?: unknown;
  readonly depth?: number;
}): Readonly<ResolverContext> {
  return {
    entityName: options.entityName,
    pageType: options.pageType,
    fieldName: options.fieldName,
    fieldType: options.fieldType,
    user: options.user,
    featureFlags: options.featureFlags,
    routeParams: options.routeParams ?? {},
    parentData: options.parentData,
    depth: options.depth ?? 0
  };
}
