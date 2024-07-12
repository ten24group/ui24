import React, { useEffect } from 'react';
import { LoginPage, ForgotPasswordPage, ResetPasswordPage, DynamicPage, PostAuthPage, RegistrationPage, VerifyRegistrationPage } from '../pages';
import { IRoutes } from './types';
import { useAuth } from '../core/context';
import { useNavigate } from 'react-router-dom';

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

export const defaultRoutes: IRoutes = [
  { path: "/login", element: <LoginPage />, authType: "auth" },
  { path: "/registration", element: <RegistrationPage />, authType: "auth" },
  { path: "/verification", element: <VerifyRegistrationPage />, authType: "auth" },
  { path: "/forgot-password", element: <ForgotPasswordPage />, authType: "auth"},
  { path: "/reset-password", element: <ResetPasswordPage />, authType: "auth" },
  { path: "/", element: <AppNavigator />, authType: "private" },
  { path: "/:dynamicPage", element : <DynamicPage />, authType: "private" },
  { path: "/:dynamicPage/:dynamicID", element : <DynamicPage />, authType: "private" },
];