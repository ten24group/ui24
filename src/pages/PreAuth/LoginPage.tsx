import React from 'react';
import type { CheckboxProps } from 'antd';
import { Button, Checkbox } from 'antd';
import { useNavigate } from 'react-router-dom';
import { callApiMethod, usePageConfig } from '../../core';
import { Link } from '../../core/common';
import { useAppContext } from '../../core/context/AppContext';
import { PreAuthForm } from '../../forms/PreAuth/PreAuthForm';
import { PreAuthLayout } from '../../layout';

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
  const {propertiesConfig:signupPropertiesConfig} = usePageConfig("/signup");
  const {propertiesConfig:verifyPropertiesConfig} = usePageConfig("/verify");
  const {propertiesConfig:forgotPasswordPropertiesConfig} = usePageConfig("/forgot-password");


  const onFinish = async (payload: any) => {
    const response: any = await callApiMethod({...apiConfig, payload });

    if( response.status === 200 ) {
      notifySuccess("Login Successful!");
      navigate('/dashboard');
    } else if( response?.error ) {
      notifyError(response?.error)
    }
  }

  const onChange: CheckboxProps['onChange'] = (e) => {
      //TODO: Remember Me    
  };

  const handleRegister = (e) => {
      navigate('/registration');
  };
  const handleVerification = (e) => {
      navigate('/verification');
  };

  return <PreAuthForm
    onSubmit={onFinish}
    propertiesConfig={ propertiesConfig }
    formButtons={["login"]}
  >
      
    { forgotPasswordPropertiesConfig?.length &&
      <div className="PreAuthLoginActions">
          <Checkbox onChange={onChange}>Remember Me</Checkbox>
          <Link title="Forgot Password ?" url='/forgot-password' />
      </div>
    }

    <div className="PreAuthLoginActions">
      {signupPropertiesConfig?.length &&
        <Button 
            type = "default"
            size = "middle"
            style = {{ width: "48%", margin:"1%" }}
            onClick = {handleRegister}
        > 
          Create Account 
        </Button>
      }
      { verifyPropertiesConfig?.length &&  <Button 
            type = "dashed"
            size = "middle"
            style = {{ width: "48%", margin:"1%" }}
            onClick = {handleVerification}
        > 
          Verify Account 
        </Button>
      }
    </div>
  </PreAuthForm>
}