import React from 'react';
import { usePageConfig } from "../../core";
import { IFormConfig } from "../../forms/Form";
import { LoginLayout } from "../../layout";
import { CustomForm } from "../../forms/Form";

export const ResetPassword = () => {
    const onFinish = (values: any) => {
        console.log('Received values of form: ', values);
    };

    const formConfig : IFormConfig = {
        name: "forgotPasswordForm",
        className: "login-form"
    }

    const [ propertiesConfig ] = usePageConfig("/reset-password");

    return <>{ propertiesConfig && <LoginLayout><CustomForm formConfig = { formConfig } 
        propertiesConfig={ propertiesConfig } 
        onSubmit={ onFinish } 
        formButtons={ ["submit"] } />
    </LoginLayout>}</>;

}