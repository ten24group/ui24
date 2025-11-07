import React, { useMemo } from 'react';
import { PostAuthPage } from '../PostAuth/PostAuthPage';
import { useLocation } from "react-router-dom";
import { NotFound } from '../404/NotFound';
import { useUi24Config } from '../../core/context';
import { matchRoutePattern } from '../../core/utils';
import { Spin } from 'antd';

// Handle legacy edit/detail routes that include IDs
function handleLegacyRoute(pathname: string): { pageName: string; params: { id: string } } | null {
    const parts = pathname.split('/').filter(Boolean);
    
    // Check if this is an edit or view route
    if (parts.length === 2 && (parts[0].startsWith('edit-') || parts[0].startsWith('view-'))) {
        const pageName = parts[0];
        const id = parts[1];
        return {
            pageName,
            params: { id }
        };
    }
    
    return null;
}

export const DynamicPage = () => {
    const location = useLocation();
    const { getPageConfig, selectConfig } = useUi24Config();
    const pagesConfig = selectConfig((config) => config.pagesConfig);
    const isConfigLoading = selectConfig((config) => !config || !config.pagesConfig);
    

    // Compute page config and params (must happen before any early returns to maintain hook order)
    const { pageConfig, params, pageNotFound } = useMemo(() => {
        let pageConfig: any = null;
        let routeParams: Record<string, string> = {};
        let pageNotFound = true;

        // Only proceed with routing if we have pagesConfig
        if (pagesConfig && Object.keys(pagesConfig).length > 0) {
            // First try to match legacy edit/detail routes
            const legacyMatch = handleLegacyRoute(location.pathname);
            if (legacyMatch) {
                pageConfig = pagesConfig[legacyMatch.pageName];
                if (pageConfig) {
                    routeParams = legacyMatch.params;
                    pageNotFound = false;
                }
            }
            
            // If no legacy match, try to match by routePattern
            if (!pageConfig) {
                for (const [key, pageConf] of Object.entries(pagesConfig)) {
                    const page = pageConf as any;
                    if (page.routePattern) {
                        const match = matchRoutePattern(page.routePattern, location.pathname);
                        if (match) {
                            pageConfig = page;
                            routeParams = match;
                            pageNotFound = false;
                            break;
                        }
                    }
                }
                
                // Only try fallback if no other matches found
                if (!pageConfig) {
                    const pathParts = location.pathname.split('/').filter(Boolean);
                    if (pathParts.length > 0) {
                        pageConfig = getPageConfig(pathParts[0]);
                        pageNotFound = !pageConfig;
                    }
                }
            }
        }
        
        return { pageConfig, params: routeParams, pageNotFound };
    }, [pagesConfig, location.pathname, getPageConfig]);
    
    // Memoize enhancedConfig to prevent unnecessary re-renders
    const enhancedConfig = useMemo(() => {
        if (!pageConfig) return null;
        
        return {
            ...pageConfig,
            ...(pageConfig?.pageType === 'form' || pageConfig?.pageType === 'details' ? { 
                identifiers: params.id,
                formPageConfig: {
                    ...pageConfig.formPageConfig,
                    useDynamicIdFromParams: false
                }
            } : {})
        };
    }, [pageConfig, params]);
    
    // Create key that balances performance and state cleanup
    // - For list/dashboard pages: use page name only (no record ID needed)
    // - For form/detail pages: include record ID to force clean remount (faster perceived navigation)
    const pageKey = useMemo(() => {
        const pathParts = location.pathname.split('/').filter(Boolean);
        if (pathParts.length === 0) return 'home';
        
        const pageName = pathParts[0];
        const pageType = pageConfig?.pageType;
        
        // For form/detail pages with IDs, include the ID to force remount
        // This makes navigation feel instant since everything remounts at once
        if ((pageType === 'form' || pageType === 'details') && pathParts.length > 1) {
            const recordId = pathParts[1];
            return `${pageName}-${recordId}`;
        }
        
        // For list/dashboard pages, just use page name
        return pageName;
    }, [location.pathname, pageConfig?.pageType]);
    
    // NOW we can do early returns - all hooks have been called
    if (isConfigLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (pageNotFound) {
        return <NotFound />;
    }
    
    // Use page-name based key to remount when changing page types but not when changing record IDs
    // This makes navigation between records fast while still cleaning state between different page types
    return (enhancedConfig?.private === true || (enhancedConfig?.private ?? true)) ? (
        <PostAuthPage key={pageKey} {...enhancedConfig} routeParams={params} />
    ) : (
        <h3>Define your page.</h3>
    );
};