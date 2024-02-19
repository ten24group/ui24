import React from 'react';
import { usePageConfig } from "../../core";
import { IFormConfig } from '../../core/forms/formConfig';
import { LoginLayout } from "../../layout";
import { PreAuthForm } from '../../forms/PreAuth/PreAuthForm';

export const ForgotPassword = () => {
    const onFinish = (values: any) => {
        console.log('Received values of form: ', values);
    };

    const { propertiesConfig } = usePageConfig("/forgot-password");

    const formConfig : IFormConfig = {
        name: "forgotPasswordForm",
        className: "login-form"
    }

    return <>{ propertiesConfig && <LoginLayout><PreAuthForm
        layoutConfig= {{
          title: "Admin Login",
          description: "Restricted area."
        }}
        onSubmit={onFinish}
        propertiesConfig={ propertiesConfig }
        formConfig={ formConfig }
        formButtons={ ["forgotPassword" ]} />
    </LoginLayout>}</>;

}