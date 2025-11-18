import React from "react";
import { ICreateButtons } from "./buttons/Buttons";
import { IFormFieldResponse } from "./FormField/FormField";
import { IApiConfig } from "../context";
import { IDetailApiConfig } from "../../detail/Details";
import { ISectionsConfig } from "../../pages/PostAuth/SectionsRenderer";

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
    onCancelCallback?: () => void;  // For modal cancel/close
    children?: React.ReactNode;
    style?: React.CSSProperties;
    apiConfig?: IApiConfig;
    submitSuccessRedirect?: string;
    defaultValues?: Record<string, any>;
    disabled?: boolean;
    buttonLoader?: boolean;
    identifiers ?: any;
    useDynamicIdFromParams?: boolean;
    entityName?: string;  // NEW: Entity name from backend config generation
    /**
     * Additional sections to display below or alongside the main form.
     * From backend: entitySchema.model.editPageConfig.sectionsConfig or createPageConfig.sectionsConfig
     * 
     * Enables multi-section form pages with tabs or accordion UI.
     * Sections have access to live formValues and record data via routeParams.
     */
    sectionsConfig?: ISectionsConfig;
}



export { IFormConfig, IForm }