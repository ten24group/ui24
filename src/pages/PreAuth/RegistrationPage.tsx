import React from 'react';
import { useNavigate } from 'react-router-dom';
import { callApiMethod, usePageConfig } from '../../core';
import { Link } from '../../core/common';
import { useAppContext } from '../../core/context/AppContext';
import { PreAuthForm } from '../../forms/PreAuth/PreAuthForm';
import { PreAuthLayout } from '../../layout';

export const RegistrationPage = () => {
  return (
    <PreAuthLayout>
        <RegistrationForm />
    </PreAuthLayout>
  );
};

const RegistrationForm = () => {
  const navigate = useNavigate();

  const { notifySuccess, notifyError } = useAppContext();
  const { propertiesConfig, apiConfig } = usePageConfig("/signup");

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

  return <>{ propertiesConfig && <PreAuthForm
            onSubmit={onFinish}
            propertiesConfig={ propertiesConfig }
            formButtons={ ["submit" ]} 
        >
            <div className="PreAuthLoginActions" style={{display: 'flex' }}>
                <Link title="Back to login?" url='/login' />
            </div>
        </PreAuthForm>
    }</>
}