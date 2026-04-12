import React from "react";
import { ICreateButtons } from "./buttons/Buttons";
import { IFormFieldResponse } from "./FormField/FormField";
import { IApiConfig } from "../context";
import type { IDetailApiConfig, IDataSourceMixin, IPageConfigBase } from "../types/field-config";
import type { IRedirectOptions } from "../utils/link-utils";
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
    /** Navigation options for submitSuccessRedirect (`replace`, `state`, `target` only). */
    submitSuccessRedirectOptions?: IRedirectOptions;
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

    // IForm.errorHandling extends the base IErrorHandlingConfig with form-specific fields
    // (retryDelay, showCountdown) that are defined directly on IErrorHandlingConfig (#58).

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

    // ===== Progressive Disclosure (#40) =====
    /**
     * Enable progressive disclosure — show essential fields first, with an expand toggle for advanced ones.
     * Fields without a `tier` or with `tier: 'basic'` are always shown.
     * Fields with `tier: 'advanced'` or `tier: 'expert'` are revealed by the toggle.
     */
    disclosure?: {
        enabled: boolean;
        /** Starting tier shown to the user (default: 'basic') */
        defaultTier?: 'basic' | 'advanced';
        /** Labels for the expand/collapse toggles */
        labels?: {
            showAdvanced?: string;   // default: "+ Show advanced fields"
            hideAdvanced?: string;   // default: "- Hide advanced fields"
            showExpert?: string;     // default: "+ Show expert fields"
            hideExpert?: string;     // default: "- Hide expert fields"
        };
    };

    // ===== Backend Response → UI State Mapping (#92) =====
    /**
     * After a successful form submit, map response values back into specific form fields.
     * Useful for auto-generated fields (IDs, timestamps, computed slugs).
     *
     * @example
     * onSuccess: {
     *   updateFields: {
     *     'recordId': 'id',          // form field 'recordId' ← response.id
     *     'slug': 'computed.slug',   // supports dot-notation
     *   }
     * }
     */
    onSuccess?: {
        /** Map: formFieldName → response path (dot-notation supported) */
        updateFields?: Record<string, string>;
    };

    // ===== Record Templates (#42) =====
    /**
     * Pre-defined templates the user can select before filling the form.
     * Each template specifies field values to pre-fill. A picker UI appears at the top of the form.
     */
    templates?: {
        /** List of selectable templates shown in the picker */
        items: Array<{
            id: string;
            /** Label shown in the picker button/dropdown */
            label: string;
            /** Optional description shown as tooltip or sub-label */
            description?: string;
            /** Icon name (from antd icons) for the picker item */
            icon?: string;
            /** Field values to pre-fill when this template is selected */
            values: Record<string, unknown>;
        }>;
        /** Picker UI style: 'buttons' (default) renders clickable cards, 'select' renders a dropdown */
        style?: 'buttons' | 'select';
        /** Label shown above the template picker (default: 'Start from a template') */
        label?: string;
        /** Whether selecting a template clears existing form values first (default: true) */
        replaceValues?: boolean;
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

    // ===== Server-Driven Schema (#100) =====
    /**
     * Fetch form fields (`propertiesConfig`) dynamically from an API endpoint at runtime.
     * The API response must include a `fields` array (or the key specified in `responseKey`).
     * While the schema is loading, a skeleton loader is shown.
     * The static `propertiesConfig` is used as a fallback if the API call fails.
     *
     * @example
     * schemaApiConfig: {
     *   apiUrl: '/tenants/:tenantId/custom-fields',
     *   apiMethod: 'GET',
     *   responseKey: 'fields',
     * }
     */
    schemaApiConfig?: IApiConfig & {
        /** Key in the API response that contains the fields array (default: 'fields') */
        responseKey?: string;
        /**
         * Strategy for merging dynamic and static fields:
         * - 'replace': use only server fields (default)
         * - 'append': append server fields after static fields
         * - 'prepend': prepend server fields before static fields
         */
        mergeStrategy?: 'replace' | 'append' | 'prepend';
    };
}



export { IFormConfig, IForm }