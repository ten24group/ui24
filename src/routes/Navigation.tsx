import React, { useCallback, useRef } from 'react';
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

    // Ref to always read the latest prefix without recreating the callback.
    // appURLPrefix is typically constant, but this avoids stale closure issues.
    const prefixRef = useRef(appURLPrefix);
    prefixRef.current = appURLPrefix;

    const prefixedNavigate = useCallback((pathOrDelta: string | number, options?: NavigateOptions) => {
        if (typeof pathOrDelta === 'number') {
            return navigate(pathOrDelta);
        }
        return navigate(makePath(prefixRef.current, pathOrDelta), options);
    }, [ navigate ]);

    return prefixedNavigate;
}

export const CoreNavigate = ({ to }: { to: string }) => {
    const { selectConfig } = useUi24Config()
    const { appURLPrefix = "" } = selectConfig((config) => config);
    return <Navigate to={makePath(appURLPrefix, to)} />
}

