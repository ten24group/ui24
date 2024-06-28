import React from "react";
import { IForm } from "../../core/forms/formConfig"
import { Form } from '../Form';
import { convertColumnsConfigForFormField } from '../../core';
import "./AuthForm.css";

export const AuthForm = ({
    formConfig = { name: "customForm" },
    children,
    ...props
} : IForm) => {

    const { propertiesConfig } = props;
    const formPropertiesConfig: Array<any> = propertiesConfig?.length > 0 ? convertColumnsConfigForFormField(propertiesConfig) : [];

    if( propertiesConfig.length === 0 ) {
        return null;
    }

    return <div className="loginFormFields">
            <Form
            formConfig={ formConfig}
            propertiesConfig={ formPropertiesConfig}
            {...props}
            >
                { children }
            </Form>
        </div>
}