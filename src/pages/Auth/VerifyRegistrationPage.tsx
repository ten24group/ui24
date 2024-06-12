import React from 'react';
import { usePageConfig } from '../../core';
import { useApi } from '../../core/context';
import { Link } from '../../core/common';
import { useAppContext } from '../../core/context/AppContext';
import { AuthForm } from '../../forms/Layout/AuthForm';
import { useNavigate } from 'react-router-dom';

export const VerifyRegistrationPage = () => {
  return (<VerifyRegistrationForm /> );
};

const VerifyRegistrationForm = () => {
  const navigate = useNavigate();
  const { notifySuccess, notifyError } = useAppContext();
  const { propertiesConfig, apiConfig } = usePageConfig("/verify");
  const { callApiMethod } = useApi();

  const onFinish = async (payload: any) => {
    const response: any = await callApiMethod({...apiConfig, payload });

    if( response.status === 200 ) {
      const message = response.data.message ?? "Verification Successful!";
      notifySuccess(message);
      navigate('/login');
    } else if( response?.error ) {
      notifyError(response?.error)
    }
  }

  return <>{ propertiesConfig && <AuthForm
            onSubmit={onFinish}
            propertiesConfig={ propertiesConfig }
            formButtons={ ["submit" ]} 
        >
            <div className="PreAuthLoginActions" style={{display: 'flex' }}>
                <Link title="Back to login?" url='/login' />
            </div>
        </AuthForm>
    }</>
}