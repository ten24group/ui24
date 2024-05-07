import React, { ReactNode, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

//import { LoginPage, ForgotPasswordPage, ResetPasswordPage } from "../index";
import { LoginPage, ForgotPassword, ResetPassword, DynamicPage, PostAuthPage } from '../pages';
import { useAuth } from '../core/api/config';

interface IRoute{
    path: string;
    element?: ReactNode;
    handle?: string;
}

type IRoutes = Array<IRoute>

export type IAppRouter = { customRoutes?: IRoutes }

/**
 * AppNavigator component to redirect to another route.
 * 
 * @param path - The path to navigate to.
 * @returns The empty component.
 */
const AppNavigator = ({ path } : { path: string }) => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(path);
  }, [] )
  return <></>
}

export const AppRouter = ({ customRoutes = [] } : IAppRouter ) => {


    const { getToken } = useAuth();
    const authToken = getToken();

    // Default routes
    const defaultRoutes: IRoutes = [
      { path: "/login", element: <LoginPage /> },
      { path: "/forgot-password", element: <ForgotPassword /> },
      { path: "/reset-password", element: <ResetPassword /> },
      { path: "/dashboard", element: <PostAuthPage  metaDataUrl='Dashboard' pageTitle="Dashboard" pageType='dashboard'/> },
      { path: "/", element: <AppNavigator path= { !authToken ? "/login" : '/dashboard' } /> },
      { path: "/:dynamicPage", element : <DynamicPage /> },
      { path: "/:dynamicPage/:dynamicID", element : <DynamicPage /> },
    ];
  
    // Merge custom routes with default routes, giving precedence to custom ones
    const mergedRoutes = [...defaultRoutes, ...customRoutes].reduce((acc: any, route: IRoute, index:number ) => {
      acc[route.path] = <React.Fragment key={"route"+index}><Route path={route.path} element={route.element} /></React.Fragment>;
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