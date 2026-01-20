/**
 * WizardPage - Wrapper component for multi-step form wizards
 * 
 * Handles wizard rendering with API integration, success/error handling,
 * and integration with the framework's OperationExecutor.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Card, message } from 'antd';
import { FormWizard, type IWizardPageConfig, type WizardApiClient } from '../../core/common/FormWizard';
import { useApi } from '../../core/context/ApiContext';
import { useOperationExecutor } from '../../core/services/OperationExecutor';
import { PageHeader, IPageHeader } from '../PostAuth/PageHeader/PageHeader';
import type { IResponseDisplayConfig } from '../../modal/Modal';
import type { Template } from '../../core/types';

interface IWizardPageProps extends IWizardPageConfig, IPageHeader {
  cardStyle?: React.CSSProperties;
  routeParams?: Readonly<Record<string, string | number | undefined>>;
  depth?: number;
  /** Callback after successful wizard completion */
  onSubmitSuccessCallback?: (response?: unknown) => void;
  /** Callback when wizard is cancelled */
  onCancelCallback?: () => void;
  /** Redirect URL after successful submission */
  submitSuccessRedirect?: string;
  /** Navigation options for redirect */
  submitSuccessRedirectOptions?: { replace?: boolean; state?: unknown };
  /** Configuration for showing response in modal */
  responseConfig?: IResponseDisplayConfig;
  /** Key to extract dynamic config from response */
  dynamicConfigKey?: string;
  /** Refresh parent component on success */
  refreshParentOnSuccess?: boolean;
  /** Error message template */
  errorMessage?: Template;
  /** Skip success toast notification */
  skipSuccessToast?: boolean;
  /** Skip error toast notification */
  skipErrorToast?: boolean;
  /** Close modal on error */
  closeModalOnError?: boolean;
}

export const WizardPage: React.FC<IWizardPageProps> = ({
  // Wizard config props
  title,
  helpText,
  steps,
  apiConfig,
  initialValues,
  showStepNumbers,
  allowStepClick,
  submitText,
  cancelText,
  showCancel,
  successMessage,
  showSuccessResult,
  // Page props
  cardStyle,
  routeParams,
  onSubmitSuccessCallback,
  onCancelCallback,
  pageHeaderActions,
  pageTitle,
  breadcrumbs,
  // Response handling props (from Modal)
  submitSuccessRedirect,
  submitSuccessRedirectOptions,
  responseConfig,
  dynamicConfigKey,
  refreshParentOnSuccess,
  errorMessage,
  skipSuccessToast,
  skipErrorToast,
  closeModalOnError
}) => {
  const operationExecutor = useOperationExecutor();
  const { callApiMethod } = useApi();
  const [ isSubmitting, setIsSubmitting ] = useState(false);

  // Create API client wrapper for FormWizard's dynamic field loading
  const wizardApiClient: WizardApiClient = useMemo(() => {
    return async ({ apiUrl, apiMethod, payload }) => {
      return callApiMethod({
        apiUrl,
        apiMethod,
        payload,
      });
    };
  }, [ callApiMethod ]);

  // Handle wizard completion
  const handleComplete = useCallback(async (values: Record<string, unknown>) => {
    if (!apiConfig) {
      console.error('[WizardPage] No apiConfig provided - wizard cannot submit');
      message.error('Configuration error: Unable to submit wizard');
      // Still call success callback so modal/page can handle gracefully
      onSubmitSuccessCallback?.(values);
      return;
    }

    setIsSubmitting(true);
    try {
      await operationExecutor.execute(
        {
          apiConfig: {
            ...apiConfig,
            payload: values
          },
          routeParams,
          successMessage,
          errorMessage,
          // Skip toast if showing success result OR if explicitly configured
          skipSuccessToast: showSuccessResult || skipSuccessToast,
          skipErrorToast,
          refreshParentOnSuccess: refreshParentOnSuccess ?? !!onSubmitSuccessCallback,
          // Response handling config (same as forms)
          submitSuccessRedirect,
          submitSuccessRedirectOptions,
          responseConfig,
          dynamicConfigKey,
          closeModalOnError,
        },
        {
          onSuccess: (data) => {
            onSubmitSuccessCallback?.(data);
          },
          onRefresh: () => {
            // Trigger any parent refreshes
            onSubmitSuccessCallback?.();
          },
          onClose: onCancelCallback,
        }
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    apiConfig, operationExecutor, routeParams, successMessage, errorMessage, showSuccessResult,
    skipSuccessToast, skipErrorToast, refreshParentOnSuccess, submitSuccessRedirect,
    submitSuccessRedirectOptions, responseConfig, dynamicConfigKey, closeModalOnError,
    onSubmitSuccessCallback, onCancelCallback
  ]);

  // Handle wizard cancel
  const handleCancel = useCallback(() => {
    onCancelCallback?.();
  }, [ onCancelCallback ]);

  return (
    <>
      {(pageTitle || breadcrumbs || pageHeaderActions) && (
        <PageHeader
          pageTitle={pageTitle}
          breadcrumbs={breadcrumbs}
          pageHeaderActions={pageHeaderActions}
        />
      )}
      <Card
        title={title}
        style={{
          margin: '20px',
          ...cardStyle
        }}
      >
        {helpText && <div style={{ marginBottom: '20px', color: '#666' }}>{helpText}</div>}
        <FormWizard
          steps={steps}
          onComplete={handleComplete}
          onCancel={showCancel !== false ? handleCancel : undefined}
          initialValues={initialValues}
          showStepNumbers={showStepNumbers}
          allowStepClick={allowStepClick}
          submitText={submitText}
          cancelText={cancelText}
          showCancel={showCancel}
          successMessage={successMessage}
          showSuccessResult={showSuccessResult}
          isSubmitting={isSubmitting}
          apiClient={wizardApiClient}
        />
      </Card>
    </>
  );
};

export default WizardPage;
