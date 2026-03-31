import React from 'react';
import { App as AntdApp } from "antd";
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

import { AppRouter, IAppRouter } from './routes/AppRouter';
import { Ui24ConfigProvider, AuthProvider, ApiProvider, ThemeProvider, AppContextProvider, AppStaticProvider } from './core/context';
import { useUi24Config } from './core/context';
import { ResponseModalProvider } from './core/context/ResponseModalContext';
import { IUi24Config } from './core/context';
import { IConditionSystemConfig } from './core/context/types';
import { setConditionSystemConfig } from './core/context/conditionSystemConfig';
import { setI18nResolver } from './core/types/evaluation';
import { QueryProvider } from './core/query/QueryProvider';
import './core/registry/field-types'; // Register built-in field types at startup
import { IS_DEV } from './core/constants';
import { setThemePreference, initThemeStore } from './core/stores/theme';

const ConfigDevTools = React.lazy(() =>
    import('./core/devtools/ConfigDevTools').then(module => ({ default: module.ConfigDevTools }))
);

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

// Conditionally import SDK in dev only - webpack tree-shakes this in production
let initTracingIfDev: (() => void) | undefined;
let installErrorCaptureIfDev: (() => void) | undefined;
if (IS_DEV) {
    try {
        const { installErrorCapture } = require('./core/devtools/store/errors');
        installErrorCaptureIfDev = installErrorCapture;
    } catch {
        // errors module not available
    }
}

if (IS_DEV) {
    try {
        // Static import is safe here - webpack handles the code splitting
        const { initTracing } = require('./core/telemetry/sdk');
        initTracingIfDev = initTracing;
        console.debug('[UI24] OTel SDK loaded, will initialize on mount');
    } catch (err) {
        console.warn('[UI24] Failed to load OTel SDK:', err);
    }
}

/**
 * Inner component to handle theme initialization after config is loaded
 */
const UI24Inner: React.FC<{ customRoutes: IAppRouter[ 'customRoutes' ] }> = ({ customRoutes }) => {
    const { selectConfig } = useUi24Config();
    const appName = selectConfig(config => config.appName);
    const themeConfig = selectConfig(config => config.theme);

    const [ themeInitialized, setThemeInitialized ] = React.useState(false);

    // Initialize theme store with app namespace FIRST
    React.useEffect(() => {
        if (!appName) return;

        initThemeStore(appName);
        setThemeInitialized(true);

        // Apply default preference if user hasn't set one
        if (themeConfig?.defaultPreference) {
            const namespace = appName.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const storageKey = `ui24_${namespace}_theme_preference`;
            const storedPref = localStorage.getItem(storageKey);

            if (!storedPref) {
                setThemePreference(themeConfig.defaultPreference);
            }
        }
    }, [ appName, themeConfig?.defaultPreference ]);

    // Don't render until theme is initialized with proper namespace
    if (!themeInitialized) return null;

    return (
        <>
            <AppRouter customRoutes={customRoutes} />
            {IS_DEV && (
                <React.Suspense fallback={null}>
                    <ConfigDevTools />
                </React.Suspense>
            )}
        </>
    );
};

const UI24 = ({ customRoutes = [], ui24config }: IUI24) => {
    // Initialize tracing and error capture on app mount (dev only)
    React.useEffect(() => {
        if (installErrorCaptureIfDev) {
            try { installErrorCaptureIfDev(); } catch { /* ignore */ }
        }
        if (initTracingIfDev) {
            try {
                initTracingIfDev();
            } catch (err) {
                console.warn('[UI24] Failed to initialize OTel tracing:', err);
            }
        }
    }, []);

    return (
        <HelmetProvider>
            <BrowserRouter>
                <Ui24ConfigProvider initConfig={ui24config}>
                    <ThemeProvider>
                        <AntdApp>
                            <AppContextProvider>
                                <AuthProvider>
                                    <AppStaticProvider>
                                        <ApiProvider>
                                            <QueryProvider>
                                                <ResponseModalProvider>
                                                    <UI24Inner customRoutes={customRoutes} />
                                                </ResponseModalProvider>
                                            </QueryProvider>
                                        </ApiProvider>
                                    </AppStaticProvider>
                                </AuthProvider>
                            </AppContextProvider>
                        </AntdApp>
                    </ThemeProvider>
                </Ui24ConfigProvider>
            </BrowserRouter>
        </HelmetProvider>
    )
}
export { UI24 };