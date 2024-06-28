import React from 'react';
import { Route, Navigate } from 'react-router-dom';
import { useAuth } from '../core/context';

interface IProtectedRoute {
  component: React.ComponentType<any>;
  authType: 'auth' | 'public' | 'private' | undefined;
  path: string;
}

export const ProtectedRoute: React.FC<IProtectedRoute> = ({ component: Component, authType = "public", ...rest }) => {
  const { isLoggedIn } = useAuth();

  const renderComponent = (props: any) => {
    if (authType === 'auth' && isLoggedIn) {
      // User is already logged in, redirect to dashboard
      return <Navigate to="/dashboard" />;
    }
    if (authType === 'private' && !isLoggedIn) {
      // User is not logged in, redirect to login
      return <Navigate to="/login" />;
    }
    // No restrictions, render the component
    return <Component {...props} />;
  };

  return renderComponent({...rest})
};