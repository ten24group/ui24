import React, { createContext, useMemo, ReactNode } from 'react';

import { ConfigProvider, ThemeConfig as IAntThemeConfig, theme as antdTheme } from 'antd';
import enUS from 'antd/locale/en_US';
import { useUi24Config } from './UI24Context';
import { useThemeMode } from '../stores/theme';

interface IThemeContext { }
const ThemeContext = createContext<IThemeContext | undefined>(undefined);

/**
 * Merges app-provided themeConfig (tokens, component overrides) with the
 * dark/light mode algorithm from the theme store into a single ConfigProvider.
 */
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { selectConfig } = useUi24Config();
    const appThemeConfig: IAntThemeConfig | undefined = selectConfig((config) => config.themeConfig);
    const mode = useThemeMode();

    const mergedTheme = useMemo<IAntThemeConfig>(() => {
        const base: IAntThemeConfig = {
            cssVar: true,
            hashed: false,
            ...(appThemeConfig ?? {}),
        };
        if (mode === 'dark') {
            base.algorithm = antdTheme.darkAlgorithm;
        }
        return base;
    }, [ appThemeConfig, mode ]);

    return (
        <ThemeContext.Provider value={null}>
            <ConfigProvider locale={enUS} theme={mergedTheme}>
                {children}
            </ConfigProvider>
        </ThemeContext.Provider>
    );
}