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

  const onFinish = async (payload: any) => {
    setLoader(true)
    const response: any = await callApiMethod({...apiConfig, payload });

    if( response.status === 200 ) {
      notifySuccess("Login Successful!");
      navigate('/dashboard');
    } else if( response?.error ) {
      notifyError(response?.error)
    }
    setLoader(false)
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
      <div className="PreAuthLoginActions">
          <Checkbox onChange={onChange}>Remember Me</Checkbox>
          <Link title="Forgot Password ?" url='/forgot-password' />
      </div>

      <div className="PreAuthLoginActions">
        <Button 
              type = "default"
              size = "middle"
              style = {{ width: "48%", margin:"1%" }}
              onClick = {handleRegister}
          > 
            Create Account 
          </Button>

          <Button 
              type = "dashed"
              size = "middle"
              style = {{ width: "48%", margin:"1%" }}
              onClick = {handleVerification}
          > 
            Verify Account 
          </Button>
      </div>
  </AuthForm>
}