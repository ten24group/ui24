/**
 * @fileoverview Hook for building resolver context
 * 
 * Provides a standardized way to build ResolverContext from various sources.
 */

import { useMemo } from 'react';
import { usePageStaticContext } from '../context/PageStaticContext';
import { useAppStaticContext } from '../context/AppStaticContext';
import type { ResolverContext, RouteParams, ActorContext, FeatureFlags, TenantContext, DeviceContext } from './types';

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
  const appStatic = useAppStaticContext();

  const {
    routeParams = {},
    depth = 0,
    fieldName,
    fieldType,
    parentData
  } = options;

  // Map AppStaticContext actor to ResolverContext actor
  const actor: ActorContext | undefined = useMemo(() => {
    if (!appStatic?.actor?.actorId) return undefined;
    return {
      actorId: appStatic.actor.actorId,
      groups: appStatic.actor.groups ?? [],
      permissions: appStatic.actor.permissions,
    };
  }, [appStatic?.actor]);

  // Get feature flags from AppStaticContext (boolean toggles + string variants)
  const featureFlags: FeatureFlags | undefined = useMemo(() => {
    const flags = appStatic?.featureFlags;
    if (!flags || Object.keys(flags).length === 0) return undefined;
    return flags as FeatureFlags;
  }, [appStatic?.featureFlags]);

  // Get tenant from AppStaticContext
  const tenant: TenantContext | undefined = useMemo(() => {
    if (!appStatic?.tenant?.tenantId) return undefined;
    return appStatic.tenant as TenantContext;
  }, [appStatic?.tenant]);

  // Get device from AppStaticContext
  const device: DeviceContext | undefined = useMemo(() => {
    if (!appStatic?.device) return undefined;
    return {
      isMobile: appStatic.device.isMobile,
      isTablet: appStatic.device.isTablet,
      isDesktop: appStatic.device.isDesktop,
      viewport: appStatic.device.viewport,
    };
  }, [appStatic?.device]);

  return useMemo<ResolverContext>(() => ({
    entityName: pageStatic?.entityName,
    pageType: pageStatic?.pageType,
    fieldName,
    fieldType,
    actor,
    featureFlags,
    tenant,
    device,
    routeParams,
    parentData,
    depth
  }), [
    pageStatic?.entityName,
    pageStatic?.pageType,
    fieldName,
    fieldType,
    actor,
    featureFlags,
    tenant,
    device,
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
  readonly actor?: Readonly<ActorContext>;
  readonly featureFlags?: Readonly<FeatureFlags>;
  readonly tenant?: Readonly<TenantContext>;
  readonly device?: Readonly<DeviceContext>;
  readonly routeParams?: Readonly<RouteParams>;
  readonly parentData?: unknown;
  readonly depth?: number;
}): Readonly<ResolverContext> {
  return {
    entityName: options.entityName,
    pageType: options.pageType,
    fieldName: options.fieldName,
    fieldType: options.fieldType,
    actor: options.actor,
    featureFlags: options.featureFlags,
    tenant: options.tenant,
    device: options.device,
    routeParams: options.routeParams ?? {},
    parentData: options.parentData,
    depth: options.depth ?? 0
  };
}
