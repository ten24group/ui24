import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../../core/context';
import { useAppContext } from '../../core/context/AppContext';
import { useUi24Config } from '../../core/context';
import { useAuth } from '../../core/context/AuthContext';

export const AuthCallbackPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { callApiMethod } = useApi();
  const { notifyError, notifySuccess } = useAppContext();
  const { selectConfig } = useUi24Config();
  const { isLoggedIn, processToken } = useAuth();
  const authConfig = selectConfig(config => config.uiConfig.auth && config.uiConfig.auth[ '/login' ] ? config.uiConfig.auth[ '/login' ] : {});
  const socialConfig = (authConfig as any).socialConfig || {};
  const completeSignInUrl = socialConfig.completeSignInUrl || '/mauth/completeSocialSignIn';
  const redirectUri = socialConfig.redirectUri || (window.location.origin + '/auth/callback');
  const providers = socialConfig.providers || [];
  const [ loginInProgress, setLoginInProgress ] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!providers || providers.length === 0) return;

    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    const code = params.get('code');
    let provider = params.get('provider');
    if (!provider) {
      provider = providers[ 0 ].provider;
    }

    // Prevent double handling in dev mode
    if (handledRef.current) return;
    handledRef.current = true;

    if (error) {
      notifyError(errorDescription.replace('PreSignUp failed with error', '') || 'Social login failed');
      navigate('/login');
    } else if (code && provider) {
      // Prevent double handling using sessionStorage (persists across StrictMode re-mounts)
      const callbackKey = `oauth_callback_handled_${code}`;
      const alreadyHandled = sessionStorage.getItem(callbackKey);
      if (alreadyHandled) {
        return;
      }
      sessionStorage.setItem(callbackKey, 'true');
      callApiMethod({
        apiUrl: completeSignInUrl,
        apiMethod: 'POST',
        payload: { provider, code, redirectUri }
      }).then(response => {
        const data = response.data as any;
        if (response.status === 200 && data?.AccessToken) {
          // Clean up the sessionStorage flag after successful auth
          sessionStorage.removeItem(callbackKey);
          setLoginInProgress(true);
          processToken(response);
          notifySuccess('Login successful!');
          navigate('/');
        } else {
          notifyError(data?.message || 'Social login failed');
          navigate('/login');
        }
      }).catch((error: any) => {
        console.log('error', error);
        notifyError(error.message || 'Social login failed');
        navigate('/login');
      });
    } else {
      notifyError('No code or provider found in callback');
      navigate('/login');
    }
  }, [ location, callApiMethod, notifyError, notifySuccess, navigate, completeSignInUrl, redirectUri, providers, processToken ]);


  if (!providers || providers.length === 0) {
    return <div className='AuthCallbackPage'>Loading social login configuration...</div>;
  }

  return <div className='AuthCallbackPage'>Completing sign-in, please wait...</div>;
}; 