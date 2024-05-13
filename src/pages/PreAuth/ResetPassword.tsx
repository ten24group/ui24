import React from 'react';
import { callApiMethod, usePageConfig } from "../../core";
import { PreAuthLayout } from "../../layout";
import { PreAuthForm } from '../../forms/PreAuth/PreAuthForm';
import { useAppContext } from '../../core/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Link } from '../../core/common';
import { Button } from 'antd';

export const ResetPasswordPage = () => {
  return (
    <PreAuthLayout>
        <ResetPasswordForm />
    </PreAuthLayout>
  );
};

export const ResetPasswordForm = () => {
    const navigate = useNavigate();
    const { notifySuccess, notifyError } = useAppContext();
    const { propertiesConfig, apiConfig } = usePageConfig("/reset-password");

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

    return <>{ propertiesConfig && <PreAuthForm
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
            
        </PreAuthForm>
    }</>

}