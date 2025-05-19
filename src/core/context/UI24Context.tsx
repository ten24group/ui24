import React, { createContext, useState, useContext, useMemo, useCallback } from 'react';
import { IApiConfig } from './ApiContext';
import { ThemeConfig as IAntThemeConfig } from 'antd';

export type IConfigResolver<T extends unknown> = T // the config itself
| string  // config url/endpoint
| ( () => Promise<T> ) // a function that resolves the config

interface IFormatConfig {
  date?: string;
  time?: string;
  datetime?: string;
  boolean?: {
      true: string; // YES, TRUE, ACTIVE
      false: string; // NO, FALSE, INACTIVE
  };
  timezone?: string; // e.g. 'America/New_York'
}

export type IUi24Config = {
    baseURL: string;
    appURLPrefix?: string;
    appLogo: string;
    uiConfig: {
        auth: IConfigResolver<any>,
        menu: IConfigResolver<any>,
        pages: IConfigResolver<any>;
        dashboard: IConfigResolver<any>;
    }
    appName: string;
    layouts?: {
        authLayout?: React.ReactNode;
        publicLayout?: React.ReactNode;
        privateLayout?: React.ReactNode;
    },
    auth?: {
      verifyToken: {
        apiConfig: IApiConfig
      }
    },
    routes?: Array<{
        route: string;
        section: React.ReactNode;
        authType: "auth" | "public" | "private";
    }>
    authProvider?: any;
    //customerInfo: any;
    apiConfig?: any;
    menuItems?: Array<any>
    pagesConfig?: Record<string, any>
    formatConfig?: IFormatConfig 
    themeConfig?: IAntThemeConfig
}

interface IUi24Context {
    config: IUi24Config;
    updateConfig: (newConfig: Partial<IUi24Config>) => void;
    selectConfig: (selector: any) => any
    getPageConfig: ( pageName: string ) => any
}

const Ui24Context = createContext<IUi24Context>(null);

const Ui24ConfigProvider = ({ children, initConfig }) => {
    const defaultFormatConfig: IFormatConfig = {
      date: "YYYY-MM-DD",
      time: "hh:mm A",
      datetime: "YYYY-MM-DD hh:mm A",
      boolean: {
        true: "YES",
        false: "NO"
      },
      timezone: 'America/New_York'
    }
    
    // Use initConfig as the initial state
    const [config, setConfig] = useState<IUi24Config>({ formatConfig: defaultFormatConfig, ...initConfig});

    // Memoize the update function
    const updateConfig = useCallback((newConfig: Partial<IUi24Config>) => {
        setConfig(prevConfig => ({ ...prevConfig, ...newConfig }));
    }, []);

    // Memoize the selector function
    const selectConfig = useCallback(<T extends keyof IUi24Config>(selector: (config: IUi24Config) => T): IUi24Config[T] => {
      return selector(config);
    }, [config]);

    // Memoize the page config getter
    const getPageConfig = useCallback(( pageName: string ) => {
      if( config?.pagesConfig && Object.keys(config?.pagesConfig).length > 0 ) {
        return config?.pagesConfig[pageName]
      }
    }, [config?.pagesConfig]);

    // Memoize the context value
    const contextValue = useMemo(() => ({
      config,
      updateConfig,
      selectConfig,
      getPageConfig
    }), [config, updateConfig, selectConfig, getPageConfig]);

    return <Ui24Context.Provider value={contextValue}>
        {children}
    </Ui24Context.Provider>
}

export const useUi24Config = () => {
    const context = useContext(Ui24Context);
    if (!context) {
      throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
  };

export { Ui24ConfigProvider, Ui24Context }
