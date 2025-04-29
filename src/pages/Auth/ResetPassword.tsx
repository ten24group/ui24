import React from 'react';
import { usePageConfig } from "../../core";
import { useApi } from '../../core/context';
import { AuthForm } from '../../forms/Layout/AuthForm';
import { useAppContext } from '../../core/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Link } from '../../core/common';
import { Button } from 'antd';

export const ResetPasswordPage = () => {
  return (
    <ResetPasswordForm />
  );
};

export const ResetPasswordForm = () => {
    const navigate = useNavigate();
    const { notifySuccess, notifyError } = useAppContext();
    const { propertiesConfig, apiConfig } = usePageConfig("/reset-password");
    const { callApiMethod } = useApi();

    const onFinish = async (payload: any) => {
        const response: any = await callApiMethod({...apiConfig, payload});

        if( response.status === 200 ) {
            notifySuccess(response?.message || response?.data?.message || 'Password reset successful');
            navigate('/login');
        } else {
            notifyError(response?.message || response?.error)
        }
    }
    const handleForgotPassword = () => {
        navigate('/forgot-password');
    }

    return <>{ propertiesConfig && <AuthForm
            onSubmit={onFinish}
            propertiesConfig={ propertiesConfig }
            formButtons={ []} 
        >
            
            <Button
                type="primary"
                htmlType="submit"
                style={{ width: '100%', marginBottom: 10 }}
            >
                Reset Password
            </Button>

            <div className="PreAuthLoginActions">
                <Link title="Back to login?" url='/login' />
                <Link className="verificationlink" title="Request new verification code?" onClick={handleForgotPassword} />
            </div>
            
        </AuthForm>
    }</>

}