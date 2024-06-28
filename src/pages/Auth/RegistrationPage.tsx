import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageConfig } from '../../core';
import { useApi } from '../../core/context';
import { Link } from '../../core/common';
import { useAppContext } from '../../core/context/AppContext';
import { AuthForm } from '../../forms/Layout/AuthForm';

export const RegistrationPage = () => {
  return (
    <RegistrationForm />
  );
};

const RegistrationForm = () => {
  const navigate = useNavigate();

  const { notifySuccess, notifyError } = useAppContext();
  const { propertiesConfig, apiConfig } = usePageConfig("/signup");
  const { callApiMethod } = useApi();

  const onFinish = async (payload: any) => {
    const response: any = await callApiMethod({...apiConfig, payload });

    if( response.status === 200 ) {
      const message = response.data.message ?? "Registration Successful!";
      notifySuccess(message);
      navigate('/verification');
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