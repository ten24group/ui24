import React from 'react';
import { usePageConfig } from '../../core';
import { useApi } from '../../core/context';
import { Link } from '../../core/common';
import { useAppContext } from '../../core/context/AppContext';
import { AuthForm } from '../../forms/Layout/AuthForm';
import { useNavigate, useLocation } from 'react-router-dom';

export const VerifyRegistrationPage = () => {
  const location = useLocation();
  const { email, codeDeliveryDetails, message } = location.state || {};

  return (
            <VerifyRegistrationForm 
              email={email} 
              codeDeliveryDetails={codeDeliveryDetails}
              verificationMessage={message}
            />
  );
};

const VerifyRegistrationForm = ({ 
  email, 
  codeDeliveryDetails,
  verificationMessage 
}: { 
  email?: string; 
  codeDeliveryDetails?: any;
  verificationMessage?: string;
}) => {
  const navigate = useNavigate();
  const { notifySuccess, notifyError } = useAppContext();
  const { propertiesConfig, apiConfig } = usePageConfig("/verify");
  const { callApiMethod } = useApi();

  const onFinish = async (payload: any) => {
    const response: any = await callApiMethod({
      ...apiConfig,
      payload: { ...payload, email }
    });

    if (response.status === 200) {
      const message = response.data.message ?? "Verification Successful!";
      notifySuccess(message);
      navigate('/login');
    } else if (response?.error) {
      notifyError(response?.error);
    }
  };

  return (
    <>
      {propertiesConfig && (
        <AuthForm
          onSubmit={onFinish}
          propertiesConfig={propertiesConfig}
          formButtons={["submit"]}
          message={verificationMessage}
        >
          <div className="PreAuthLoginActions" style={{ display: 'flex' }}>
            <Link title="Back to login?" url="/login" />
          </div>
        </AuthForm>
      )}
    </>
  );
};