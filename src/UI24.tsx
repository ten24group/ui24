import React from 'react';
import { App as AntdApp, ConfigProvider } from "antd";
import { BrowserRouter } from 'react-router-dom';
import enUS from 'antd/locale/en_US';

import { AppRouter, IAppRouter } from './routes/AppRouter';
import { Ui24ConfigProvider, AuthProvider, ApiProvider, ThemeProvider, AppContextProvider, AppStateProvider, AppStaticProvider } from './core/context';
import { ResponseModalProvider } from './core/context/ResponseModalContext';
import { IUi24Config } from './core/context';

type ConfigResolver<T extends unknown> = T // the config itself
    | string  // config url/endpoint
    | (() => Promise<T>) // a function that resolves the config

type IUI24 = {
    customRoutes?: IAppRouter[ "customRoutes" ];
    ui24config: IUi24Config
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
                                    {/* NEW: AppStaticProvider provides actor, device, tenant, feature flags */}
                                    <AppStaticProvider>
                                        {/* AppStateProvider transforms auth token into clean actor structure */}
                                        <AppStateProvider>
                                            <ApiProvider>
                                                <ResponseModalProvider>
                                                    <AppRouter customRoutes={customRoutes} />
                                                </ResponseModalProvider>
                                            </ApiProvider>
                                        </AppStateProvider>
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