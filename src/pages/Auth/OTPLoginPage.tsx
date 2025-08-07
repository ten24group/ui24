import React, { useState } from 'react';
import { Button, Spin } from 'antd';
import { useCoreNavigator } from '../../routes/Navigation';
import { usePageConfig } from '../../core';
import { useApi } from '../../core/context';
import { useAppContext } from '../../core/context/AppContext';
import { AuthForm } from '../../forms/Layout/AuthForm';
import { Link } from '../../core/common';
import { useUi24Config } from '../../core/context';

export const OTPLoginPage = () => {
  return <OTPLoginForm />;
};

const OTPLoginForm = () => {
  const navigate = useCoreNavigator();
  const { notifyError } = useAppContext();
  const { selectConfig } = useUi24Config();
  const authConfig = selectConfig(config => config.uiConfig.auth && config.uiConfig.auth[ '/login' ] ? config.uiConfig.auth[ '/login' ].authConfig : undefined);
  const pageConfig = usePageConfig("/otp-login");
  const propertiesConfig = pageConfig.propertiesConfig;
  const [ loader, setLoader ] = useState<boolean>(false);
  const { callApiMethod } = useApi();

  if (!pageConfig || !authConfig) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Spin size="large" />
    </div>;
  }

  const onFinish = async (payload: any) => {
    setLoader(true);
    try {
      // Step 1: Call initiateAuthUrl with email
      const response: any = await callApiMethod({
        apiUrl: authConfig.initiateAuthUrl,
        apiMethod: 'POST',
        payload: { username: payload.email }
      });
      const challenges = response?.data?.challenges || [];
      const session = response?.data?.session;
      if (response.status === 200 && challenges.length === 1 && challenges[ 0 ] === 'EMAIL_OTP') {
        // Only EMAIL_OTP challenge, go to verify page
        navigate('/otp-login/verify', { state: { email: payload.email, session } });
      } else if (response.status === 200 && challenges.length > 1) {
        // Multiple challenges, call initiateOtpAuthUrl
        const otpResp: any = await callApiMethod({
          apiUrl: authConfig.initiateOtpAuthUrl,
          apiMethod: 'POST',
          payload: { session, username: payload.email }
        });
        if (otpResp.status === 200 && otpResp.data?.session) {
          navigate('/otp-login/verify', { state: { email: payload.email, session: otpResp.data.session } });
        } else {
          notifyError(otpResp?.error || 'Failed to initiate OTP authentication.');
        }
      } else {
        notifyError(response?.error || 'Unable to initiate OTP login.');
      }
    } catch (error: any) {
      console.error('otpResp error', error);
      notifyError(error?.message || 'An error occurred during OTP login');
    } finally {
      setLoader(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  return (
    <AuthForm
      onSubmit={onFinish}
      propertiesConfig={propertiesConfig}
      formButtons={[]}
      disabled={loader}
      buttonLoader={loader}
    >
      <Button
        type="primary"
        htmlType="submit"
        style={{ width: '100%', marginBottom: 10 }}
        loading={loader}
        disabled={loader}
      >
        Send OTP
      </Button>

      <div className="PreAuthLoginActions">
        <Link title="Back to login?" onClick={handleBackToLogin} />
      </div>
    </AuthForm>
  );
}; 