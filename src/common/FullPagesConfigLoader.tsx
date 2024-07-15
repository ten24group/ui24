import React, { createContext, useRef, useState, useEffect, ReactNode } from 'react';
import { useAuth, useUi24Config } from '../core/context';
import { Spin } from 'antd';
import { loadConfigs } from './utils';

const FullPagesConfigLoaderContext = createContext<undefined>(undefined);

export const FullPagesConfigLoader: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { selectConfig, updateConfig }  = useUi24Config()
    const [ loader, setLoader ] = useState(false)
    const { isLoggedIn } = useAuth()

    const pagesConfig = selectConfig( ( config ) => config.pagesConfig || [] )

    const { pages: pageConfigUrl, menu : menuConfigUrl, dashboard } = selectConfig( (config) => config.uiConfig )
    const initPageConfig = useRef(false)

    useEffect( () => {

        async function loadPagesConfig() {
            setLoader( true )
            
            const resolver  = await loadConfigs(pageConfigUrl, menuConfigUrl, dashboard)
            const { [0] : response, [1] : menuResponse, [2]: dashboardResponse } = resolver

            const configPayload = {
                'pagesConfig': {...response, "dashboard": dashboardResponse} || {},
                'menuItems': menuResponse || []
            }

            updateConfig( configPayload )
            
            setLoader( false )
        }

        if( !initPageConfig.current && isLoggedIn ) {
            initPageConfig.current = true
            if( pagesConfig.length === 0 ) {
                loadPagesConfig()
            }
        }
    }, [isLoggedIn] )

    

    return (
        <FullPagesConfigLoaderContext.Provider value={undefined}>
            <Spin spinning={loader} style={{ paddingTop: '25%', display: 'flex',justifyContent: 'center', alignContent: 'center'}}>
                {children}
            </Spin>
        </FullPagesConfigLoaderContext.Provider>
      );
}