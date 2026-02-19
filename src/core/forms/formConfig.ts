import React from "react";
import { ICreateButtons } from "./buttons/Buttons";
import { IFormFieldResponse } from "./FormField/FormField";
import { IApiConfig } from "../context";
import type { IDetailApiConfig, IDataSourceMixin, IPageConfigBase } from "../types/field-config";
import { Template } from "../types";
import type { Condition, ConditionalValue } from "../types/evaluation";
import type { IResponseDisplayConfig } from "../../modal/Modal";

interface IFormConfig {
    name?: string;
    className?: string;
    initialValues?: Record<string, unknown>;
}

interface IForm extends ICreateButtons, IDetailApiConfig, IDataSourceMixin<Record<string, unknown>>, IPageConfigBase {
    formConfig?: IFormConfig;
    propertiesConfig: Array<IFormFieldResponse>;
    onSubmit: (values: Record<string, unknown>) => void;
    onSubmitSuccessCallback?: (response?: Record<string, unknown>) => void;
    onCancelCallback?: () => void;  // For modal cancel/close
    children?: React.ReactNode;
    style?: React.CSSProperties;
    apiConfig?: IApiConfig;

    // ===== Response Handling Config (aligned with FW24) =====
    /** Redirect URL after success. Supports ConditionalValue for condition-based routing. */
    submitSuccessRedirect?: string | ConditionalValue<string>;
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

    /** Config-driven notification control. Overrides successMessage/errorMessage when provided. */
    notification?: {
        success?: { message?: Template; description?: Template; type?: 'message' | 'notification'; duration?: number; };
        error?: { message?: Template; description?: Template; type?: 'message' | 'notification'; duration?: number; };
        skip?: boolean | 'success' | 'error';
    };
    /** Action throttling — cooldown period after execution */
    throttle?: {
        cooldownMs?: number;
        showCountdown?: boolean;
    };

    // ===== Review Before Save Config (#36) =====
    /** Show a diff review modal before submitting form changes */
    reviewBeforeSave?: {
        enabled: boolean;
        /** Only show review when condition passes (e.g. sensitive entities) */
        condition?: Condition;
        /** Which fields to show: specific list or only changed fields */
        fields?: string[] | 'changed-only';
        /** Fields that require explicit confirmation (highlighted in review) */
        requireConfirmFor?: string[];
        /** Review display format */
        format?: 'modal' | 'drawer';
    };

    // ===== Pre-Fill Config =====
    /** Pre-fill form fields from URL query parameters */
    prefill?: {
        enabled: boolean;
        /** Auto-detect field names from URL params (default: true) */
        autoDetect?: boolean;
        /** Lock (disable) pre-filled fields so the user cannot change them */
        lockPrefilled?: boolean;
    };

    // ===== Other Config =====
    defaultValues?: Record<string, unknown>;
    disabled?: boolean;
    buttonLoader?: boolean;
    identifiers?: string | number;
    useDynamicIdFromParams?: boolean;
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
    /** Internal: set of field names that were pre-filled from URL and should be locked (disabled) */
    _prefillFieldNames?: Set<string>;
}



export { IFormConfig, IForm }