import React from "react";
import { ICreateButtons } from "./buttons/Buttons";
import { IFormField } from "./FormField/FormField";

interface IFormConfig {
    name?: string;
    className?: string;
    initialValues?: any;
}

interface ICustomForm extends ICreateButtons {
    formConfig?: IFormConfig;
    propertiesConfig: Array<IFormField>;
    onSubmit: (values: any) => void;
    children?: React.ReactNode;
    style?: React.CSSProperties;
}



export { IFormConfig, ICustomForm }