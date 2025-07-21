import React, { ReactNode, createContext, useContext, useState } from 'react';
import { App } from 'antd';

interface AppContext {
    notifyError: (message: string) => void;
    notifySuccess: (message: string) => void;
    notifyWarning: (message: string) => void;
    notifyInfo: (message: string) => void;
    notifyLoading: (message: string) => void;
};
const AppContext = createContext<AppContext>({} as AppContext);

export function AppContextProvider({ children }: { children?: ReactNode }) {

    const { message: messageHandler, modal: modalHandler, notification: notificationHandler } = App.useApp();


    const notifySuccess = (message: string) => {
        // * notification does not work when navigating from one page to another
        // api.success({ message: message, duration: 2 })
        messageHandler.success(message)
    }

    const notifyError = (message: string) => {
        // api.error({ message: message, duration: 2 });
        messageHandler.error(message)
    }

    const notifyWarning = (message: string) => {
        messageHandler.warning(message)
    }

    const notifyInfo = (message: string) => {
        messageHandler.info(message)
    }

    const notifyLoading = (message: string) => {
        messageHandler.loading(message)
    }

    return <AppContext.Provider value={{ notifySuccess, notifyError, notifyWarning, notifyInfo, notifyLoading }}>
        {children}
    </AppContext.Provider>
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within a AppContextProvider');
    }
    return context;
}