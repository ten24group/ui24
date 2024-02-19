import React, { Component, ReactNode } from 'react';
import { ICustomForm } from "../../core/forms/formConfig"
import { Button, Checkbox, Form, Input } from 'antd';
import { CustomFormFields, Link } from "../PostAuthForm";
import { CreateButtons } from "../../core";
import "./PreAuthForm.css";

interface PreAuthForm extends ICustomForm {
    layoutConfig : {
        title: string;
        description: string;
    }
    children?: any;
}

export const PreAuthForm = ({
    layoutConfig,
    formConfig = { name: "customForm" },
    propertiesConfig,
    onSubmit,
    formButtons,
    children
} : PreAuthForm) => {

    return <div className="preAuthLoginContainer">
        <div className="containerTop">
            <div className="title">{ layoutConfig.title } </div>
            <div className="description">{ layoutConfig.description }</div>
        </div>

        <div className="loginFormFields">
            <Form
            name={ formConfig.name }
            className={ formConfig?.className || "" }
            initialValues={ formConfig?.initialValues || {} }
            layout="vertical"
            onFinish={onSubmit} >
                <CustomFormFields propertiesConfig = { propertiesConfig } />
                
                { children }

                <CreateButtons formButtons={ formButtons } />
            </Form>
        </div>
  </div>
}