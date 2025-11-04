import React, { createContext, useContext, useMemo, ReactNode, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { jwtDecode } from 'jwt-decode';

/**
 * Cognito JWT token payload shape
 */
interface CognitoTokenPayload {
  sub?: string;
  'cognito:groups'?: string[];
  'cognito:username'?: string;
  email?: string;
  [key: string]: any;
}

/**
 * Application state interface - foundation for enterprise features
 * 
 * DESIGN NOTE: Clean actor structure without "cognito" nesting.
 * Groups are mapped from cognito:groups for cleaner evaluation syntax.
 * Original cognito object preserved for niche use cases.
 */
export interface IAppState {
  /**
   * Current authenticated actor (user)
   */
  actor?: {
    actorId: string;
    groups: string[]; // Mapped from cognito:groups - use this for evaluations
    username?: string;
    email?: string;
    
    // Keep original cognito data for niche use cases
    cognito?: {
      groups: string[];
      username?: string;
      [key: string]: any;
    };
    
    // Foundation for future features:
    entitlements?: string[]; // e.g., ['premium', 'advanced-reporting']
    preferences?: {
      theme?: 'light' | 'dark';
      compactMode?: boolean;
      language?: string;
    };
  };
  
  /**
   * Tenant information
   */
  tenant?: {
    id: string;
    name: string;
    
    // Foundation for future features:
    customizations?: Record<string, any>; // Branding, UI tweaks
    featureFlags?: Record<string, boolean>; // Tenant-specific features
  };
  
  /**
   * Global feature flags
   * Foundation for: A/B testing, country/region rollouts, opt-in features
   */
  globalFeatureFlags?: Record<string, boolean>;
}

const AppStateContext = createContext<IAppState | null>(null);
AppStateContext.displayName = 'AppStateContext';  // For React DevTools

/**
 * AppStateProvider - Provides global application state
 * 
 * BORROWS actor data from AuthProvider (doesn't own it).
 * AuthProvider owns the token, we just transform it.
 * Updates automatically when auth.isLoggedIn changes.
 */
export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();
  
  // Track auth state changes to rebuild actor
  const [actor, setActor] = useState<IAppState['actor'] | undefined>(undefined);
  
  useEffect(() => {
    try {
      const token = auth.getToken();
      if (!token || !auth.isLoggedIn) {
        setActor(undefined);
        return;
      }
      
      const decoded = jwtDecode<CognitoTokenPayload>(token);
      
      // Build actor with clean structure
      setActor({
        actorId: decoded.sub || '',
        groups: decoded['cognito:groups'] || [],  // Clean top-level access
        username: decoded['cognito:username'] || decoded.email,
        email: decoded.email,
        
        // Preserve original cognito data for niche use cases
        cognito: {
          groups: decoded['cognito:groups'] || [],
          username: decoded['cognito:username'],
          ...decoded  // Keep all cognito token data
        },
        
        // Future: Load entitlements from API based on actorId
        // Future: Load preferences from localStorage or API
      });
    } catch (error) {
      console.error('[AppStateProvider] Failed to decode token:', error);
      setActor(undefined);
    }
  }, [auth.isLoggedIn, auth.getToken]);  // FIXED: Only depend on isLoggedIn and getToken function
  
  // Build app state
  const appState: IAppState = useMemo(() => ({
    actor,
    // Future: Load tenant info from API or config
    // tenant: { id: '...', name: '...' },
    // Future: Load global feature flags from API or config
    // globalFeatureFlags: { ... }
  }), [actor]);
  
  return (
    <AppStateContext.Provider value={appState}>
      {children}
    </AppStateContext.Provider>
  );
};

/**
 * Hook to access application state
 * REQUIRED: Must be used within AppStateProvider
 */
export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
};

