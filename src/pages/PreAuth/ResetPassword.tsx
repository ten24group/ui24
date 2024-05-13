import React from 'react';
import { callApiMethod, usePageConfig } from "../../core";
import { PreAuthLayout } from "../../layout";
import { PreAuthForm } from '../../forms/PreAuth/PreAuthForm';
import { useAppContext } from '../../core/context/AppContext';

export const ResetPasswordPage = () => {
  return (
    <PreAuthLayout>
        <ResetPasswordForm />
    </PreAuthLayout>
  );
};

export const ResetPasswordForm = () => {
    const { notifySuccess, notifyError } = useAppContext();
    const { propertiesConfig, apiConfig } = usePageConfig("/reset-password");

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
        />
    }</>

}