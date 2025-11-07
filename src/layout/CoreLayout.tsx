import React, { ReactNode, useMemo } from 'react';
import { Layout } from 'antd';
import { AuthLayout } from './AuthLayout/AuthLayout';
import { PublicLayout } from './PublicLayout/PublicLayout';
import { PrivateLayout } from './PrivateLayout/PrivateLayout';
import { IRouteAuthType } from '../routes/types';
import { useUi24Config } from '../core/context';

export const CoreLayout = ({ children, authType = "public" }: { children?: ReactNode, authType?: IRouteAuthType }) => {
    const { selectConfig } = useUi24Config()
    const layouts = selectConfig((config) => config.layouts)

    // Memoize the layout component to prevent unnecessary re-renders
    const WrapperLayout = useMemo(() => {
        switch (authType) {
            case "auth":
                return layouts?.authLayout || AuthLayout;
            case "public":
                return layouts?.publicLayout || PublicLayout;
            case "private":
                return layouts?.privateLayout || PrivateLayout;
            default:
                return AuthLayout;
        }
    }, [authType, layouts]);

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <WrapperLayout>
                {children}
            </WrapperLayout>
        </Layout>
    )
}