import React from "react";
import { ICreateButtons } from "./buttons/Buttons";
import { IFormFieldResponse } from "./FormField/FormField";
import { IApiConfig } from "../context";
import { IDetailApiConfig } from "../../detail/Details";
import { ISectionsConfig } from "../../pages/PostAuth/SectionsRenderer";
import { Template } from "../types";
import type { IResponseDisplayConfig } from "../../modal/Modal";

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

    // ===== Response Handling Config (aligned with FW24) =====
    submitSuccessRedirect?: string;
    /**
     * Navigation options for submitSuccessRedirect
     * Uses react-router-dom's NavigateOptions: { replace?: boolean; state?: unknown; }
     */
    submitSuccessRedirectOptions?: {
        replace?: boolean;
        state?: unknown;
    };
    responseConfig?: IResponseDisplayConfig; // Show response in modal
    dynamicConfigKey?: string; // Extract next-step config from response (chaining)
    refreshParentOnSuccess?: boolean; // Trigger parent refresh
    successMessage?: Template; // Custom success toast
    errorMessage?: Template; // Custom error toast
    closeModalOnError?: boolean; // Control modal closing on error
    skipSuccessToast?: boolean; // Skip success toast
    skipErrorToast?: boolean; // Skip error toast

    // ===== Other Config =====
    defaultValues?: Record<string, any>;
    disabled?: boolean;
    buttonLoader?: boolean;
    identifiers?: any;
    useDynamicIdFromParams?: boolean;
    entityName?: string;  // NEW: Entity name from backend config generation
    /**
     * Help text to display at the top of the form (below title, above fields).
     * From backend: entitySchema.model.formPageConfig.helpText
     */
    helpText?: string;
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