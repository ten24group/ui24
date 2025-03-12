import React from 'react';
import { Navigate, useNavigate, NavigateOptions } from 'react-router-dom';
import { useUi24Config } from '../core/context';

export * as CoreReactRouterDom from 'react-router-dom';

const makePath = (prefix: string, path: string): string => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const normalizedPrefix = prefix.startsWith('/') ? prefix.slice(1) : prefix;
    return `/${normalizedPrefix}${normalizedPath}`.replace(/\/+/g, '/');
}

export const useCoreNavigator = () => {

    const navigate = useNavigate();

    const { selectConfig } = useUi24Config()
    const { appURLPrefix = "" } = selectConfig((config) => config);

    const prefixedNavigate = (path: string, options?: NavigateOptions) => {
        return navigate(makePath(appURLPrefix, path), options);
    }

    return prefixedNavigate;
}

export const CoreNavigate = ({ to }: { to: string }) => {
    const { selectConfig } = useUi24Config()
    const { appURLPrefix = "" } = selectConfig((config) => config);
    return <Navigate to={makePath(appURLPrefix, to)} />
}

