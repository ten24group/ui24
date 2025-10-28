import React from 'react';
import { usePageConfig } from "../../core";
import { useApi } from '../../core/context';
import { AuthForm } from '../../forms/Layout/AuthForm';
import { useAppContext } from '../../core/context/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Link } from '../../core/common';
import { Button } from 'antd';
import { handleApiError } from '../../core/utils/api-error-handler';

export const SetNewPasswordPage = () => {
    return (
        <SetNewPasswordForm />
    );
};

export const SetNewPasswordForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { notifySuccess, notifyError } = useAppContext();
    const { propertiesConfig, apiConfig } = usePageConfig("/set-new-password");
    const { callApiMethod } = useApi();

    // Get the username and session from the location state
    // These should be passed when redirecting to this page after receiving the NEW_PASSWORD_REQUIRED challenge
    const { username, session } = location.state || {};

    const onFinish = async (payload: any) => {
        try {
            // Add the username and session to the payload
            const requestPayload = {
                ...payload,
                username,
                session
            };

            const response: any = await callApiMethod({ ...apiConfig, payload: requestPayload });

            if (response.status === 200) {
                notifySuccess('Password updated successfully');
                // After password reset, navigate to root so AppNavigator can handle redirect
                navigate('/');
            } else if (response.status >= 400) {
                // Handle error response using consolidated error handler
                const errorResult = handleApiError(response, 'Failed to update password');
                notifyError(errorResult.formattedErrors.join('\n'));
            }
        } catch (error: any) {
            // Handle network errors or other exceptions
            const errorResult = handleApiError(error, 'An error occurred while updating password');
            notifyError(errorResult.formattedErrors.join('\n'));
        }
    };

    // If we don't have the required data, redirect to login
    if (!username || !session) {
        React.useEffect(() => {
            navigate('/login');
        }, []);
        return null;
    }

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
            Set New Password
        </Button>

        <div className="PreAuthLoginActions">
            <Link title="Back to login?" url='/login' />
        </div>
    </AuthForm>
    }</>
}; 