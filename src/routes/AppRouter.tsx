import React, { ReactNode, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { App as AntdApp } from "antd";

//import { LoginPage, ForgotPasswordPage, ResetPasswordPage } from "../index";
import {
  LoginPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  DynamicPage,
  PostAuthPage,
  RegistrationPage,
  VerifyRegistrationPage,
} from "../pages";
import { useAuth } from "../core/api/config";

interface IRoute {
  path: string;
  element?: ReactNode;
  handle?: string;
}

export type IAppRouter = {
  publicRoutes?: Array<Array<IRoute>>;
  privateRoutes?: Array<Array<IRoute>>;
};

/**
 * AppNavigator component to redirect to another route.
 *
 * @param path - The path to navigate to.
 * @returns The empty component.
 */
const AppNavigator = ({ path }: { path: string }) => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(path);
  }, []);
  return <></>;
};

export const AppRouter = ({
  publicRoutes = [],
  privateRoutes = [],
}: IAppRouter) => {
  const auth = useAuth();

  // Public routes
  const corePublicRoutes: Array<IRoute> = [
    { path: "/login", element: <LoginPage /> },
    { path: "/registration", element: <RegistrationPage /> },
    { path: "/verification", element: <VerifyRegistrationPage /> },
    { path: "/forgot-password", element: <ForgotPasswordPage /> },
    { path: "/reset-password", element: <ResetPasswordPage /> },
    {
      path: "*",
      element: (
        <AppNavigator path={!auth.isLoggedIn() ? "/login" : "/dashboard"} />
      ),
    },
  ];

  //private routes
  const corePrivateRoutes = [
    {
      path: "/dashboard",
      element: (
        <PostAuthPage
          metaDataUrl="Dashboard"
          pageTitle="Dashboard"
          pageType="dashboard"
        />
      ),
    },
    { path: "/:dynamicPage", element: <DynamicPage /> },
    { path: "/:dynamicPage/:dynamicID", element: <DynamicPage /> },
  ];

  // Merge custom routes with default routes, giving precedence to custom ones

  const mergedRoutes = [
    ...(auth.isLoggedIn() ? corePrivateRoutes : corePublicRoutes),
    ...(auth.isLoggedIn() ? privateRoutes : publicRoutes),
  ].reduce((acc: any, route: IRoute, index: number) => {
    acc[route.path] = (
      <React.Fragment key={"route" + index}>
        <Route path={route.path} element={route.element} />
      </React.Fragment>
    );
    return acc;
  }, {});

  return (
    <AntdApp>
      <BrowserRouter>
        <Routes>{Object.values(mergedRoutes)}</Routes>
      </BrowserRouter>
    </AntdApp>
  );
};
