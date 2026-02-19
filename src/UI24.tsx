import React from 'react';
import { App as AntdApp, ConfigProvider } from "antd";
import { BrowserRouter } from 'react-router-dom';
import enUS from 'antd/locale/en_US';

import { AppRouter, IAppRouter } from './routes/AppRouter';
import { Ui24ConfigProvider, AuthProvider, ApiProvider, ThemeProvider, AppContextProvider, AppStaticProvider } from './core/context';
import { ResponseModalProvider } from './core/context/ResponseModalContext';
import { IUi24Config } from './core/context';
import { IConditionSystemConfig } from './core/context/types';
import { setConditionSystemConfig } from './core/context/conditionSystemConfig';
import { setI18nResolver } from './core/types/evaluation';
import { QueryProvider } from './core/query/QueryProvider';
import './core/registry/field-types'; // Register built-in field types at startup
import { ConfigDevTools } from './core/devtools/ConfigDevTools';

// Log UI24 version on load
const UI24_VERSION = process.env.UI24_VERSION || 'unknown';
console.log(`%c[UI24] v${UI24_VERSION}`, 'color: #1890ff; font-weight: bold;');

type ConfigResolver<T extends unknown> = T // the config itself
    | string  // config url/endpoint
    | (() => Promise<T>) // a function that resolves the config

type IUI24 = {
    customRoutes?: IAppRouter[ "customRoutes" ];
    ui24config: IUi24Config
}

/**
 * Configure the condition system before React mounts.
 * Call this in your app's entry point before rendering <UI24 />.
 * 
 * @example
 * import { configure } from 'ui24';
 * 
 * configure({
 *   featureFlagProvider: { getFlags: () => ({ richText: true }) },
 *   tenantProvider: { getTenant: () => ({ tenantId: 'acme', name: 'Acme' }) },
 *   responsiveDevice: true,
 *   contextProviders: {
 *     subscription: { getContext: () => ({ tier: 'pro', isPro: true }) },
 *     preferences: { getContext: () => ({ locale: 'en-US', theme: 'dark' }) },
 *   },
 * });
 */
export function configure(config: IConditionSystemConfig): void {
  setConditionSystemConfig(config);
  if (config.i18nProvider) {
    setI18nResolver((key) => config.i18nProvider!.translate(key));
  }
}

const UI24 = ({ customRoutes = [], ui24config }: IUI24) => {

    return (
        <ConfigProvider locale={enUS}>
            <AntdApp>
                <BrowserRouter>
                    <Ui24ConfigProvider initConfig={ui24config}>
                        <AppContextProvider>
                            <ThemeProvider>
                                <AuthProvider>
                                    <AppStaticProvider>
                                            <ApiProvider>
                                                <QueryProvider>
                                                    <ResponseModalProvider>
                                                        <AppRouter customRoutes={customRoutes} />
                                                        <ConfigDevTools />
                                                    </ResponseModalProvider>
                                                </QueryProvider>
                                            </ApiProvider>
                                    </AppStaticProvider>
                                </AuthProvider>
                            </ThemeProvider>
                        </AppContextProvider>
                    </Ui24ConfigProvider>
                </BrowserRouter>
            </AntdApp>
        </ConfigProvider>
    )
}
export { UI24 };