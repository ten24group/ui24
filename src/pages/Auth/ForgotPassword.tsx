import React from 'react';
import { usePageConfig } from "../../core";
import { useApi } from '../../core/context';
import { Link } from '../../core/common';
import { useAppContext } from '../../core/context/AppContext';
import { AuthForm } from '../../forms/Layout/AuthForm';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { handleApiError } from '../../core/utils/api-error-handler';
import { useCoreNavigator } from '../../routes/Navigation';

export const ForgotPasswordPage = () => {
    return (
        <ForgotPasswordForm />
    );
};

export const ForgotPasswordForm = () => {
    const navigate = useCoreNavigator();

    const { notifySuccess, notifyError } = useAppContext();
    const { propertiesConfig, apiConfig } = usePageConfig("/forgot-password");
    const { callApiMethod } = useApi();

    const onFinish = async (payload: any) => {
        try {
            const response: any = await callApiMethod({ ...apiConfig, payload });
            if (response.status === 200) {
                notifySuccess(response?.message || response?.data?.message || 'Password reset email sent');
                handleResetPassword();
            } else if (response.status >= 400) {
                // Handle error response using consolidated error handler
                const errorResult = handleApiError(response, 'Password reset failed');
                notifyError(errorResult.formattedErrors.join('\n'));
            }
        } catch (error: any) {
            // Handle network errors or other exceptions
            const errorResult = handleApiError(error, 'An unexpected error occurred');
            notifyError(errorResult.formattedErrors.join('\n'));
        }
    }

    const handleResetPassword = () => {
        navigate('/reset-password');
    };

    return <>{propertiesConfig && <AuthForm
        onSubmit={onFinish}
        propertiesConfig={propertiesConfig}
        formButtons={[]}
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
            <Link className="verificationlink" title="Has verification code?" onClick={handleResetPassword} />
        </div>
    </AuthForm>
    }</>
}