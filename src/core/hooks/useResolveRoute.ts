import { useMemo } from 'react';
import { useUi24Config } from '../context';
import { substituteUrlParams, matchRoutePattern } from '../utils';

export interface ResolveRouteResult {
  /** Whether a matching route was found */
  found: boolean;
  
  /** The matched page configuration from entities.json */
  pageConfig: any | null;
  
  /** Extracted route parameters (e.g., { id: "123", userId: "456" }) */
  params: Record<string, string>;
  
  /** Query parameters from the URL */
  queryParams: URLSearchParams;
}

/**
 * Hook to resolve a URL against registered page configurations
 * Used for opening routes in modals by resolving their page config
 * 
 * @param url - URL to resolve (can include params like "/view-user/:id" or query params)
 * @param routeParams - Current route parameters to substitute
 * @returns Resolved route information or null if not found
 * 
 * @example
 * const { found, pageConfig, params } = useResolveRoute("/view-user/:id", { id: "123" });
 * if (found) {
 *   // Open pageConfig in modal
 * }
 */
export const useResolveRoute = (
  url: string,
  routeParams: Record<string, any> = {}
): ResolveRouteResult => {
  const { selectConfig } = useUi24Config();
  const pagesConfig = selectConfig((config) => config.pagesConfig);
  
  return useMemo(() => {
    if (!url || !pagesConfig) {
      return { found: false, pageConfig: null, params: {}, queryParams: new URLSearchParams() };
    }
    
    // Split URL into pathname and query
    const [pathname, search] = url.split('?');
    const queryParams = new URLSearchParams(search || '');
    
    // Substitute route params in pathname
    const resolvedPathname = substituteUrlParams(pathname, routeParams);
    
    // Normalize pathname (add leading slash if missing)
    const normalizedPathname = resolvedPathname.startsWith('/') ? resolvedPathname : `/${resolvedPathname}`;
    
    // Try to match against all registered page configs
    for (const [key, config] of Object.entries(pagesConfig)) {
      const page = config as any;
      
      // Strategy 1: Match against routePattern
      if (page.routePattern) {
        // Split routePattern to remove query params if any
        const [patternPathname] = page.routePattern.split('?');
        
        const match = matchRoutePattern(patternPathname, normalizedPathname);
        
        if (match) {
          return {
            found: true,
            pageConfig: page,
            params: match,
            queryParams
          };
        }
      }
      
      // Strategy 2: Fallback - match against config key itself
      // Some configs don't have routePattern, key is the route (e.g., "edit-game")
      const normalizedKey = key.startsWith('/') ? key : `/${key}`;
      
      // Try exact match
      if (normalizedKey === normalizedPathname) {
        return {
          found: true,
          pageConfig: page,
          params: {},
          queryParams
        };
      }
      
      // Try with param placeholders (e.g., "edit-game" might need ":id")
      const keyMatch = matchRoutePattern(normalizedKey, normalizedPathname);
      if (keyMatch) {
        return {
          found: true,
          pageConfig: page,
          params: keyMatch,
          queryParams
        };
      }
    }
    
    // No match found
    return { found: false, pageConfig: null, params: {}, queryParams };
  }, [url, routeParams, pagesConfig]);
};

