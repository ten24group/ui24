import React, { ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

//import { LoginPage, ForgotPasswordPage, ResetPasswordPage } from "../index";
import { LoginPage, PostAuthPage, ForgotPassword, ResetPassword } from '../pages';

interface IRoute{
    path: string;
    element: ReactNode
}

type IRoutes = Array<IRoute>

export type IAppRouter = { customRoutes?: IRoutes }

export const AppRouter = ({ customRoutes = [] } : IAppRouter ) => {
    // Default routes
    const defaultRoutes: IRoutes = [
      { path: "/login", element: <LoginPage /> },
      { path: "/forgot-password", element: <ForgotPassword /> },
      { path: "/reset-password", element: <ResetPassword /> },
      { path: "/dashboard", element: <PostAuthPage metaDataUrl='/create-account' /> },
      // Add other default routes
    ];
  
    // Merge custom routes with default routes, giving precedence to custom ones
    const mergedRoutes = [...defaultRoutes, ...customRoutes].reduce((acc: any, route: IRoute) => {
      acc[route.path] = <Route path={route.path} element={route.element} />;
      return acc;
    }, {});
  
    return (
      <BrowserRouter>
        <Routes>
          {Object.values(mergedRoutes)}
        </Routes>
      </BrowserRouter>
    );
  };