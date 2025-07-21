import React from 'react';
import { App as AntdApp, ConfigProvider } from "antd";
import enUS from 'antd/locale/en_US';

import { AppRouter, IAppRouter } from './routes/AppRouter';
import { Ui24ConfigProvider, AuthProvider, ApiProvider, ThemeProvider, AppContextProvider } from './core/context';
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
                <Ui24ConfigProvider initConfig={ui24config}>
                    <AppContextProvider>
                        <ThemeProvider>
                            <AuthProvider>
                                <ApiProvider>
                                    <AppRouter customRoutes={customRoutes} />
                                </ApiProvider>
                            </AuthProvider>
                        </ThemeProvider>
                    </AppContextProvider>
                </Ui24ConfigProvider>
            </AntdApp>
        </ConfigProvider>
    )
}
export { UI24 };