/**
 * App-level static context (rarely changes).
 * Provided at app root, available throughout the application.
 * 
 * UPDATED: Now supports extensible context providers via conditionSystemConfig.
 * - Built-in: actor, device, featureFlags, tenant
 * - App-defined: any number of named context providers (subscription, preferences, etc.)
 * 
 * Uses use-context-selector for selective subscription.
 * Reference: CONDITION_SYSTEM_DESIGN.md Section 4.3
 */
import { createContext, useContextSelector } from 'use-context-selector';
import React, { ReactNode, useMemo, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getConditionSystemConfig } from './conditionSystemConfig';
import { IS_DEV } from '../constants';

export interface AppStaticContextValue {
  actor: {
    actorId: string;
    username?: string;
    email?: string;
    groups: string[];
    permissions?: string[];
    // Backward compat: legacy evaluations may use actor.cognito.groups
    cognito?: { groups: string[];[ key: string ]: any };
    [ key: string ]: any;
  };
  tenant?: {
    tenantId: string;
    name: string;
    [ key: string ]: any;
  };
  device: {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    viewport: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  };
  featureFlags: Record<string, boolean | string>;
  /** App-defined context providers merged here (e.g., subscription, preferences, etc.) */
  appContext?: Record<string, any>;
}

const AppStaticContext = createContext<AppStaticContextValue | null>(null);

function getViewport(): 'xs' | 'sm' | 'md' | 'lg' | 'xl' {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
  if (width < 576) return 'xs';
  if (width < 768) return 'sm';
  if (width < 992) return 'md';
  if (width < 1200) return 'lg';
  return 'xl';
}

function computeDevice() {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    viewport: getViewport(),
  };
}

export const AppStaticProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const config = getConditionSystemConfig();

  // ── Device state (with optional responsive updates) ──
  const [ device, setDevice ] = useState(computeDevice);

  useEffect(() => {
    if (!config.responsiveDevice) return;
    let timeout: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => setDevice(computeDevice()), 250);
    };
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('resize', handler);
      clearTimeout(timeout);
    };
  }, [ config.responsiveDevice ]);

  // ── Feature flags state ──
  const [ featureFlags, setFeatureFlags ] = useState<Record<string, boolean | string>>(() => {
    return config.featureFlagProvider?.getFlags() ?? {};
  });

  useEffect(() => {
    if (!config.featureFlagProvider?.subscribe) return;
    return config.featureFlagProvider.subscribe(setFeatureFlags);
  }, [ config.featureFlagProvider ]);

  // ── Tenant state ──
  const [ tenant, setTenant ] = useState<AppStaticContextValue[ 'tenant' ]>(() => {
    return config.tenantProvider?.getTenant() ?? undefined;
  });

  useEffect(() => {
    if (!config.tenantProvider?.subscribe) return;
    return config.tenantProvider.subscribe(setTenant);
  }, [ config.tenantProvider ]);

  // ── App-defined context providers ──
  const [ appContext, setAppContext ] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    if (config.contextProviders) {
      for (const [ key, provider ] of Object.entries(config.contextProviders)) {
        try {
          initial[ key ] = provider.getContext();
        } catch (e) {
          if (IS_DEV) {
            console.warn(`[AppStaticProvider] Error initializing context provider "${key}":`, e);
          }
        }
      }
    }
    return initial;
  });

  // Subscribe to dynamic app context providers
  useEffect(() => {
    if (!config.contextProviders) return;
    const unsubscribes: Array<() => void> = [];

    for (const [ key, provider ] of Object.entries(config.contextProviders)) {
      if (provider.subscribe) {
        const unsub = provider.subscribe((data) => {
          setAppContext(prev => ({ ...prev, [ key ]: data }));
        });
        unsubscribes.push(unsub);
      }
    }

    return () => unsubscribes.forEach(fn => fn());
  }, [ config.contextProviders ]);

  // ── Build actor from auth user ──
  const value = useMemo((): AppStaticContextValue => {
    const userGroups = user?.[ 'cognito:groups' ] || user?.groups || [];
    const actor = {
      actorId: user?.sub || user?.id || '',
      username: user?.username,
      email: user?.email,
      groups: userGroups,
      permissions: user?.permissions || [],
      // BACKWARD COMPATIBILITY: Provide nested cognito object for legacy evaluations
      cognito: {
        groups: userGroups,
      },
    };

    return {
      actor,
      device,
      featureFlags,
      tenant,
      appContext: Object.keys(appContext).length > 0 ? appContext : undefined,
    };
  }, [
    user?.sub,
    user?.id,
    user?.username,
    user?.email,
    user?.[ 'cognito:groups' ],
    user?.groups,
    user?.permissions,
    device,
    featureFlags,
    tenant,
    appContext,
  ]);

  return (
    <AppStaticContext.Provider value={value}>
      {children}
    </AppStaticContext.Provider>
  );
};

// ── Selector hooks ──

export const useActor = () =>
  useContextSelector(AppStaticContext, state => state?.actor);

export const useActorGroups = () =>
  useContextSelector(AppStaticContext, state => state?.actor?.groups || []);

export const useActorId = () =>
  useContextSelector(AppStaticContext, state => state?.actor?.actorId);

export const useDevice = () =>
  useContextSelector(AppStaticContext, state => state?.device);

export const useFeatureFlag = (flag: string) =>
  useContextSelector(
    AppStaticContext,
    state => state?.featureFlags?.[ flag ] ?? false
  );

export const useTenant = () =>
  useContextSelector(AppStaticContext, state => state?.tenant);

/** Full context (use sparingly — subscribes to everything) */
export const useAppStaticContext = () =>
  useContextSelector(AppStaticContext, state => state);

