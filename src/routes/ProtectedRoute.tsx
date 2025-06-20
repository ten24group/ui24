import React from 'react';
import { useLocation } from 'react-router-dom';
import { CoreNavigate } from './Navigation';
import { useAuth } from '../core/context';

interface IProtectedRoute {
  component: React.ComponentType<any>;
  authType: 'auth' | 'public' | 'private' | undefined;
  path: string;
}

export const ProtectedRoute: React.FC<IProtectedRoute> = ({ component: Component, authType = "public", ...rest }) => {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  const renderComponent = (props: any) => {
    if (authType === 'private' && !isLoggedIn) {
      // Save the path the user was trying to access
      sessionStorage.setItem('preLoginPath', location.pathname);
      // and redirect them to the login page.
      return <CoreNavigate to="/login" />;
    }

    // For auth routes (login, auth callback), let the page render so it can handle the flow
    // For public routes, also render directly
    return <Component {...props} />;
  };

  return renderComponent({ ...rest });
};