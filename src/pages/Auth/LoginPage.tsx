import React, { useState } from 'react';
import type { CheckboxProps } from 'antd';
import { Button, Checkbox, Divider, Spin } from 'antd';
import { useCoreNavigator } from '../../routes/Navigation';
import { usePageConfig } from '../../core';
import { useApi } from '../../core/context';
import { Link } from '../../core/common';
import { useAppContext } from '../../core/context/AppContext';
import { AuthForm } from '../../forms/Layout/AuthForm';
import { useUi24Config } from '../../core/context';

export const LoginPage = () => {
  return (<LoginForm />);
};

const LoginForm = () => {
  const navigate = useCoreNavigator();

  const { notifySuccess, notifyError } = useAppContext();
  const { selectConfig } = useUi24Config();
  const authConfig = selectConfig(config => config.uiConfig.auth && config.uiConfig.auth[ '/login' ] ? config.uiConfig.auth[ '/login' ] : undefined);
  const pageConfig = usePageConfig("/login");
  const propertiesConfig = pageConfig.propertiesConfig;
  const apiConfig = pageConfig.apiConfig;
  const socialConfig = (authConfig as any)?.socialConfig || undefined;
  const signInMethods = (authConfig as any)?.signInMethods || [ 'EMAIL_PASSWORD' ];
  const [ loader, setLoader ] = useState<boolean>(false)
  const { callApiMethod } = useApi();
  const { propertiesConfig: signupPropertiesConfig } = usePageConfig("/signup");
  const { propertiesConfig: verifyPropertiesConfig } = usePageConfig("/verify");
  const { propertiesConfig: forgotPasswordPropertiesConfig } = usePageConfig("/forgot-password");

  // Social login providers from auth config
  const socialProviders = socialConfig?.providers || [];
  const socialApiUrl = socialConfig?.apiUrl || '/mauth/getSocialSignInConfig';
  const socialRedirectUri = socialConfig?.redirectUri || (window.location.origin + '/auth/callback');

  // Add loading state for config
  if (!authConfig || !pageConfig) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Spin size="large" />
    </div>;
  }

  const onFinish = async (payload: any) => {
    setLoader(true)
    try {
      const response: any = await callApiMethod({ ...apiConfig, payload });

      if (response.status === 200) {
        if (response.data?.challengeName === 'NEW_PASSWORD_REQUIRED') {
          const userName = payload.username || payload.email;
          navigate('/set-new-password', {
            state: {
              username: userName,
              session: response.data.session
            }
          });
          return;
        }
        notifySuccess("Login Successful!");
        // After login, navigate to root so AppNavigator can handle redirect
        navigate('/');
      } else if (response?.error) {
        notifyError(response?.error)
      }
    } catch (error: any) {
      notifyError(error?.message || 'An error occurred during login');
    } finally {
      setLoader(false)
    }
  }

  const onChange: CheckboxProps[ 'onChange' ] = (e) => {
    //TODO: Remember Me    
  };

  const handleRegister = (e) => {
    navigate('/registration');
  };

  const handleOTPLogin = (e) => {
    navigate('/otp-login');
  };

  const handleSocialSignIn = async (provider: string) => {
    setLoader(true);
    try {
      const response = await callApiMethod({
        apiUrl: socialApiUrl,
        apiMethod: 'POST',
        payload: { redirectUri: socialRedirectUri }
      });
      if (response.status === 200 && (response.data as any)?.[ provider ]?.authorizationUrl) {
        window.location.href = (response.data as any)[ provider ].authorizationUrl;
      } else {
        notifyError(`${provider} sign-in is not available.`);
      }
    } catch (e) {
      notifyError(`Failed to initiate ${provider} sign-in.`);
    } finally {
      setLoader(false);
    }
  };

  return <AuthForm
    onSubmit={onFinish}
    propertiesConfig={propertiesConfig}
    formButtons={[]}
    disabled={loader}
    buttonLoader={loader}
  >
    {forgotPasswordPropertiesConfig?.length &&
      <div className="PreAuthLoginActions">
        <Checkbox onChange={onChange}>Remember Me</Checkbox>
        <Link className="forgotPassword" title="Forgot Password?" url='/forgot-password' />
      </div>
    }

    {/* Log In button above divider */}
    <Button
      type="primary"
      htmlType="submit"
      style={{ width: '100%', marginBottom: 5 }}
      loading={loader}
      disabled={loader}
    >
      Log In
    </Button>

    {/* Divider and social login buttons below Log In button */}
    {socialProviders.length > 0 && (
      <div style={{ marginBottom: 10 }}>
        <Divider>or</Divider>
        {socialProviders.map((sp) => (
          <Button
            key={sp.provider}
            type="default"
            style={{ width: '100%', background: '#fff', color: '#444', border: '1px solid #ddd', marginBottom: 8 }}
            icon={sp.provider === 'Google' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 8 }}>
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <g>
                    <path fill="#4285F4" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.3-5.7 7-11.3 7-6.6 0-12-5.4-12-12s5.4-12 12-12c2.8 0 5.4.9 7.5 2.6l6.3-6.3C34.1 5.1 29.3 3 24 3 12.9 3 4 11.9 4 23s8.9 20 20 20c11 0 20-8.9 20-20 0-1.3-.1-2.7-.4-4z" />
                    <path fill="#34A853" d="M6.3 14.7l6.6 4.8C14.5 16.1 18.9 13 24 13c2.8 0 5.4.9 7.5 2.6l6.3-6.3C34.1 5.1 29.3 3 24 3c-7.1 0-13.1 3.7-16.7 9.3z" />
                    <path fill="#FBBC05" d="M24 43c5.3 0 10.1-1.8 13.8-4.9l-6.4-5.2C29.5 34.7 26.9 35.5 24 35.5c-5.6 0-10.3-3.8-12-9H6.3C8.9 38.1 15.9 43 24 43z" />
                    <path fill="#EA4335" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.1 3-3.7 5.5-7.3 6.5l6.4 5.2C40.2 37.1 44 30.9 44 24c0-1.3-.1-2.7-.4-4z" />
                  </g>
                </svg>
              </span>
            ) : null}
            onClick={() => handleSocialSignIn(sp.provider)}
            disabled={loader}
          >
            {sp.label}
          </Button>
        ))}
      </div>
    )}

    {/* OTP based login */}
    {signInMethods.includes('EMAIL_OTP') &&
      <div className="PreAuthLoginActions" style={{ marginBottom: 10 }}>
        <div className="one-column">
          <Link title="OTP Login" onClick={handleOTPLogin} />
        </div>
      </div>
    }

    {/* New here? Create an Account */}
    {signupPropertiesConfig?.length &&
      <div className="PreAuthLoginActions one-column">
        <div className="one-column">
          <Link title="New here? Create an Account" onClick={handleRegister} />
        </div>
      </div>
    }
  </AuthForm>
}