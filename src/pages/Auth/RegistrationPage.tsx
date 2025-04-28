import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageConfig } from '../../core';
import { useApi } from '../../core/context';
import { Link } from '../../core/common';
import { useAppContext } from '../../core/context/AppContext';
import { AuthForm } from '../../forms/Layout/AuthForm';
import { Button } from 'antd';
export const RegistrationPage = () => {
  return (
    <RegistrationForm />
  );
};

const RegistrationForm = () => {
  const navigate = useNavigate();

  const { notifySuccess, notifyError } = useAppContext();
  const { propertiesConfig, apiConfig } = usePageConfig("/signup");
  const { propertiesConfig:verifyPropertiesConfig } = usePageConfig("/verify");
  const { callApiMethod } = useApi();

  const onFinish = async (payload: any) => {
    const response: any = await callApiMethod({...apiConfig, payload });

    if( response.status === 200 ) {
      const message = response.data.message ?? "Registration Successful!";
      notifySuccess(message);
      if (!response.data?.UserConfirmed && response.data?.CodeDeliveryDetails) {
        navigate('/verification', { 
          state: { 
            email: payload.email,
            codeDeliveryDetails: response.data.CodeDeliveryDetails,
            message: `Verification code sent to ${response.data.CodeDeliveryDetails.Destination}`
          } 
        });
      } else {
        navigate('/login');
      }
    } else if( response?.error ) {
      notifyError(response?.error)
    }
  }

  const handleVerification = (e) => {
      navigate('/verification');
  };

  return <>{ propertiesConfig && <AuthForm
            onSubmit={onFinish}
            propertiesConfig={ propertiesConfig }
            formButtons={[]} 
        >
            <Button
                type="primary"
                htmlType="submit"
                style={{ width: '100%', marginBottom: 10 }}
            >
                Create Account
            </Button>
            <div className="PreAuthLoginActions" style={{display: 'flex' }}>
                <Link title="Back to login?" url='/login' />
                {verifyPropertiesConfig?.length && <Link className="verificationlink" title="Verify Account?" onClick={handleVerification} />}
            </div>
        </AuthForm>
    }</>
}