import React from 'react';
import { usePageConfig } from "../../core";
import { IFormConfig } from '../../core/forms/formConfig';
import { PreAuthLayout } from "../../layout";
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

    return <>{ propertiesConfig && <PreAuthLayout><PreAuthForm
        onSubmit={onFinish}
        propertiesConfig={ propertiesConfig }
        formConfig={ formConfig }
        formButtons={ ["forgotPassword" ]} />
    </PreAuthLayout>}</>;

}