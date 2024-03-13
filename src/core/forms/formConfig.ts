import React from "react";
import { ICreateButtons } from "./Buttons/Buttons";
import { IFormFieldResponse } from "./FormField/FormField";
import { IApiConfig } from "../api/apiMethods";
import { IDetailApiConfig } from "../../detail/Details";

interface IFormConfig {
    name?: string;
    className?: string;
    initialValues?: any;
}

interface ICustomForm extends ICreateButtons, IDetailApiConfig {
    formConfig?: IFormConfig;
    propertiesConfig: Array<IFormFieldResponse>;
    onSubmit: (values: any) => void;
    children?: React.ReactNode;
    style?: React.CSSProperties;
    apiConfig: IApiConfig;
    submitSuccessRedirect?: string;
}



export { IFormConfig, ICustomForm }