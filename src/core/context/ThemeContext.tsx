import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { ConfigProvider, ThemeConfig as IAntThemeConfig } from 'antd';
import { useUi24Config } from './UI24Context';

interface IThemeContext {

}
const ThemeContext = createContext<IThemeContext | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { selectConfig } = useUi24Config()
    const themeConfig: IAntThemeConfig = selectConfig((config) => config.themeConfig);

    return <ThemeContext.Provider value={null}>
        <ConfigProvider
        theme={{...themeConfig}}
    > { children }</ConfigProvider>
        </ThemeContext.Provider>
}