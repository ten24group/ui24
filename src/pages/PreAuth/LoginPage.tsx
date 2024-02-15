import React from 'react';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { CustomForm, IFormField, IFormConfig } from '../../forms/Form';
import { convertColumnsConfigForFormField } from '../../core/forms';
import { LoginLayout } from '../../layout';
import { apiResponse } from '../../core/mock';
import { usePageConfig } from '../../core';

export function LoginPage() {
    const onFinish = (values: any) => {
      console.log('Received values of form: ', values);
    };
    
    const [ propertiesConfig ] = usePageConfig("/login");

    const formConfig : IFormConfig = {
      name: "loginForm",
      className: "login-form"
    }
    
    return <>{ propertiesConfig && <LoginLayout><CustomForm formConfig = { formConfig } 
        propertiesConfig={ propertiesConfig } 
        onSubmit={ onFinish } 
        formButtons={ ["login"] } />
    </LoginLayout>}</>;
}