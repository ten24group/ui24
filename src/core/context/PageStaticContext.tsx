/**
 * Page-level static context (changes on navigation).
 * Provided by PostAuthPage, available to all components in a page.
 * 
 * Uses use-context-selector for selective subscription.
 */
import { createContext, useContextSelector } from 'use-context-selector';
import React, { ReactNode, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useModalDepth } from '../../modal/Modal';

export interface PageStaticContextValue {
  pageType?: 'list' | 'view' | 'edit' | 'create' | 'accordion' |  'dashboard' | 'system';
  entityName?: string;
  config: any; // Full page config from entities.json
  route: {
    routeParams: Record<string, string>;
    queryParams: Record<string, string>;
    pathname: string;
  };
  modal: {
    depth: number;
    isInModal: boolean;
  };
}

const PageStaticContext = createContext<PageStaticContextValue | null>(null);

export const PageStaticProvider = ({
  children,
  pageType,
  entityName,
  config
}: {
  children: ReactNode;
  pageType: PageStaticContextValue['pageType'];
  entityName?: string;
  config: any;
}) => {
  const params = useParams();
  const location = useLocation();
  const modalDepth = useModalDepth();
  
  // Store previous config reference to detect actual changes
  const configRef = React.useRef(config);
  const stableConfig = React.useMemo(() => {
    // If config reference changed, update it
    // This allows parent to update config, but also allows us to keep stable reference
    // when parent recreates config object with same content
    if (config !== configRef.current) {
      configRef.current = config;
    }
    return configRef.current;
  }, [config]);
  
  const value = useMemo((): PageStaticContextValue => {
    return {
      pageType,
      entityName,
      config: stableConfig,
      route: {
        routeParams: params,
        queryParams: Object.fromEntries(new URLSearchParams(location.search)),
        pathname: location.pathname
      },
      modal: {
        depth: modalDepth,
        isInModal: modalDepth > 0
      }
    };
  }, [pageType, entityName, stableConfig, params, location.search, location.pathname, modalDepth]);
  
  return (
    <PageStaticContext.Provider value={value}>
      {children}
    </PageStaticContext.Provider>
  );
};

// Selector hooks
export const usePageType = () =>
  useContextSelector(PageStaticContext, state => state?.pageType);

export const useEntityName = () =>
  useContextSelector(PageStaticContext, state => state?.entityName);

export const usePageStaticConfig = () =>
  useContextSelector(PageStaticContext, state => state?.config);

export const useRouteParams = () =>
  useContextSelector(PageStaticContext, state => state?.route.routeParams);

export const useQueryParams = () =>
  useContextSelector(PageStaticContext, state => state?.route.queryParams);

export const useRoutePath = () =>
  useContextSelector(PageStaticContext, state => state?.route.pathname);

export const useModalInfo = () =>
  useContextSelector(PageStaticContext, state => state?.modal);

export const useIsInModal = () =>
  useContextSelector(PageStaticContext, state => state?.modal.isInModal ?? false);

export const useModalDepthFromContext = () =>
  useContextSelector(PageStaticContext, state => state?.modal.depth ?? 0);

// Full context (use sparingly)
export const usePageStaticContext = () =>
  useContextSelector(PageStaticContext, state => state);

