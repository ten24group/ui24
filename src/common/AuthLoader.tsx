import React, { createContext, useRef, useState, useEffect, ReactNode } from 'react';
import { useApi, useAuth, useUi24Config } from '../core/context';
import { Spin } from 'antd';
import { loadConfigs } from './utils';

const AuthLoaderContext = createContext<undefined>(undefined);

export const AuthLoader: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { selectConfig, updateConfig }  = useUi24Config()
    const [ loader, setLoader ] = useState(false)
    const { callApiMethod } = useApi()
    const { login, logout, isLoggedIn } = useAuth();

    const authConfig = selectConfig( (config) => config.auth?.verifyToken );

    const { auth: authConfigUrl } = selectConfig( (config) => config.uiConfig )

    const initAuth = useRef(false)
    
    useEffect( () => {
        async function verifyToken() {
            setLoader( true )
            
            const validate = await callApiMethod({
                apiUrl: authConfig?.apiConfig?.apiUrl,
                apiMethod: authConfig?.apiConfig?.apiMethod
            })

            if( validate.status === 200) {
                validate?.data?.token ? login(validate?.data?.token) : logout()
            }
            

            setLoader( false )
        }

        async function loadPagesConfig() {
            const resolver  = await loadConfigs(authConfigUrl)
            const { [0] : response } = resolver

            const localUiConfig = selectConfig( (config) => config.uiConfig )
            const configPayload = {
                'uiConfig': {...localUiConfig, auth: response },
            }

            updateConfig( configPayload )
        }

        if (!initAuth.current) {
            initAuth.current = true
            //make API call to verify token
            // if( !!authConfig )
            //     verifyToken()
            if( typeof authConfigUrl === 'string' ) {
                loadPagesConfig()
            }

        }
    }, [isLoggedIn] )

    

    return (
        <AuthLoaderContext.Provider value={undefined}>
            <Spin spinning={loader} style={{ paddingTop: '25%', display: 'flex',justifyContent: 'center', alignContent: 'center'}}>
                {children}
            </Spin>
        </AuthLoaderContext.Provider>
      );
}