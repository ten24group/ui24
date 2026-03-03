/**
 * FormWizard - A multi-step form wizard component
 * 
 * Provides a stepped form interface using Ant Design's Steps component.
 * Each step can have its own form fields and validation.
 * 
 * @example
 * <FormWizard
 *   steps={[
 *     { title: 'Select Template', fields: [...] },
 *     { title: 'Fill Variables', fields: [...] },
 *     { title: 'Configure', fields: [...] },
 *     { title: 'Preview', component: PreviewComponent },
 *   ]}
 *   onComplete={(values) => console.log('All values:', values)}
 * />
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Steps, Button, Form, Card, Space, App, Result, Spin } from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import { FormField, convertColumnsConfigForFormField } from '../../forms/FormField/FormField';
import type { IFormFieldResponse } from '../../types/field-config';

export interface WizardStep {
  /** Step title */
  title: string;
  /** Step description (optional) */
  description?: string;
  /** Step icon (optional) */
  icon?: React.ReactNode;
  /** Form fields for this step (use this OR component) */
  fields?: IFormFieldResponse[];
  /** Custom component for this step (use this OR fields) */
  component?: React.ComponentType<WizardStepComponentProps>;
  /** Async validation for this step (called before moving to next step) */
  onValidate?: (values: Record<string, unknown>, allValues: Record<string, unknown>) => Promise<boolean | string>;
  /** Skip this step based on values */
  shouldSkip?: (allValues: Record<string, unknown>) => boolean;
  /** API to call to get dynamic fields */
  apiConfig?: {
    apiUrl: string;
    apiMethod: 'GET' | 'POST';
    body?: Record<string, unknown>;
    responseKey?: string;
  };
}

export interface WizardStepComponentProps {
  /** Current step values */
  values: Record<string, unknown>;
  /** All accumulated values */
  allValues: Record<string, unknown>;
  /** Update values for current step */
  setValues: (values: Record<string, unknown>) => void;
  /** Move to next step */
  onNext: () => void;
  /** Move to previous step */
  onPrev: () => void;
  /** Is loading (e.g., calling API) */
  isLoading: boolean;
}

/** API client function type for dynamic field loading */
export type WizardApiClient = (config: {
  apiUrl: string;
  apiMethod: 'GET' | 'POST';
  payload?: Record<string, unknown>;
}) => Promise<{ data: any; status: number }>;

export interface FormWizardProps {
  /** Wizard steps */
  steps: WizardStep[];
  /** Called when wizard completes */
  onComplete: (values: Record<string, unknown>) => void | Promise<void>;
  /** Called when wizard is cancelled */
  onCancel?: () => void;
  /** Initial values */
  initialValues?: Record<string, unknown>;
  /** Show step numbers */
  showStepNumbers?: boolean;
  /** Allow navigation by clicking steps */
  allowStepClick?: boolean;
  /** Custom submit button text */
  submitText?: string;
  /** Custom cancel button text */
  cancelText?: string;
  /** Show cancel button */
  showCancel?: boolean;
  /** Loading state for final submission */
  isSubmitting?: boolean;
  /** Success message after completion */
  successMessage?: string;
  /** Show success result after completion */
  showSuccessResult?: boolean;
  /** 
   * API client for dynamic field loading (recommended for authenticated endpoints)
   * If not provided, falls back to raw fetch without auth headers
   */
  apiClient?: WizardApiClient;
}

