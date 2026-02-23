import React, { useMemo, useEffect, useRef, useState, useTransition } from 'react';
import { PostAuthPage } from '../PostAuth/PostAuthPage';
import { useLocation } from "react-router-dom";
import { NotFound } from '../404/NotFound';
import { useUi24Config } from '../../core/context';
import { matchRoutePattern } from '../../core/utils';
import { Spin } from 'antd';
import { useNavigationSpan } from '../../core/telemetry';
import { PageSkeleton } from '../../core/common/PageSkeleton';

// Handle legacy edit/detail routes that include IDs
function handleLegacyRoute(pathname: string): { pageName: string; params: { id: string } } | null {
    const parts = pathname.split('/').filter(Boolean);

    // Check if this is an edit or view route
    if (parts.length === 2 && (parts[ 0 ].startsWith('edit-') || parts[ 0 ].startsWith('view-'))) {
        const pageName = parts[ 0 ];
        const id = parts[ 1 ];
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

    // Single route-matching pass: resolves pageName, pageConfig, and params together
    // to avoid iterating through all pagesConfig entries twice.
    const { pageName, pageConfig, params, pageNotFound } = useMemo(() => {
        const pathParts = location.pathname.split('/').filter(Boolean);
        let pageName = pathParts[ 0 ] || 'Home';
        let pageConfig: any = null;
        let routeParams: Record<string, string> = {};
        let pageNotFound = true;

        if (!pagesConfig || Object.keys(pagesConfig).length === 0) {
            return { pageName, pageConfig, params: routeParams, pageNotFound };
        }

        // First try legacy edit/detail routes
        const legacyMatch = handleLegacyRoute(location.pathname);
        if (legacyMatch) {
            pageName = legacyMatch.pageName;
            pageConfig = pagesConfig[ legacyMatch.pageName ];
            if (pageConfig) {
                routeParams = legacyMatch.params;
                pageNotFound = false;
            }
            return { pageName, pageConfig, params: routeParams, pageNotFound };
        }

        // Match by routePattern (single iteration)
        for (const [ key, pageConf ] of Object.entries(pagesConfig)) {
            const page = pageConf as any;
            if (page.routePattern) {
                const match = matchRoutePattern(page.routePattern, location.pathname);
                if (match) {
                    pageName = page.pageTitle || page.key || key;
                    pageConfig = page;
                    routeParams = match;
                    pageNotFound = false;
                    break;
                }
            }
        }

        // Fallback: use first path part as page key
        if (!pageConfig && pathParts.length > 0) {
            pageConfig = getPageConfig(pathParts[ 0 ]);
            pageNotFound = !pageConfig;
            if (pageConfig) {
                pageName = (pageConfig as any).pageTitle || (pageConfig as any).key || pathParts[ 0 ];
            }
        }

        return { pageName, pageConfig, params: routeParams, pageNotFound };
    }, [ pagesConfig, location.pathname, getPageConfig ]);

    // Navigation span - automatically managed by hook
    const currentPathKey = `${location.pathname}|${location.search}`;
    useNavigationSpan({
        route: pageName,
        pageKey: currentPathKey,
        attributes: {
            'navigation.pathname': location.pathname,
            'navigation.search': location.search,
            'navigation.pageName': pageName,
        }
    });

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
    }, [ pageConfig, params ]);

    // Create key that balances performance and state cleanup
    // - For list/dashboard pages: use page name only (no record ID needed)
    // - For form/detail pages: include record ID to force clean remount (faster perceived navigation)
    const pageKey = useMemo(() => {
        const pathParts = location.pathname.split('/').filter(Boolean);
        if (pathParts.length === 0) return 'home';

        const pageName = pathParts[ 0 ];
        const pageType = pageConfig?.pageType;

        // For form/detail pages with IDs, include the ID to force remount
        // This makes navigation feel instant since everything remounts at once
        if ((pageType === 'form' || pageType === 'details') && pathParts.length > 1) {
            const recordId = pathParts[ 1 ];
            return `${pageName}-${recordId}`;
        }

        // For list/dashboard pages, just use page name
        return pageName;
    }, [ location.pathname, pageConfig?.pageType ]);

    // Two-phase rendering: show a skeleton immediately on navigation, then mount
    // the heavy page content in a separate transition. This prevents React Router's
    // startTransition from keeping the old page visible for seconds.
    const [ mountedPageKey, setMountedPageKey ] = useState(pageKey);
    const [ , startContentTransition ] = useTransition();
    const isPageTransitioning = mountedPageKey !== pageKey;

    useEffect(() => {
        if (mountedPageKey !== pageKey) {
            // Let the skeleton paint for one frame, then schedule the heavy page render
            const id = requestAnimationFrame(() => {
                startContentTransition(() => {
                    setMountedPageKey(pageKey);
                });
            });
            return () => cancelAnimationFrame(id);
        }
    }, [ pageKey ]);

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

    // Show a lightweight skeleton during page transitions
    if (isPageTransitioning) {
        const skeletonType = pageConfig?.pageType === 'form' ? 'form'
            : pageConfig?.pageType === 'details' ? 'detail'
                : 'table';
        return <PageSkeleton type={skeletonType} />;
    }

    const content = (enhancedConfig?.private === true || (enhancedConfig?.private ?? true)) ? (
        <PostAuthPage key={pageKey} {...enhancedConfig} routeParams={params} />
    ) : (
        <h3>Define your page.</h3>
    );

    return content;
};