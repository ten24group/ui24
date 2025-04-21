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
    const initConfig = useRef(false);

    // Get all config URLs at once
    const { auth: authConfigUrl } = selectConfig(config => config.uiConfig);
    const { pages: pageConfigUrl, menu: menuConfigUrl, dashboard } = selectConfig(config => config.uiConfig);
    const authConfig = selectConfig(config => config.auth?.verifyToken);
    const pagesConfig = selectConfig(config => config.pagesConfig || []);

    useEffect(() => {
        async function loadAllConfigs() {
            if (initConfig.current) return;
            initConfig.current = true;
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
                        validate?.data?.token ? login(validate.data.token) : logout();
                    }
                }

                // Load page configs if logged in and configs not loaded
                if (isLoggedIn && pagesConfig.length === 0) {
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
                }
            } catch (error) {
                console.error('Error loading configs:', error);
                // Handle error appropriately
            } finally {
                setLoader(false);
            }
        }

        loadAllConfigs();
    }, [isLoggedIn]); // Only dependency is isLoggedIn

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