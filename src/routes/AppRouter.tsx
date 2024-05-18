import React, { ReactNode, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { App as AntdApp } from "antd";
import { useAuth } from '../core/api/config';
import { PostAuthLayout } from '../layout';
//import { LoginPage, ForgotPasswordPage, ResetPasswordPage } from "../index";
import { LoginPage, ForgotPasswordPage, ResetPasswordPage, DynamicPage, PostAuthPage, RegistrationPage, VerifyRegistrationPage } from '../pages';

interface IRoute{
    path: string;
    element?: ReactNode;
    handle?: string;
}

type IRoutes = Array<IRoute>

export type IAppRouter = { customRoutes?: IRoutes }

/**
 * AppNavigator component to redirect the base / route based on auth status.
 * 
 * @param path - The path to navigate to.
 * @returns The empty component.
 */
export const AppNavigator = () => {
  const { isLoggedIn } = useAuth();

  const navigate = useNavigate();
  useEffect(() => {
    navigate( isLoggedIn ? '/dashboard' : '/login');
  }, [ isLoggedIn ] )
  return <></>
}

export const AppRouter = ({ customRoutes = [] } : IAppRouter ) => {

    // Default routes
    const defaultRoutes: IRoutes = [
      { path: "/login", element: <LoginPage /> },
      { path: "/registration", element: <RegistrationPage /> },
      { path: "/verification", element: <VerifyRegistrationPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage />},
      { path: "/reset-password", element: <ResetPasswordPage /> },
      { path: "/", element: <AppNavigator /> },
      { path: "/:dynamicPage", element : <DynamicPage /> },
      { path: "/:dynamicPage/:dynamicID", element : <DynamicPage /> },
    ];
  
    // Merge custom routes with default routes, giving precedence to custom ones
    const mergedRoutes = [...customRoutes, ...defaultRoutes ].reduce((acc: any, route: IRoute, index:number ) => {
      acc[route.path] = <React.Fragment key={"route"+index}>{}
        <Route path={route.path} element={route.element} />
      </React.Fragment>;
      return acc;
    }, {});
  
    return (
      <AntdApp>
        <BrowserRouter>
          <Routes>
            {Object.values(mergedRoutes)}
          </Routes>
        </BrowserRouter>
      </AntdApp>
    );
  };