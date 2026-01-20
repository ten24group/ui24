/**
 * Wizard page configuration types for multi-step forms.
 * These interfaces define the structure of wizard configurations passed from backend to frontend.
 */

import type { IFormFieldResponse } from '../../types/field-config';
import type { IApiConfig } from '../../context';

/**
 * Wizard step configuration for a single step in the wizard.
 * Each step can have its own form fields and validation.
 */
export interface IWizardStepConfig {
  /** Step title */
  title: string;
  /** Step description (optional) */
  description?: string;
  /** Step icon (optional) - icon name from Ant Design */
  icon?: string;
  /** Form fields for this step */
  fields?: IFormFieldResponse[];
  /** API to call to get dynamic fields for this step */
  apiConfig?: {
    apiUrl: string;
    apiMethod: 'GET' | 'POST';
    body?: Record<string, unknown>;
    responseKey?: string;
  };
}

/**
 * Wizard page configuration for multi-step forms.
 * Provides a stepped form interface using Ant Design's Steps component.
 */
export interface IWizardPageConfig {
  /** Wizard title */
  title?: string;
  /** Help text shown at the top */
  helpText?: string;
  /** Wizard steps */
  steps: IWizardStepConfig[];
  /** API configuration for final submission */
  apiConfig: IApiConfig;
  /** Initial form values */
  initialValues?: Record<string, unknown>;
  /** Show step numbers (default: true) */
  showStepNumbers?: boolean;
  /** Allow navigation by clicking steps (default: false) */
  allowStepClick?: boolean;
  /** Custom submit button text (default: 'Complete') */
  submitText?: string;
  /** Custom cancel button text (default: 'Cancel') */
  cancelText?: string;
  /** Show cancel button (default: true) */
  showCancel?: boolean;
  /** Success message after completion */
  successMessage?: string;
  /** Show success result after completion (default: false) */
  showSuccessResult?: boolean;
}
