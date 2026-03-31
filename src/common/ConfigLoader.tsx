import React, { createContext, useRef, useState, useEffect, ReactNode } from 'react';
import { useApi, useAuth, useUi24Config } from '../core/context';
import { Spin } from 'antd';
import { loadConfigs } from './utils';
import { instrument } from '../core/telemetry';
import { validatePagesConfig, setValidationIssues } from '../core/validation/configValidator';
import { fieldTypeRegistry } from '../core/registry/FieldTypeRegistry';
import { ExtensionRegistry } from '../core/registry/ExtensionRegistry';
import { IS_DEV } from '../core/constants';

const ConfigLoaderContext = createContext<undefined>(undefined);

// Track ongoing requests to prevent duplicates
const pendingRequests = new Map<string, Promise<any>>();

const dedupeRequest = async (url: string, loadFn: () => Promise<any>) => {
    if (!pendingRequests.has(url)) {
        pendingRequests.set(url, loadFn().finally(() => {
            pendingRequests.delete(url);
        }));
    }
    return pendingRequests.get(url);
};

export const ConfigLoader: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { selectConfig, updateConfig } = useUi24Config();
    const [ loader, setLoader ] = useState(false);
    const { callApiMethod } = useApi();
    const { login, logout, isLoggedIn } = useAuth();
    const configLoadedRef = useRef(false);
    const [ authConfigLoaded, setAuthConfigLoaded ] = useState(false);
    const [ configStaleFlag, setConfigStaleFlag ] = useState(0);

    // Get all config URLs at once
    const { auth: authConfigUrl } = selectConfig(config => config.uiConfig);
    const { pages: pageConfigUrl, menu: menuConfigUrl, dashboard } = selectConfig(config => config.uiConfig);
    const authConfig = selectConfig(config => config.auth?.verifyToken);
    const pagesConfig = selectConfig(config => config.pagesConfig || {});

    // Load auth config separately as it's needed for the login page.
    // When auth is a direct object (not a URL), mark loaded immediately.
    useEffect(() => {
        if (authConfigLoaded) return;

        if (typeof authConfigUrl !== 'string') {
            setAuthConfigLoaded(true);
            return;
        }

        async function loadAuthConfig() {
            setLoader(true);
            try {
                const authResponse = await dedupeRequest(authConfigUrl as string, () => loadConfigs(authConfigUrl as string));
                updateConfig({
                    'uiConfig': {
                        ...selectConfig(config => config.uiConfig),
                        auth: authResponse[ 0 ]
                    }
                });
                setAuthConfigLoaded(true);
            } catch (error) {
                console.error('Error loading auth config:', error);
            } finally {
                setLoader(false);
            }
        }

        loadAuthConfig();
    }, []); // Load auth config on mount

    // Load other configs after login
    useEffect(() => {
        async function loadAppConfigs() {
            if (!isLoggedIn || configLoadedRef.current) return;
            setLoader(true);

            const configSpan = instrument.begin('config.load', 'async', {
                'config.phase': 'app',
                'span.level': 'info',
            });

            try {
                // Verify token if needed
                if (authConfig) {
                    try {
                        const validate = await callApiMethod({
                            apiUrl: authConfig.apiConfig.apiUrl,
                            apiMethod: authConfig.apiConfig.apiMethod
                        });

                        if (validate.status === 200) {
                            const data = validate.data as { token?: string };
                            if (data?.token) {
                                login(data.token);
                            } else {
                                logout();
                                return; // Don't load other configs if auth failed
                            }
                        }
                    } catch (error) {
                        console.error('Token verification failed:', error);
                        logout();
                        return; // Don't load other configs if auth failed
                    }
                }

                // Load all other configs in parallel
                const [ pagesResponse, menuResponse, dashboardResponse ] = await Promise.all([
                    dedupeRequest(pageConfigUrl, () => loadConfigs(pageConfigUrl)),
                    dedupeRequest(menuConfigUrl, () => loadConfigs(menuConfigUrl)),
                    dedupeRequest(dashboard, () => loadConfigs(dashboard))
                ]).then(responses => responses.map(r => r[ 0 ]));

                const mergedPagesConfig = {
                    ...(pagesResponse ?? {}),
                    "dashboard": dashboardResponse,
                };

                updateConfig({
                    'pagesConfig': mergedPagesConfig,
                    'menuItems': menuResponse || []
                });

                // Config validation (#9): run at load time in dev, report to store
                if (IS_DEV) {
                    const knownFieldTypes = new Set([
                        ...Object.keys(fieldTypeRegistry.listAll()),
                        ...ExtensionRegistry.getRegisteredFieldTypeKeys(),
                    ]);
                    const issues = validatePagesConfig(mergedPagesConfig, knownFieldTypes);
                    setValidationIssues(issues);
                    const errors = issues.filter(i => i.severity === 'error');
                    const warnings = issues.filter(i => i.severity === 'warning');
                    if (errors.length > 0) {
                        console.error(`[ui24] Config validation: ${errors.length} error(s), ${warnings.length} warning(s). Open DevTools → Warnings for details.`);
                    } else if (warnings.length > 0) {
                        console.warn(`[ui24] Config validation: ${warnings.length} warning(s). Open DevTools → Warnings for details.`);
                    }
                }

                configSpan.setAttribute('config.pagesCount', Object.keys(pagesResponse ?? {}).length);
                configSpan.setAttribute('config.menuItemsCount', (menuResponse || []).length);
                configSpan.setAttribute('config.loaded', true);

                configLoadedRef.current = true;
            } catch (error) {
                console.error('Error loading configs:', error);
                configSpan.setAttribute('span.level', 'error');
            } finally {
                configSpan.end();
                setLoader(false);
            }
        }

        loadAppConfigs();
    }, [ isLoggedIn, configStaleFlag ]); // configStaleFlag triggers reload after visibility stale

    // Reload config when the user returns to the tab after being away (#5).
    // Only triggers if the tab was hidden for at least 1 hour.
    const lastVisibleRef = useRef(Date.now());
    useEffect(() => {
        if (!isLoggedIn || !configLoadedRef.current) return;
        const STALE_THRESHOLD = 60 * 60 * 1000; // 1 hour

        const handleVisibilityChange = () => {
            if (document.hidden) {
                lastVisibleRef.current = Date.now();
            } else if (Date.now() - lastVisibleRef.current > STALE_THRESHOLD) {
                configLoadedRef.current = false;
                setConfigStaleFlag(prev => prev + 1);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [ isLoggedIn ]);

    const shouldShowLoader = !authConfigLoaded || loader;

    return (
        <ConfigLoaderContext.Provider value={undefined}>
            <Spin spinning={shouldShowLoader} style={{
                paddingTop: '25%',
                display: 'flex',
                justifyContent: 'center',
                alignContent: 'center'
            }}>
                {children}
            </Spin>
        </ConfigLoaderContext.Provider>
    );
}; 