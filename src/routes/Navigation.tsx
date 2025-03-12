import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useUi24Config } from '../core/context';

export const useCoreNavigator = () => {
    const navigate = useNavigate();
    const { selectConfig } =  useUi24Config()
    const { appURLPrefix = "" } = selectConfig( (config) => config );

    //check if path has slash at start
    const hasTrailingSlash = (path: string) => path.startsWith("/")

    const prefixedNavigate = (path: string, options?: { replace?: boolean; state?: any }) => navigate(appURLPrefix ? `/${appURLPrefix}` + (hasTrailingSlash(path) ? path : `/${path}`) : path, options);
    return prefixedNavigate;
}

export const CoreNavigator = ({ to }  : { to: string }) => {
    const { selectConfig } =  useUi24Config()
    const { appURLPrefix = "" } = selectConfig( (config) => config );

    const hasTrailingSlash = (to: string) => to.startsWith("/")

    return <Navigate to={ appURLPrefix ? `/${appURLPrefix}` + ( hasTrailingSlash ? to : `/${to}`) : `${to}` } />
}

