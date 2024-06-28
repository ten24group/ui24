import React from "react";
import { ICreateButtons } from "./buttons/Buttons";
import { IFormFieldResponse } from "./FormField/FormField";
import { IApiConfig } from "../context";
import { IDetailApiConfig } from "../../detail/Details";

interface IFormConfig {
    name?: string;
    className?: string;
    initialValues?: any;
}

interface IForm extends ICreateButtons, IDetailApiConfig {
    formConfig?: IFormConfig;
    propertiesConfig: Array<IFormFieldResponse>;
    onSubmit: (values: any) => void;
    onSubmitSuccessCallback?: (response?: any) => void;
    children?: React.ReactNode;
    style?: React.CSSProperties;
    apiConfig?: IApiConfig;
    submitSuccessRedirect?: string;
    disabled?: boolean;
    buttonLoader?: boolean;
    identifiers ?: any;
    useDynamicIdFromParams?: boolean;
}



export { IFormConfig, IForm }