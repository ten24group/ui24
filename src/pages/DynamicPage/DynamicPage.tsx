import React from 'react';
import { PostAuthPage } from '../PostAuth/PostAuthPage';
import { useLocation } from "react-router-dom";
import { NotFound } from '../404/NotFound';
import { useUi24Config } from '../../core/context';
import { OpenInModal } from '../../modal/Modal';
import { Icon } from '../../core/common';
import { Spin } from 'antd';

// Utility to match a path against a pattern like /author/:authorId/books
function matchRoutePattern(pattern: string, path: string) {
    // Remove leading and trailing slashes and split into segments
    const patternParts = pattern.replace(/^\/+|\/+$/g, '').split('/');
    const pathParts = path.replace(/^\/+|\/+$/g, '').split('/');
    
    // If the number of segments doesn't match, this isn't a match
    if (patternParts.length !== pathParts.length) {
        return null;
    }

    const params: Record<string, string> = {};
    
    // Check each segment
    for (let i = 0; i < patternParts.length; i++) {
        const patternPart = patternParts[i];
        const pathPart = pathParts[i];
        
        if (patternPart.startsWith(':')) {
            // This is a parameter - capture it
            const paramName = patternPart.slice(1);
            params[paramName] = pathPart;
        } else if (patternPart !== pathPart) {
            return null;
        }
    }

    return params;
}

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
    
    // If config is still loading, show loading state
    if (isConfigLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
            </div>
        );
    }
    
    let pageConfig = null;
    let params: Record<string, string> = {};
    let pageNotFound = true;

    // Only proceed with routing if we have pagesConfig
    if (pagesConfig && Object.keys(pagesConfig).length > 0) {
        // First try to match legacy edit/detail routes
        const legacyMatch = handleLegacyRoute(location.pathname);
        if (legacyMatch) {
            pageConfig = pagesConfig[legacyMatch.pageName];
            if (pageConfig) {
                params = legacyMatch.params;
                pageNotFound = false;
            }
        }
        
        // If no legacy match, try to match by routePattern
        if (!pageConfig) {
            for (const [key, config] of Object.entries(pagesConfig)) {
                const page = config as any;
                if (page.routePattern) {
                    const match = matchRoutePattern(page.routePattern, location.pathname);
                    if (match) {
                        pageConfig = page;
                        params = match;
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

    if (pageNotFound) {
        return <NotFound />;
    }
    
    // For edit/view pages, pass the id as identifiers
    const enhancedConfig = {
        ...pageConfig,
        ...(pageConfig?.pageType === 'form' || pageConfig?.pageType === 'details' ? { 
            identifiers: params.id,
            formPageConfig: {
                ...pageConfig.formPageConfig,
                useDynamicIdFromParams: false
            }
        } : {})
    };
    
    return (enhancedConfig?.private === true || (enhancedConfig?.private ?? true)) ? (
        <>
            <PostAuthPage {...enhancedConfig} routeParams={params} />
        </>
    ) : (
        <h3>Define your page.</h3>
    );
};