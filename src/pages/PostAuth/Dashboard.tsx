import React from 'react';
import { DashboardLayout } from "../../layout"
import { CustomForm, IFormConfig } from '../../forms/Form';
import { usePageConfig } from '../../core';

export const Dashboard = () => {
    const onFinish = (values: any) => {
        console.log('Received values of form: ', values);
    };

    const [ propertiesConfig ] = usePageConfig("/create-account");

    const formConfig : IFormConfig = {
        name: "createAccount",
        className: "login-form"
      }


      return <>{ propertiesConfig && <DashboardLayout><div style={{ paddingTop: "10%"}}><CustomForm formConfig = { formConfig } 
      propertiesConfig={ propertiesConfig } 
      onSubmit={ onFinish } 
      formButtons={ ["submit", "cancel"] } /></div>
  </DashboardLayout>}</>;
}