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
            notifySuccess(response?.message || response?.data?.message);
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
                    onClick = {handleForgotPassword}
                > 
                    Request new verification code?.
                </Button>
            </div>
            
        </AuthForm>
    }</>

}