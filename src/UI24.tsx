import React from 'react';
import { AppRouter, IAppRouter } from './routes/AppRouter';
import { Ui24ConfigProvider, AuthProvider, ApiProvider, IApiConfig } from './core/context';

type ConfigResolver<T extends unknown> = T // the config itself
| string  // config url/endpoint
| ( () => Promise<T> ) // a function that resolves the config

type IUI24 = {
    customRoutes?: IAppRouter["customRoutes"];
    ui24config: {
        baseURL: string;
        appLogo: string;
        uiConfig: {
            auth: ConfigResolver<any>,
            menu: ConfigResolver<any>,
            pages: ConfigResolver<any>;
            dashboard: ConfigResolver<any>;
        }
        appName: string;
        layouts: {
            authLayout: React.ReactNode;
            publicLayout: React.ReactNode;
            privateLayout: React.ReactNode;
        }
        auth?: {
            verifyToken: IApiConfig
            redirectUrl?: string
        }
        routes: Array<{
            route: string;
            section: React.ReactNode;
            authType: "auth" | "public" | "private";
        }>
        authProvider: string;
        //customerInfo: any;
        apiConfig: any;
    }
}

const UI24 = ({ customRoutes = [], ui24config }: IUI24 ) => {
    
    return <Ui24ConfigProvider initConfig={ ui24config }>
        <AuthProvider>
            <ApiProvider>
                <AppRouter customRoutes = { customRoutes } />
            </ApiProvider>
        </AuthProvider>
    </Ui24ConfigProvider>
}
export { UI24 };