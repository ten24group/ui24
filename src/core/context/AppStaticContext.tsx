/**
 * App-level static context (rarely changes).
 * Provided by App.tsx, available throughout the application.
 * 
 * Uses use-context-selector for selective subscription.
 */
import { createContext, useContextSelector } from 'use-context-selector';
import React, { ReactNode, useMemo } from 'react';
import { useAuth } from './AuthContext';

export interface AppStaticContextValue {
  actor: {
    actorId: string;
    username?: string;
    email?: string;
    groups: string[];
    permissions?: string[];
  };
  tenant?: {
    tenantId: string;
    name: string;
  };
  device: {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    viewport: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  };
  featureFlags?: Record<string, boolean>;
}

const AppStaticContext = createContext<AppStaticContextValue | null>(null);

export const AppStaticProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  
  const value = useMemo((): AppStaticContextValue => {
    // Map auth user to actor
    const userGroups = user?.['cognito:groups'] || user?.groups || [];
    const actor = {
      actorId: user?.sub || user?.id || '',
      username: user?.username,
      email: user?.email,
      groups: userGroups,
      permissions: user?.permissions || [],
      // BACKWARD COMPATIBILITY: Provide nested cognito object for legacy evaluations
      cognito: {
        groups: userGroups,
      }
    };
    
    // Get device info (simple implementation, can be enhanced)
    const getViewport = (): 'xs' | 'sm' | 'md' | 'lg' | 'xl' => {
      const width = window.innerWidth;
      if (width < 576) return 'xs';
      if (width < 768) return 'sm';
      if (width < 992) return 'md';
      if (width < 1200) return 'lg';
      return 'xl';
    };
    
    const device = {
      isMobile: window.innerWidth < 768,
      isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
      isDesktop: window.innerWidth >= 1024,
      viewport: getViewport()
    };
    
    return {
      actor,
      device,
      // Add tenant and featureFlags when available
    };
  }, [
    user?.sub,
    user?.id,
    user?.username,
    user?.email,
    user?.['cognito:groups'],
    user?.groups,
    user?.permissions
  ]);
  
  return (
    <AppStaticContext.Provider value={value}>
      {children}
    </AppStaticContext.Provider>
  );
};

// Selector hooks for common use cases
export const useActor = () => 
  useContextSelector(AppStaticContext, state => state?.actor);

export const useActorGroups = () =>
  useContextSelector(AppStaticContext, state => state?.actor.groups || []);

export const useActorId = () =>
  useContextSelector(AppStaticContext, state => state?.actor.actorId);

export const useDevice = () =>
  useContextSelector(AppStaticContext, state => state?.device);

export const useFeatureFlag = (flag: string) =>
  useContextSelector(
    AppStaticContext,
    state => state?.featureFlags?.[flag] ?? false
  );

export const useTenant = () =>
  useContextSelector(AppStaticContext, state => state?.tenant);

// Full context (use sparingly - only when you need everything)
export const useAppStaticContext = () =>
  useContextSelector(AppStaticContext, state => state);

