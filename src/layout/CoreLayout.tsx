import React, { ReactNode } from 'react';
import { Layout } from 'antd';
import { AppContextProvider } from '../core/context/AppContext';

export const CoreLayout = ({children} : { children? : ReactNode } ) => {
    
    return <Layout style={{ minHeight: '100vh' }}>
        <AppContextProvider>
            {children}
        </AppContextProvider>
    </Layout>
}