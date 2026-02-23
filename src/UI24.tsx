import React, { useMemo } from 'react';
import { App as AntdApp, ConfigProvider, theme as antdTheme } from "antd";
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
import { IS_DEV } from './core/constants';
import { useThemeMode } from './core/stores/theme';

// Lazy load ConfigDevTools to avoid bundling it in production
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

// Wrap ConfigProvider to react to dark/light mode changes.
// cssVar:true ensures antd injects CSS custom properties (--ant-color-bg-container etc.)
// into the DOM so that non-component CSS files (Table.css, Details.css, widgets) can
// reference them via var(--ant-color-*) and automatically respond to theme switches.
// hashed:false uses stable class names — avoids re-hashing styles on every component remount.
const ThemeConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const mode = useThemeMode();
    const themeConfig = useMemo(
        () => mode === 'dark'
            ? { cssVar: true, hashed: false as const, algorithm: antdTheme.darkAlgorithm }
            : { cssVar: true, hashed: false as const },
        [ mode ]
    );
    return (
        <ConfigProvider locale={enUS} theme={themeConfig}>
            {children}
        </ConfigProvider>
    );
};

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
        <ThemeConfigProvider>
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
                                                    {IS_DEV && (
                                                        <React.Suspense fallback={null}>
                                                            <ConfigDevTools />
                                                        </React.Suspense>
                                                    )}
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
        </ThemeConfigProvider>
    )
}
export { UI24 };