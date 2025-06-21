import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUi24Config } from './UI24Context';
import { IAuthProvider, LocalStorageAuthProvider, useAWSAuthenticator } from '../providers';
import type { AxiosResponse } from 'axios';

type IAuthContext = IAuthProvider & {
  isLoggedIn: boolean;
  login: (newToken: string) => void;
  logout: () => void;
  authenticateRequest: (config: any) => Promise<any>;
  processResponse: (response: AxiosResponse<any>) => void;
  shouldRefreshAuth: (error: any, config: any) => boolean;
  refreshAuth: () => Promise<void>;
  getToken: () => string | null;
  getRefreshToken: () => string | null;
  rememberMe: boolean;
  setRememberMe: (flag: boolean) => void;
}

const AuthContext = createContext<IAuthContext | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const getProvider = (provider: string, rememberMe: boolean): IAuthProvider => {
  switch (provider) {
    case 'aws':
      return useAWSAuthenticator({ rememberMe });
    default:
      return new LocalStorageAuthProvider();
  }
};


export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [ rememberMe, setRememberMe ] = useState<boolean>(false);
  const { selectConfig } = useUi24Config();
  const providerName = selectConfig((config) => "aws");
  const authProvider = getProvider(providerName, rememberMe);
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

  const logoutHook = () => {
    authProvider.logout ? authProvider.logout() : authProvider.removeToken();
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{
      authenticateRequest: authProvider.authenticateRequest?.bind(authProvider) ?? (async c => { authProvider.requestHeaders(c); return c; }),
      processResponse: processToken,
      processToken: authProvider.processToken.bind(authProvider),
      requestHeaders: authProvider.requestHeaders.bind(authProvider),
      shouldRefreshAuth: authProvider.shouldRefreshAuth?.bind(authProvider) ?? ((e: any, c: any) => [ 401, 403 ].includes(e.response?.status)),
      refreshAuth: authProvider.refreshAuth?.bind(authProvider) ?? (async () => { const t = await authProvider.refreshToken(); if (!t) throw new Error('Unable to refresh auth'); }),
      isLoggedIn,
      login,
      logout: logoutHook,
      getToken: authProvider.getToken,
      setToken: authProvider.setToken,
      removeToken: authProvider.removeToken,
      getRefreshToken: authProvider.getRefreshToken,
      refreshToken: authProvider.refreshToken,
      rememberMe,
      setRememberMe,
    }}>
      {children}
    </AuthContext.Provider>
  );
};