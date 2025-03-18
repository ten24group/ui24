import React from "react";
import { IForm } from "../../core/forms/formConfig"
import { Form } from '../Form';
import { convertColumnsConfigForFormField } from '../../core';
import "./AuthForm.css";

interface AuthFormProps extends IForm {
    message?: string;
}

export const AuthForm = ({
    formConfig = { name: "customForm" },
    children,
    message,
    ...props
} : AuthFormProps) => {

    const { propertiesConfig } = props;
    const formPropertiesConfig: Array<any> = propertiesConfig?.length > 0 ? convertColumnsConfigForFormField(propertiesConfig) : [];

    if( propertiesConfig.length === 0 ) {
        return null;
    }

    return (
        <div className="loginFormFields">
            {message && (
                <div className="auth-alert auth-alert-primary">
                    {message}
                </div>
            )}
            <Form
                formConfig={formConfig}
                propertiesConfig={formPropertiesConfig}
                {...props}
            >
                {children}
            </Form>
        </div>
    );
}