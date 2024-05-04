import React, { Component, ReactNode } from 'react';
import { ICustomForm } from "../../core/forms/formConfig"
import { Button, Checkbox, Form, Input } from 'antd';
import { FormField, IFormFieldResponse, IFormField } from '../../core';
import { convertColumnsConfigForFormField } from '../../core';
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
    children,
} : PreAuthForm) => {

    const formPropertiesConfig: IFormField[] = propertiesConfig.length > 0 ? convertColumnsConfigForFormField(propertiesConfig) : [];

    return <div className="loginFormFields">
            <Form
            name={ formConfig.name }
            className={ formConfig?.className || "" }
            initialValues={ formConfig?.initialValues || {} }
            layout="vertical"
            onFinish={onSubmit} >
                { formPropertiesConfig.map( (item: IFormField, index: number) => {
                    return <React.Fragment key={ "internalForm" + index }><FormField {...item} /></React.Fragment>
                } ) }
                
                { children }

                <CreateButtons formButtons={ formButtons } />
            </Form>
        </div>
}