export const FormWizard: React.FC<FormWizardProps> = ({
  steps,
  onComplete,
  onCancel,
  initialValues = {},
  showStepNumbers = true,
  allowStepClick = false,
  submitText = 'Complete',
  cancelText = 'Cancel',
  showCancel = true,
  isSubmitting = false,
  successMessage = 'Successfully completed!',
  showSuccessResult = false,
  apiClient,
}) => {
  const { message } = App.useApp();
  const [ currentStep, setCurrentStep ] = useState(0);
  const [ allValues, setAllValues ] = useState<Record<string, unknown>>(initialValues);
  const [ stepValues, setStepValues ] = useState<Record<string, unknown>>({});
  const [ isValidating, setIsValidating ] = useState(false);
  const [ isComplete, setIsComplete ] = useState(false);
  const [ dynamicFields, setDynamicFields ] = useState<Record<number, IFormFieldResponse[]>>({});
  const [ loadingFields, setLoadingFields ] = useState(false);
  const formRef = useRef<any>(null);

  // Get active steps (filtering out skipped ones)
  const activeSteps = useMemo(() => {
    return steps.filter((step) => {
      if (step.shouldSkip) {
        return !step.shouldSkip(allValues);
      }
      return true;
    });
  }, [ steps, allValues ]);

  const currentStepConfig = activeSteps[ currentStep ];
  const isLastStep = currentStep === activeSteps.length - 1;

  // Get fields for current step
  const currentFields = useMemo(() => {
    const stepIndex = steps.indexOf(currentStepConfig);
    if (dynamicFields[ stepIndex ]) {
      return convertColumnsConfigForFormField(dynamicFields[ stepIndex ]);
    }
    if (currentStepConfig?.fields) {
      return convertColumnsConfigForFormField(currentStepConfig.fields);
    }
    return [];
  }, [ currentStepConfig, dynamicFields, steps ]);

  // Load dynamic fields if step has apiConfig
  const loadDynamicFields = useCallback(async (step: WizardStep, stepIndex: number) => {
    if (!step.apiConfig) return;

    setLoadingFields(true);
    try {
      const { apiUrl, apiMethod, body, responseKey } = step.apiConfig;
      const payload = apiMethod === 'POST' ? { ...body, ...allValues } : undefined;

      let data: any;

      // Use provided apiClient if available (includes auth headers)
      // Otherwise fall back to raw fetch (for unauthenticated endpoints only)
      if (apiClient) {
        const response = await apiClient({ apiUrl, apiMethod, payload });
        if (response.status >= 200 && response.status < 300) {
          data = response.data;
        } else {
          throw new Error(`API call failed with status ${response.status}`);
        }
      } else {
        // Fallback: raw fetch without auth (will fail for protected endpoints)
        console.warn('[FormWizard] No apiClient provided - using raw fetch without auth headers');
        const response = await fetch(apiUrl, {
          method: apiMethod,
          headers: { 'Content-Type': 'application/json' },
          body: payload ? JSON.stringify(payload) : undefined,
        });
        if (!response.ok) {
          throw new Error(`API call failed with status ${response.status}`);
        }
        data = await response.json();
      }

      const fields = responseKey ? data[ responseKey ] : data.fields || data;
      setDynamicFields(prev => ({ ...prev, [ stepIndex ]: fields }));
    } catch (error) {
      console.error('[FormWizard] Failed to load dynamic fields:', error);
      message.error('Failed to load form fields');
    } finally {
      setLoadingFields(false);
    }
  }, [ allValues, apiClient ]);

  // Handle step change
  const handleStepChange = useCallback(async (newStep: number) => {
    const stepConfig = activeSteps[ newStep ];
    const stepIndex = steps.indexOf(stepConfig);

    // Load dynamic fields if needed
    if (stepConfig?.apiConfig && !dynamicFields[ stepIndex ]) {
      await loadDynamicFields(stepConfig, stepIndex);
    }
  }, [ activeSteps, steps, dynamicFields, loadDynamicFields ]);

  // Handle next step
  const handleNext = useCallback(async () => {
    // Track current values locally to avoid stale closure issues
    let currentValues = stepValues;
    let accumulated = allValues;

    // Validate form if it exists
    if (formRef.current) {
      try {
        const values = await formRef.current.validateFields();
        // Update local variables FIRST (for use in this function)
        currentValues = values;
        accumulated = { ...allValues, ...values };
        // Then update state (for re-renders)
        setStepValues(values);
        setAllValues(accumulated);
      } catch (error) {
        return; // Validation failed
      }
    }

    // Run custom validation if provided - use local variables, not stale state
    if (currentStepConfig?.onValidate) {
      setIsValidating(true);
      try {
        const result = await currentStepConfig.onValidate(currentValues, accumulated);
        if (result === false) {
          setIsValidating(false);
          return;
        }
        if (typeof result === 'string') {
          message.error(result);
          setIsValidating(false);
          return;
        }
      } catch (error) {
        message.error('Validation failed');
        setIsValidating(false);
        return;
      }
      setIsValidating(false);
    }

    if (isLastStep) {
      // Complete the wizard - use accumulated local values
      const finalValues = accumulated;
      try {
        await onComplete(finalValues);
        if (showSuccessResult) {
          setIsComplete(true);
        }
      } catch (error) {
        message.error('Failed to complete');
      }
    } else {
      // Move to next step
      const nextStep = currentStep + 1;
      await handleStepChange(nextStep);
      setCurrentStep(nextStep);
      setStepValues({});
    }
  }, [ currentStep, currentStepConfig, stepValues, allValues, isLastStep, onComplete, showSuccessResult, handleStepChange ]);

  // Handle previous step
  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [ currentStep ]);

  // Handle step click
  const handleStepClick = useCallback(async (step: number) => {
    if (!allowStepClick) return;
    if (step <= currentStep) {
      setCurrentStep(step);
    }
  }, [ allowStepClick, currentStep ]);

  // Update step values from form
  const handleFormValuesChange = useCallback((_: unknown, values: Record<string, unknown>) => {
    setStepValues(values);
  }, []);

  // Show success result
  if (isComplete) {
    return (
      <Result
        status="success"
        title={successMessage}
        extra={
          onCancel && (
            <Button onClick={onCancel}>
              Done
            </Button>
          )
        }
      />
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Steps indicator */}
      <Steps
        current={currentStep}
        progressDot={!showStepNumbers}
        items={activeSteps.map((step, index) => ({
          title: step.title,
          description: step.description,
          icon: step.icon,
          status: index < currentStep ? 'finish' : index === currentStep ? 'process' : 'wait',
        }))}
        onChange={allowStepClick ? handleStepClick : undefined}
        style={{ marginBottom: 24 }}
        size="small"
      />

      {/* Step content */}
      <Card style={{ minHeight: 300, marginBottom: 24 }}>
        {loadingFields ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} tip="Loading form..." />
          </div>
        ) : currentStepConfig?.component ? (
          // Custom component
          <currentStepConfig.component
            values={stepValues}
            allValues={allValues}
            setValues={(values) => {
              setStepValues(values);
              setAllValues(prev => ({ ...prev, ...values }));
            }}
            onNext={handleNext}
            onPrev={handlePrev}
            isLoading={isValidating || isSubmitting}
          />
        ) : (
          // Form fields
          <Form
            ref={formRef}
            layout="vertical"
            initialValues={{ ...allValues, ...stepValues }}
            onValuesChange={handleFormValuesChange}
          >
            {currentFields.map((field) => (
              <FormField key={field.name} {...field} />
            ))}
          </Form>
        )}
      </Card>

      {/* Navigation buttons */}
      {!currentStepConfig?.component && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            {showCancel && onCancel && (
              <Button onClick={onCancel}>
                {cancelText}
              </Button>
            )}
          </Space>
          <Space>
            {currentStep > 0 && (
              <Button onClick={handlePrev} icon={<ArrowLeftOutlined />}>
                Previous
              </Button>
            )}
            <Button
              type="primary"
              onClick={handleNext}
              loading={isValidating || isSubmitting}
              icon={isLastStep ? <CheckOutlined /> : <ArrowRightOutlined />}
            >
              {isLastStep ? submitText : 'Next'}
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
};

export default FormWizard;
