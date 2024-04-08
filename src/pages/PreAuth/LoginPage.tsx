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

export const LoginPage = () => {
  const { notifySuccess, notifyError } = useAppContext()
  const { propertiesConfig, apiConfig } = usePageConfig("/login");

  const onFinish = async (values: any) => {
    const response: any = await callApiMethod({
      ...apiConfig,
      payload: values
    });

    if( response.status === 200 ) {
      //set token in json
    } else if( response?.error ) {
      notifyError(response?.error)
    }
  }

  const formConfig : IFormConfig = {
      name: "loginForm",
      className: "login-form"
  }
  const onChange: CheckboxProps['onChange'] = (e) => {
      //TOOD: Remember Me    
  };

  return (
    <PreAuthLayout>
        <PreAuthForm
        onSubmit={onFinish}
        propertiesConfig={ propertiesConfig }
        formButtons={ ["login" ]}>
          <div className="PreAuthLoginActions">
              <Checkbox onChange={onChange}>Remember Me</Checkbox>
              <Link title="Forgot Password ?" url='/forgot-password' />
          </div>
        </PreAuthForm>
    </PreAuthLayout>
  );
};