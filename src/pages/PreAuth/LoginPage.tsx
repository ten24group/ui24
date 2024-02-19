import React from 'react';
import { Link } from '../../forms/PostAuthForm';
import { Checkbox  } from 'antd';
import { preAuthMethods } from '../../core/pages';
import { PreAuthForm } from '../../forms/PreAuth/PreAuthForm';
import { LoginLayout } from '../../layout';
import type { CheckboxProps } from 'antd';

export const LoginPage = () => {

  const { onFinish , propertiesConfig, formConfig } = preAuthMethods();
  const onChange: CheckboxProps['onChange'] = (e) => {
      //TOOD: Remember Me    
  };

  return (
    <LoginLayout>
        <PreAuthForm
        layoutConfig= {{
          title: "Admin Login",
          description: "Restricted area."
        }}
        onSubmit={onFinish}
        propertiesConfig={ propertiesConfig }
        formConfig={ formConfig }
        formButtons={ ["login" ]}>
                <div className="PreAuthLoginActions">
                    <Checkbox onChange={onChange}>Remember Me</Checkbox>
                    <Link title="Forgot Password ?" url='/forgot-password' />
                </div>
        </PreAuthForm>
    </LoginLayout>
  );
};