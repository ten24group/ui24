import React, { useState } from 'react';
import type { CheckboxProps } from 'antd';
import { Button, Checkbox } from 'antd';
import { useNavigate } from 'react-router-dom';
import { usePageConfig } from '../../core';
import { useApi } from '../../core/context';
import { Link } from '../../core/common';
import { useAppContext } from '../../core/context/AppContext';
import { AuthForm } from '../../forms/Layout/AuthForm';

export const LoginPage = () => {
  return (<LoginForm />);
};

const LoginForm = () => {
  const navigate = useNavigate();

  const { notifySuccess, notifyError } = useAppContext();
  const { propertiesConfig, apiConfig } = usePageConfig("/login");
  const [ loader, setLoader ] = useState<boolean>( false )
  const { callApiMethod } = useApi();
  const {propertiesConfig:signupPropertiesConfig} = usePageConfig("/signup");
  const {propertiesConfig:verifyPropertiesConfig} = usePageConfig("/verify");
  const {propertiesConfig:forgotPasswordPropertiesConfig} = usePageConfig("/forgot-password");


  const onFinish = async (payload: any) => {
    setLoader(true)
    try {
      const response: any = await callApiMethod({...apiConfig, payload });

      if (response.status === 200) {
        if (response.data?.challengeName === 'NEW_PASSWORD_REQUIRED') {
          const userName = payload.username || payload.email;
          navigate('/set-new-password', {
            state: {
              username: userName,
              session: response.data.session
            }
          });
          return;
        }
        notifySuccess("Login Successful!");
        navigate('/dashboard');
      } else if (response?.error) {
        notifyError(response?.error)
      }
    } catch (error: any) {
      notifyError(error?.message || 'An error occurred during login');
    } finally {
      setLoader(false)
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

  return <AuthForm
    onSubmit={onFinish}
    propertiesConfig={ propertiesConfig }
    formButtons={["login"]}
    disabled={ loader }
    buttonLoader={ loader }
  >
      
    { forgotPasswordPropertiesConfig?.length &&
      <div className="PreAuthLoginActions">
          <Checkbox onChange={onChange}>Remember Me</Checkbox>
          <Link className="forgotPassword" title="Forgot Password ?" url='/forgot-password' />
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
  </AuthForm>
}