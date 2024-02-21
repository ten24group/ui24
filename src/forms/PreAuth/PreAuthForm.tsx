import React, { Component, ReactNode } from 'react';
import { ICustomForm } from "../../core/forms/formConfig"
import { Button, Checkbox, Form, Input } from 'antd';
import { FormFields } from '../../core';
import { CreateButtons } from "../../core";
import "./PreAuthForm.css";

interface PreAuthForm extends ICustomForm {
    children?: any;
}

export const PreAuthForm = ({
    formConfig = { name: "customForm" },
    propertiesConfig,
    onSubmit,
    formButtons,
    children
} : PreAuthForm) => {

    return <div className="loginFormFields">
            <Form
            name={ formConfig.name }
            className={ formConfig?.className || "" }
            initialValues={ formConfig?.initialValues || {} }
            layout="vertical"
            onFinish={onSubmit} >
                <FormFields propertiesConfig = { propertiesConfig } />
                
                { children }

                <CreateButtons formButtons={ formButtons } />
            </Form>
        </div>
}