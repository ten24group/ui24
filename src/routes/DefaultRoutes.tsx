import React, { useEffect, useRef } from 'react';
import { LoginPage, ForgotPasswordPage, ResetPasswordPage, DynamicPage, PostAuthPage, RegistrationPage, VerifyRegistrationPage, OTPLoginPage, OTPVerifyPage } from '../pages';
import { AuthCallbackPage } from '../pages/Auth/AuthCallbackPage';
import { IRoutes } from './types';
import { useAuth } from '../core/context';
import { useNavigate } from 'react-router-dom';
import { SetNewPasswordPage } from '../pages/Auth/SetNewPassword';

/**
 * AppNavigator component to redirect the base / route based on auth status.
 * 
 * @param path - The path to navigate to.
 * @returns The empty component.
 */
export const AppNavigator = () => {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  // this is used to prevent multiple navigation due to react strict mode rendering components multiple times
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    // perform single-time navigation
    if (isLoggedIn) {
      const preLoginPath = sessionStorage.getItem('preLoginPath');
      console.log('AppNavigator: preLoginPath', preLoginPath);
      if (preLoginPath) {
        sessionStorage.removeItem('preLoginPath');
        navigate(preLoginPath);
      } else {
        navigate('/dashboard');
      }
    } else {
      console.log('AppNavigator: isLoggedOut');
      navigate('/login');
    }
  }, [ isLoggedIn, navigate ]);

  return null;
}

export const defaultRoutes: IRoutes = [
  { path: "/login", element: <LoginPage />, authType: "auth" },
  { path: "/otp-login", element: <OTPLoginPage />, authType: "auth" },
  { path: "/otp-login/verify", element: <OTPVerifyPage />, authType: "auth" },
  { path: "/registration", element: <RegistrationPage />, authType: "auth" },
  { path: "/verification", element: <VerifyRegistrationPage />, authType: "auth" },
  { path: "/forgot-password", element: <ForgotPasswordPage />, authType: "auth" },
  { path: "/reset-password", element: <ResetPasswordPage />, authType: "auth" },
  { path: "/set-new-password", element: <SetNewPasswordPage />, authType: "auth" },
  { path: "/auth/callback", element: <AuthCallbackPage />, authType: "auth" },
  { path: "/", element: <AppNavigator />, authType: "private" },
  // Catch all dynamic routes with any number of segments
  { path: "/*", element: <DynamicPage />, authType: "private" },
];