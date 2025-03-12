import React, { ReactNode } from 'react';
import { Layout } from 'antd';
import { AuthLayout } from './AuthLayout/AuthLayout';
import { PublicLayout } from './PublicLayout/PublicLayout';
import { PrivateLayout } from './PrivateLayout/PrivateLayout';
import { IRouteAuthType } from '../routes/types';
import { useUi24Config } from '../core/context';

export const CoreLayout = ({ children, authType = "public" }: { children?: ReactNode, authType?: IRouteAuthType }) => {
    const { selectConfig } = useUi24Config()
    const layouts = selectConfig((config) => config.layouts)

    // Determine which layout to use based on route type
    const getLayoutComponent = (type: IRouteAuthType) => {
        switch (type) {
            case "auth":
                return layouts?.authLayout || AuthLayout;
            case "public":
                return layouts?.publicLayout || PublicLayout;
            case "private":
                return layouts?.privateLayout || PrivateLayout;
            default:
                return AuthLayout;
        }
    };

    const WrapperLayout = getLayoutComponent(authType);

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <WrapperLayout>
                {children}
            </WrapperLayout>
        </Layout>
    )
}