import React from 'react';
import { usePageConfig } from "../../core";
import { IFormConfig } from '../../core/forms/formConfig';
import { LoginLayout } from "../../layout";
import { PreAuthForm } from '../../forms/PreAuth/PreAuthForm';

export const ResetPassword = () => {
    const onFinish = (values: any) => {
        console.log('Received values of form: ', values);
    };

    const formConfig : IFormConfig = {
        name: "forgotPasswordForm",
        className: "login-form"
    }

    const { propertiesConfig } = usePageConfig("/reset-password");

    return <>{ propertiesConfig && <LoginLayout> <PreAuthForm
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