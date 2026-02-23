import React, { useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { IRoute, IRoutes } from './types';
import { defaultRoutes } from './DefaultRoutes';
import { CoreLayout } from '../layout';
import { ConfigLoader } from '../common/ConfigLoader';
import { ErrorBoundary } from 'react-error-boundary';
import { toErrorMessage } from '../core/common/ErrorFallback';
import type { FallbackProps } from 'react-error-boundary';

const ErrorFallback = ({ error }: FallbackProps) => {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre style={{ color: "red" }}>{toErrorMessage(error)}</pre>
    </div>
  );
};

export type IAppRouter = { customRoutes?: IRoutes }

// Create stable wrapped components outside of render
const createRouteElement = (route: IRoute) => {
  // Create a stable component for this route
  const RouteComponent = () => (
    <CoreLayout authType={route.authType}>
      {route.element}
    </CoreLayout>
  );

  return (
    <ProtectedRoute
      path={route.path}
      component={RouteComponent}
      authType={route.authType}
    />
  );
};

export const AppRouter = ({ customRoutes = [] }: IAppRouter) => {
  // Memoize merged routes to prevent recreating on every render
  // Only recreate if customRoutes changes
  const mergedRoutes = useMemo(() => {
    return [ ...customRoutes, ...defaultRoutes ].reduce((acc: any, route: IRoute, index: number) => {
      acc[ route.path ] = (
        <Route
          key={`route-${route.path}`}
          path={route.path}
          element={createRouteElement(route)}
        />
      );
      return acc;
    }, {});
  }, [ customRoutes ]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ConfigLoader>
        <Routes>
          {Object.values(mergedRoutes)}
        </Routes>
      </ConfigLoader>
    </ErrorBoundary>
  );
};