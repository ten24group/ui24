import React, { createContext, useRef, useState, useEffect, ReactNode } from 'react';
import { useApi, useAuth, useUi24Config } from '../core/context';
import { Spin } from 'antd';

const AuthLoaderContext = createContext<undefined>(undefined);

export const AuthLoader: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { selectConfig }  = useUi24Config()
    const [ loader, setLoader ] = useState(false)
    const { callApiMethod } = useApi()
    const { login, logout, isLoggedIn } = useAuth();

    const authConfig = selectConfig( (config) => config.auth?.verifyToken );

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

        if (!initAuth.current) {
            initAuth.current = true
            //make API call to verify token
            if( !!authConfig )
                verifyToken()
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