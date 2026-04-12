import React, { createContext, useState, useContext, useMemo, useCallback, useRef } from 'react';
import { IApiConfig } from './ApiContext';
import { ThemeConfig as IAntThemeConfig } from 'antd';

export type IConfigResolver<T extends unknown> = T // the config itself
  | string  // config url/endpoint
  | (() => Promise<T>) // a function that resolves the config

interface IFormatConfig {
  date?: string;
  time?: string;
  datetime?: string;
  boolean?: {
    true: string; // YES, TRUE, ACTIVE
    false: string; // NO, FALSE, INACTIVE
  };
  timezone?: string; // e.g. 'America/New_York'
  /**
   * How date/datetime/time values are shown across Details, tables, and formatDate().
   * @default primaryZone: 'local' (browser IANA zone), showUtcSecondary: true when local ≠ UTC
   */
  dateTimeDisplay?: {
    /** Which zone to use for the main formatted string */
    primaryZone?: 'local' | 'utc' | 'source';
    /** When primary is local (or source non-UTC), show an extra UTC line / tooltip */
    showUtcSecondary?: boolean;
  };
}

export interface IEnvironmentConfig {
  /** Environment label shown in the banner (e.g., "STAGING", "DEV") */
  name: string;
  /** Show a thin colored strip at the top of the page */
  showBanner?: boolean;
  /** Banner background color (CSS color string, default: '#faad14' amber) */
  color?: string;
  /** Prepend environment name to document title */
  titlePrefix?: boolean;
}

export interface IMaintenanceConfig {
  /** When true, app shows maintenance message instead of normal content */
  enabled: boolean;
  /** Custom maintenance message (default: "We're performing scheduled maintenance…") */
  message?: string;
  /** Roles that bypass maintenance mode (e.g., ['admin']) */
  allowedRoles?: string[];
}

export interface IErrorPagesConfig {
  notFound?: { title?: string; message?: string; showHomeLink?: boolean };
  forbidden?: { title?: string; message?: string; showHomeLink?: boolean };
}

/**
 * Theme configuration
 */
export interface IThemeConfig {
  /**
   * Show theme options in secondary menu
   * @default true
   */
  showSwitcher?: boolean;

  /**
   * Default theme preference
   * - 'system': Follow OS theme (default)
   * - 'light': Always light
   * - 'dark': Always dark
   * @default 'system'
   */
  defaultPreference?: 'system' | 'light' | 'dark';
}

export type IUi24Config = {
  baseURL: string;
  appURLPrefix?: string;
  appLogo: string;
  companyName?: string;
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
  /** Theme switcher configuration */
  theme?: IThemeConfig;
  /** Environment indicator (banner, title prefix) */
  environment?: IEnvironmentConfig;
  /** Maintenance mode gate */
  maintenance?: IMaintenanceConfig;
  /** Custom error page content */
  errorPages?: IErrorPagesConfig;
  /** Command Palette (Cmd+K) configuration (#63) */
  commandPalette?: {
    /** Enable/disable the command palette (default: true) */
    enabled?: boolean;
    /** Keyboard trigger (default: 'mod+k') */
    trigger?: string;
    /** Number of recent items to show (default: 5) */
    recentCount?: number;
    /** Entity search configuration */
    entitySearch?: {
      enabled?: boolean;
      /** Restrict to specific entities (default: all) */
      entities?: string[];
      /** Max results per entity (default: 5) */
      maxResults?: number;
    };
  };
}

interface IUi24Context {
  config: IUi24Config;
  updateConfig: (newConfig: Partial<IUi24Config>) => void;
  selectConfig: (selector: any) => any
  getPageConfig: (pageName: string) => any
}

const Ui24Context = createContext<IUi24Context>({} as IUi24Context);

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

  // Use initConfig as the initial state, but deep-merge formatConfig
  const [ config, setConfig ] = useState<IUi24Config>({
    ...initConfig,
    formatConfig: { ...defaultFormatConfig, ...(initConfig?.formatConfig || {}) }
  });

  const updateConfig = useCallback((newConfig: Partial<IUi24Config>) => {
    setConfig(prevConfig => ({ ...prevConfig, ...newConfig }));
  }, []);

  // Config ref for stable selectConfig that always reads latest config
  const configRef = useRef(config);
  configRef.current = config;

  const selectConfig = useCallback(<T extends keyof IUi24Config>(selector: (config: IUi24Config) => T): IUi24Config[ T ] => {
    return selector(configRef.current);
  }, []);

  const getPageConfig = useCallback((pageName: string) => {
    const pagesConfig = configRef.current?.pagesConfig;
    if (pagesConfig && Object.keys(pagesConfig).length > 0) {
      return pagesConfig[ pageName ];
    }
  }, []);

  const contextValue = useMemo(() => ({
    config,
    updateConfig,
    selectConfig,
    getPageConfig
  }), [ config, updateConfig, selectConfig, getPageConfig ]);

  return <Ui24Context.Provider value={contextValue}>
    {children}
  </Ui24Context.Provider>
}

export const useUi24Config = () => {
  const context = useContext(Ui24Context);
  if (!context) {
    throw new Error('useUi24Config must be used within a Ui24ConfigProvider');
  }
  return context;
};

export { Ui24ConfigProvider, Ui24Context }
