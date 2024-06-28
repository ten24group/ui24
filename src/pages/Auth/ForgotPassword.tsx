import React from 'react';
import { usePageConfig } from "../../core";
import { useApi } from '../../core/context';
import { Link } from '../../core/common';
import { useAppContext } from '../../core/context/AppContext';
import { AuthForm } from '../../forms/Layout/AuthForm';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';

export const ForgotPasswordPage = () => {
  return (
    <ForgotPasswordForm />
  );
};

export const ForgotPasswordForm = () => {
    const navigate = useNavigate();
    const { notifySuccess, notifyError } = useAppContext();
    const { propertiesConfig, apiConfig } = usePageConfig("/forgot-password");
    const { callApiMethod } = useApi();

    const onFinish = async (payload: any) => {
        const response: any = await callApiMethod({...apiConfig, payload});
        if( response.status === 200 ) {
            notifySuccess(response?.message || response?.data?.message);
            handleResetPassword();
        } else {
            notifyError(response?.message || response?.error)
        }
    }

    const handleResetPassword = () => {
        navigate('/reset-password');
    };

    return <>{ propertiesConfig && <AuthForm
            onSubmit={onFinish}
            propertiesConfig={ propertiesConfig }
            formButtons={ ["forgotPassword" ]} 
        >
            <div className="PreAuthLoginActions" style={{display: 'flex' }}>
                <Link title="Back to login?" url='/login' />
            </div>
            <div className="PreAuthLoginActions" style={{display: 'flex' }}>
                <Button 
                    type = "dashed"
                    size = "middle"
                    style = {{ width: "99%", margin:"1%" }}
                    onClick = {handleResetPassword}
                > 
                    Has verification code? Reset password.
                </Button>
            </div>
        </AuthForm>
    }</>
}