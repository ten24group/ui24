import React, { ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { App as AntdApp } from "antd";
import { ProtectedRoute } from './ProtectedRoute';
import { IRoute, IRoutes } from './types';
import { defaultRoutes } from './DefaultRoutes';
import { CoreLayout } from '../layout';
import { useUi24Config } from '../core/context';
import { ConfigLoader } from '../common/ConfigLoader';
import { ErrorBoundary } from 'react-error-boundary';

const ErrorFallback = ({ error }: { error: Error }) => {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre style={{ color: "red" }}>{error.message}</pre>
    </div>
  );
};

export type IAppRouter = { customRoutes?: IRoutes }

export const AppRouter = ({ customRoutes = [] }: IAppRouter) => {
  const { selectConfig } = useUi24Config();

  // Merge custom routes with default routes, giving precedence to custom ones
  const mergedRoutes = [ ...customRoutes, ...defaultRoutes ].reduce((acc: any, route: IRoute, index: number) => {
    acc[ route.path ] = <React.Fragment key={`route-${index}`}><Route path={route.path} element={
      <ProtectedRoute
        path={route.path}
        component={() => (
          <CoreLayout authType={route.authType}>
            {route.element}
          </CoreLayout>
        )}
        authType={route.authType}
      />
    } /> </React.Fragment>;
    return acc;
  }, {});

  return (
    <AntdApp>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <BrowserRouter>
          <ConfigLoader>
            <Routes>
              {Object.values(mergedRoutes)}
            </Routes>
          </ConfigLoader>
        </BrowserRouter>
      </ErrorBoundary>
    </AntdApp>
  );
};