import React from 'react';
import { Link } from '../../core/common';
import { Checkbox } from 'antd';
import { IFormConfig } from '../../core/forms/formConfig';
import { PreAuthForm } from '../../forms/PreAuth/PreAuthForm';
import { usePageConfig } from '../../core';
import { PreAuthLayout } from '../../layout';
import { callApiMethod } from '../../core';
import type { CheckboxProps } from 'antd';
import { useAppContext } from '../../core/context/AppContext';
import { useNavigate } from 'react-router-dom';

export const LoginPage = () => {
  return (
    <PreAuthLayout>
        <LoginForm />
    </PreAuthLayout>
  );
};

const LoginForm = () => {
  const navigate = useNavigate();

  const { notifySuccess, notifyError } = useAppContext();
  const { propertiesConfig, apiConfig } = usePageConfig("/login");

  const onFinish = async (values: any) => {
    const response: any = await callApiMethod({
      ...apiConfig,
      payload: values
    });

    if( response.status === 200 ) {
      notifySuccess("Login Successful!");
      navigate('/dashboard');
    } else if( response?.error ) {
      notifyError(response?.error)
    }
  }

  const formConfig : IFormConfig = {
      name: "loginForm",
      className: "login-form"
  }
  const onChange: CheckboxProps['onChange'] = (e) => {
      //TODO: Remember Me    
  };

  return <PreAuthForm
    onSubmit={onFinish}
    propertiesConfig={ propertiesConfig }
    formButtons={ ["login" ]}
  >
      <div className="PreAuthLoginActions">
          <Checkbox onChange={onChange}>Remember Me</Checkbox>
          <Link title="Forgot Password ?" url='/forgot-password' />
      </div>
  </PreAuthForm>
}