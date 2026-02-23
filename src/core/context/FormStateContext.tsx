/**
 * Form-level dynamic context (changes frequently).
 * Provided by FormPage wrapper, available to form components.
 * 
 * Uses use-context-selector for selective subscription.
 */
import { createContext, useContextSelector } from 'use-context-selector';
import React, { ReactNode } from 'react';
import { useDevToolsReport } from '../devtools/store/snapshot';
import { useEntityName } from './PageStaticContext';

export interface FormStateContextValue {
  record: any | null;
  formValues: Record<string, any>;
  isDirty: boolean;
  isValid: boolean;
  errors?: Record<string, string[]>;
}

export const FormStateContext = createContext<FormStateContextValue | null>(null);

export const FormStateProvider = ({
  children,
  value
}: {
  children: ReactNode;
  value: FormStateContextValue;
}) => {
  const entityName = useEntityName();
  useDevToolsReport('form', entityName ? `Form: ${entityName}` : 'Form', value);

  return (
    <FormStateContext.Provider value={value}>
      {children}
    </FormStateContext.Provider>
  );
};

// Selector hooks
export const useFormRecord = () =>
  useContextSelector(FormStateContext, state => state?.record);

export const useFormValues = () =>
  useContextSelector(FormStateContext, state => state?.formValues || {});

export const useFormValue = (fieldName: string) =>
  useContextSelector(
    FormStateContext,
    state => state?.formValues?.[fieldName]
  );

export const useFormIsDirty = () =>
  useContextSelector(FormStateContext, state => state?.isDirty ?? false);

export const useFormIsValid = () =>
  useContextSelector(FormStateContext, state => state?.isValid ?? true);

export const useFormErrors = () =>
  useContextSelector(FormStateContext, state => state?.errors);

export const useFormFieldError = (fieldName: string) =>
  useContextSelector(
    FormStateContext,
    state => state?.errors?.[fieldName]
  );

// Full context (use in evaluation system)
export const useFormStateContext = () =>
  useContextSelector(FormStateContext, state => state);
