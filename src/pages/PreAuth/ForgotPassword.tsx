import React from 'react';
import { callApiMethod, usePageConfig } from "../../core";
import { Link } from '../../core/common';
import { useAppContext } from '../../core/context/AppContext';
import { PreAuthForm } from '../../forms/PreAuth/PreAuthForm';
import { PreAuthLayout } from "../../layout";

export const ForgotPasswordPage = () => {
  return (
    <PreAuthLayout>
        <ForgotPasswordForm />
    </PreAuthLayout>
  );
};

export const ForgotPasswordForm = () => {
    const { notifySuccess, notifyError } = useAppContext();
    const { propertiesConfig, apiConfig } = usePageConfig("/forgot-password");

    const onFinish = async (payload: any) => {
        const response: any = await callApiMethod({...apiConfig, payload});
        if( response.status === 200 ) {
            notifySuccess(response?.message || response?.data?.message);
        } else {
            notifyError(response?.message || response?.error)
        }
    }

    return <>{ propertiesConfig && <PreAuthForm
            onSubmit={onFinish}
            propertiesConfig={ propertiesConfig }
            formButtons={ ["forgotPassword" ]} 
        >
            <div className="PreAuthLoginActions" style={{display: 'flex' }}>
                <Link title="Back to login?" url='/login' />
            </div>
        </PreAuthForm>
    }</>
}