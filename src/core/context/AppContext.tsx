import React, { ReactNode, createContext, useCallback, useContext } from 'react';
import { App } from 'antd';
import type { NotificationArgsProps } from 'antd';

// ============================================================================
// TYPES
// ============================================================================

type NotifyLevel = 'success' | 'error' | 'warning' | 'info';

export interface NotifyOptions {
    /** Primary message text */
    message: string;
    /** Secondary description (shown below message in notification cards) */
    description?: string;
    /** Display method: 'message' = top toast bar, 'notification' = corner card */
    type?: 'message' | 'notification';
    /** Auto-close duration in seconds (default: 3 for message, 4.5 for notification) */
    duration?: number;
    /** Corner placement for notification cards (ignored for message toasts) */
    placement?: NotificationArgsProps['placement'];
}

interface AppContext {
    notifyError: (message: string) => void;
    notifySuccess: (message: string) => void;
    notifyWarning: (message: string) => void;
    notifyInfo: (message: string) => void;
    notifyLoading: (message: string) => void;
    /** Config-driven notification with full control over type, duration, placement */
    notify: (level: NotifyLevel, options: NotifyOptions) => void;
}

const AppContext = createContext<AppContext>({} as AppContext);

export function AppContextProvider({ children }: { children?: ReactNode }) {

    const { message: messageHandler, notification: notificationHandler } = App.useApp();

    const notify = useCallback((level: NotifyLevel, options: NotifyOptions) => {
        if (options.type === 'notification') {
            notificationHandler[level]({
                message: options.message,
                description: options.description,
                duration: options.duration,
                placement: options.placement || 'topRight',
            });
        } else {
            messageHandler[level]({
                content: options.message,
                duration: options.duration,
            });
        }
    }, [messageHandler, notificationHandler]);

    const notifySuccess = useCallback((message: string) => {
        messageHandler.success(message);
    }, [messageHandler]);

    const notifyError = useCallback((message: string) => {
        messageHandler.error(message);
    }, [messageHandler]);

    const notifyWarning = useCallback((message: string) => {
        messageHandler.warning(message);
    }, [messageHandler]);

    const notifyInfo = useCallback((message: string) => {
        messageHandler.info(message);
    }, [messageHandler]);

    const notifyLoading = useCallback((message: string) => {
        messageHandler.loading(message);
    }, [messageHandler]);

    return <AppContext.Provider value={{ notifySuccess, notifyError, notifyWarning, notifyInfo, notifyLoading, notify }}>
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