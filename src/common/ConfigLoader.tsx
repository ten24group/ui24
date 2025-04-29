import React, { createContext, useRef, useState, useEffect, ReactNode } from 'react';
import { useApi, useAuth, useUi24Config } from '../core/context';
import { Spin } from 'antd';
import { loadConfigs } from './utils';

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
    const [loader, setLoader] = useState(false);
    const { callApiMethod } = useApi();
    const { login, logout, isLoggedIn } = useAuth();
    const configLoadedRef = useRef(false);
    const authConfigLoadedRef = useRef(false);

    // Get all config URLs at once
    const { auth: authConfigUrl } = selectConfig(config => config.uiConfig);
    const { pages: pageConfigUrl, menu: menuConfigUrl, dashboard } = selectConfig(config => config.uiConfig);
    const authConfig = selectConfig(config => config.auth?.verifyToken);
    const pagesConfig = selectConfig(config => config.pagesConfig || []);

    // Load auth config separately as it's needed for the login page
    useEffect(() => {
        async function loadAuthConfig() {
            if (authConfigLoadedRef.current) return;
            setLoader(true);

            try {
                if (typeof authConfigUrl === 'string') {
                    const authResponse = await dedupeRequest(authConfigUrl, () => loadConfigs(authConfigUrl));
                    updateConfig({
                        'uiConfig': {
                            ...selectConfig(config => config.uiConfig),
                            auth: authResponse[0]
                        }
                    });
                    authConfigLoadedRef.current = true;
                }
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
            if (!isLoggedIn || configLoadedRef.current || pagesConfig.length > 0) return;
            setLoader(true);

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
                const [pagesResponse, menuResponse, dashboardResponse] = await Promise.all([
                    dedupeRequest(pageConfigUrl, () => loadConfigs(pageConfigUrl)),
                    dedupeRequest(menuConfigUrl, () => loadConfigs(menuConfigUrl)),
                    dedupeRequest(dashboard, () => loadConfigs(dashboard))
                ]).then(responses => responses.map(r => r[0]));

                updateConfig({
                    'pagesConfig': {
                        ...(pagesResponse ?? {}),
                        "dashboard": dashboardResponse
                    },
                    'menuItems': menuResponse || []
                });

                configLoadedRef.current = true;
            } catch (error) {
                console.error('Error loading configs:', error);
            } finally {
                setLoader(false);
            }
        }

        loadAppConfigs();
    }, [isLoggedIn]); // Only depend on login state

    return (
        <ConfigLoaderContext.Provider value={undefined}>
            <Spin spinning={loader} style={{ 
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