import React, { createContext, useRef, useState, useEffect, ReactNode } from 'react';
import { useApi, useAuth, useUi24Config } from '../core/context';
import { Spin } from 'antd';
import { loadConfigs } from './utils';

const ConfigLoaderContext = createContext<undefined>(undefined);

export const ConfigLoader: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { selectConfig, updateConfig } = useUi24Config();
    const [loader, setLoader] = useState(false);
    const { callApiMethod } = useApi();
    const { login, logout, isLoggedIn } = useAuth();
    const initAuthConfig = useRef(false);
    const initPageConfig = useRef(false);

    // Get all config URLs at once
    const { auth: authConfigUrl } = selectConfig(config => config.uiConfig);
    const { pages: pageConfigUrl, menu: menuConfigUrl, dashboard } = selectConfig(config => config.uiConfig);
    const authConfig = selectConfig(config => config.auth?.verifyToken);
    const pagesConfig = selectConfig(config => config.pagesConfig || []);

    // Load auth config only once at startup
    useEffect(() => {
        async function loadAuthConfig() {
            if (initAuthConfig.current) return;
            initAuthConfig.current = true;
            setLoader(true);

            try {
                // Load auth config first if URL is provided
                if (typeof authConfigUrl === 'string') {
                    const [authResponse] = await loadConfigs(authConfigUrl);
                    updateConfig({
                        'uiConfig': {
                            ...selectConfig(config => config.uiConfig),
                            auth: authResponse
                        }
                    });
                }

                // Verify token if needed
                if (authConfig && isLoggedIn) {
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
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading auth config:', error);
            } finally {
                setLoader(false);
            }
        }

        loadAuthConfig();
    }, []); // Run only once at startup

    // Load page configs whenever login state changes
    useEffect(() => {
        async function loadPageConfigs() {
            if (!isLoggedIn || pagesConfig.length > 0) return;
            setLoader(true);

            try {
                const [pagesResponse, menuResponse, dashboardResponse] = await loadConfigs(
                    pageConfigUrl,
                    menuConfigUrl,
                    dashboard
                );

                updateConfig({
                    'pagesConfig': {
                        ...(pagesResponse ?? {}),
                        "dashboard": dashboardResponse
                    },
                    'menuItems': menuResponse || []
                });
            } catch (error) {
                console.error('Error loading page configs:', error);
            } finally {
                setLoader(false);
            }
        }

        loadPageConfigs();
    }, [isLoggedIn, pagesConfig.length]); // Reload when login state changes

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