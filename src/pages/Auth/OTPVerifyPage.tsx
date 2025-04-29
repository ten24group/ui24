import React, { useState } from 'react';
import { Button, Spin, Input } from 'antd';
import { useLocation } from 'react-router-dom';
import { useCoreNavigator } from '../../routes/Navigation';
import { useAppContext } from '../../core/context/AppContext';
import { useApi } from '../../core/context';
import { useUi24Config } from '../../core/context';
import { AuthForm } from '../../forms/Layout/AuthForm';
import { Link } from '../../core/common';
import { usePageConfig } from '../../core';

export const OTPVerifyPage = () => {
  return <OTPVerifyForm />;
};

const OTPVerifyForm = () => {
  const location = useLocation();
  const navigate = useCoreNavigator();
  const { notifySuccess, notifyError } = useAppContext();
  const { callApiMethod } = useApi();
  const { selectConfig } = useUi24Config();
  const authConfig = selectConfig(config => config.uiConfig.auth && config.uiConfig.auth['/login'] ? config.uiConfig.auth['/login'].authConfig : undefined);
  const pageConfig = usePageConfig("/otp-login/verify");
  const propertiesConfig = pageConfig.propertiesConfig;
  const [loader, setLoader] = useState(false);
  const [otp, setOtp] = useState('');

  // Get email and session from navigation state
  const { email, session } = (location.state || {});

  if (!email || !session || !authConfig) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Spin size="large" />
    </div>;
  }

  const onFinish = async (payload: any) => {
    setLoader(true);
    try {
      const response: any = await callApiMethod({
        apiUrl: authConfig.otpResponseUrl,
        apiMethod: 'POST',
        payload: { username: email, session: session, code: payload.otp }
      });
      if (response.status === 200) {
        notifySuccess('Login Successful!');
        navigate('/dashboard');
      } else {
        notifyError(response?.error || 'OTP verification failed.');
      }
    } catch (error: any) {
      notifyError(error?.message || 'An error occurred during OTP verification');
    } finally {
      setLoader(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  const handleResendOtp = () => {
    navigate('/otp-login', { state: { email } });
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
        Verify OTP
      </Button>
      <div className="PreAuthLoginActions">
        <Link title="Back to login?" onClick={handleBackToLogin} />
        <Link title="Resend OTP?" onClick={handleResendOtp} className="two-column" />
      </div>
    </AuthForm>
  );
}; 