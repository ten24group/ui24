import React, { ReactNode, createContext, useContext, useState } from 'react';
import { Layout, notification} from 'antd';

const AppContext = createContext<any>(null);

export function AppContextProvider({ children } : { children?: ReactNode }) {
    const [ api, contextHolder ] = notification.useNotification();

    const notifySuccess = ( message: string ) => {
        api.success({ message: message, duration: 2 })
    }

    const notifyError = ( message: string ) => {
        api.error({ message: message, duration: 2 })
    }
    
    return <AppContext.Provider value={{notifySuccess, notifyError }}>
        <React.Fragment> { contextHolder } </React.Fragment>
        { children }
    </AppContext.Provider>
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (!context) {
      throw new Error('useAppContext must be used within a AppContextProvider');
    }
    return context;
  }