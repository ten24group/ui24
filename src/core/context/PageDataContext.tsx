import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useModalDepth } from '../../modal/Modal';
import { ComponentDataContext } from '../types/pageData';
import { useDevToolsReport } from '../devtools/store/snapshot';

/**
 * Page data context - combines navigation state with component data
 */
export interface IPageDataContext extends ComponentDataContext {
  /**
   * Route information
   */
  route?: {
    routeParams: Record<string, string>;
    queryParams: Record<string, string>;
  };
  
  /**
   * Modal nesting depth
   */
  modalDepth?: number;
}

const PageDataContext = createContext<IPageDataContext | null>(null);
PageDataContext.displayName = 'PageDataContext';  // For React DevTools

// CRITICAL: Stable empty object to prevent re-renders
const EMPTY_LOCAL_DATA: Partial<ComponentDataContext> = {};

/**
 * PageDataProvider - Nestable provider for dynamic page/component state
 * 
 * Can be nested for modal/accordion/dashboard isolation.
 * Inherits parent context and merges with local data.
 * REQUIRED in PostAuthPage for proper context setup.
 */
export const PageDataProvider = ({ 
  children,
  localData,
  isolated = false
}: { 
  children: ReactNode;
  localData?: Partial<ComponentDataContext>;
  isolated?: boolean;
}) => {
  const location = useLocation();
  const params = useParams();
  const modalDepth = useModalDepth();
  const parentContext = useContext(PageDataContext);
  
  // Use stable empty object if localData is undefined
  const stableLocalData = localData || EMPTY_LOCAL_DATA;
  
  // Build context by merging parent + local data
  // CRITICAL: localData is already memoized by caller (PostAuthPage, addActionUI)
  // so we can safely depend on it directly
  const pageContext = useMemo((): IPageDataContext => {
    return {
      // Inherit from parent (unless isolated)
      ...(isolated ? {} : parentContext),
      
      // Add/override with local data
      ...stableLocalData,
      
      // Always provide route and modalDepth
      route: {
        routeParams: params,
        queryParams: Object.fromEntries(new URLSearchParams(location.search))
      },
      modalDepth
    };
  }, [parentContext, stableLocalData, params, location.search, modalDepth, isolated]);

  useDevToolsReport('pageData', 'PageData', pageContext, modalDepth);

  return (
    <PageDataContext.Provider value={pageContext}>
      {children}
    </PageDataContext.Provider>
  );
};

/**
 * Hook to access page data context
 * REQUIRED: Must be used within PageDataProvider
 */
export const usePageDataContext = () => {
  const context = useContext(PageDataContext);
  if (!context) {
    throw new Error('usePageDataContext must be used within PageDataProvider');
  }
  return context;
};

/**
 * Safe variant — returns null when outside PageDataProvider.
 * Useful for devtools / panels rendered in portals outside the main tree.
 */
export const useOptionalPageDataContext = () => {
  return useContext(PageDataContext);
};

