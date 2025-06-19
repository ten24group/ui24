import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUi24Config } from './UI24Context';
import { IAuthProvider, LocalStorageAuthProvider, useAWSAuthenticator } from '../providers';

type IAuthContext = IAuthProvider & {
  isLoggedIn: boolean;
  login: (newToken: string) => void;
  logout: () => void;
  processToken: (request: any) => boolean;
  getToken: () => string | null;
  getRefreshToken: () => string | null;
}

const AuthContext = createContext<IAuthContext | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const getProvider = (provider: string): IAuthProvider => {
  switch (provider) {
    case 'aws':
      return useAWSAuthenticator({})
    default:
      return new LocalStorageAuthProvider();
  }
};


export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { selectConfig } = useUi24Config();
  const authProvider = getProvider(selectConfig((config) => "aws"));
  const [ isLoggedIn, setIsLoggedIn ] = useState(authProvider.getToken() ? true : false);

  const processToken = (request: any): boolean => {

    const validToken = authProvider.processToken(request)
    if (validToken) {
      !isLoggedIn && setIsLoggedIn(true);
    }
    return true
  }

  const login = (newToken: string) => {
    authProvider.setToken(newToken);
    setIsLoggedIn(true);
  };

  const logout = () => {
    authProvider.removeToken();
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{
      processToken,
      isLoggedIn,
      login,
      logout,
      getToken: authProvider.getToken,
      setToken: authProvider.setToken,
      removeToken: authProvider.removeToken,
      requestHeaders: authProvider.requestHeaders,
      getRefreshToken: authProvider.getRefreshToken,
      refreshToken: authProvider.refreshToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
};