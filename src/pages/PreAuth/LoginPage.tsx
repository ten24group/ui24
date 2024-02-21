import React from 'react';
import { Link } from '../../core/common';
import { Checkbox  } from 'antd';
import { preAuthMethods } from '../../core/pages';
import { PreAuthForm } from '../../forms/PreAuth/PreAuthForm';
import { PreAuthLayout } from '../../layout';
import type { CheckboxProps } from 'antd';

export const LoginPage = () => {

  const { onFinish , propertiesConfig, formConfig } = preAuthMethods();
  const onChange: CheckboxProps['onChange'] = (e) => {
      //TOOD: Remember Me    
  };

  return (
    <PreAuthLayout>
        <PreAuthForm
        onSubmit={onFinish}
        propertiesConfig={ propertiesConfig }
        formConfig={ formConfig }
        formButtons={ ["login" ]}>
                <div className="PreAuthLoginActions">
                    <Checkbox onChange={onChange}>Remember Me</Checkbox>
                    <Link title="Forgot Password ?" url='/forgot-password' />
                </div>
        </PreAuthForm>
    </PreAuthLayout>
  );
};