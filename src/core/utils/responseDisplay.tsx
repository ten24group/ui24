import React from 'react';
import { Modal as AntModal, Button } from 'antd';
import { JsonDescription } from '../common/JsonDescription/JsonDescription';
import { RenderFromPageType } from '../../pages/PostAuth/PostAuthPage';
import { getNestedValue } from '../utils';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '../common';
import type { IResponseDisplayConfig } from '../../modal/Modal';
import { getModalZIndex } from '../../modal/modalUtils';

interface IResponseModalProps {
  visible: boolean;
  responseData: any;
  responseConfig: IResponseDisplayConfig;
  actionModalTitle?: string;
  onClose: () => void;
  modalDepth?: number;
}

/**
 * Generic response modal renderer
 * Can be reused by Modal.tsx, Form.tsx, and other components
 */
export const ResponseModal: React.FC<IResponseModalProps> = ({
  visible,
  responseData,
  responseConfig,
  actionModalTitle,
  onClose,
  modalDepth = 0,
}) => {
  if (!visible || !responseData) {
    return null;
  }

  const {
    modalTitle,
    modalWidth = 707,
    pageType,
    pageConfig,
    showRawJson = false,
    dataPath,
  } = responseConfig;

  // Calculate z-index: response modal should be above the parent modal that triggered it
  // modalDepth represents the parent modal's depth, so we add 1 for the response modal
  const zIndex = getModalZIndex(modalDepth + 1);

  // Extract data from response using dataPath if provided
  const extractedData = dataPath
    ? getNestedValue(responseData, dataPath) || responseData
    : responseData;

  // Determine modal title
  const computedTitle = modalTitle
    || (actionModalTitle ? `${actionModalTitle} - Results` : 'Operation Result');

  // Render content based on configuration
  const renderContent = () => {
    // Option 1: Show raw JSON
    if (showRawJson) {
      return (
        <pre
          style={{
            maxHeight: '500px',
            overflow: 'auto',
            backgroundColor: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            fontSize: '12px',
            lineHeight: '1.5',
          }}
        >
          {JSON.stringify(extractedData, null, 2)}
        </pre>
      );
    }

    // Option 2: Use page type system
    if (pageType && pageConfig) {
      // Build props based on page type
      const renderProps: Record<string, any> = { pageType };

      switch (pageType) {
        case 'form':
          // CRITICAL FOR CHAINING: Render form with previous response data as initialValues
          // Filter out metadata/config fields that shouldn't be form fields
          const {
            nextStep,
            success,
            message,
            errors,
            ...actualFormData
          } = extractedData || {};

          // Extract nested responseConfig if present (for chaining)
          // In chaining, the 'responseConfig' prop IS the 'nextStep' object, which may contain 'responseConfig' for the NEXT step.
          const nestedResponseConfig = responseConfig?.responseConfig;

          renderProps.formPageConfig = {
            ...pageConfig,
            // Merge previous response data with form's initialValues for chaining
            // Only include actual data fields, not metadata
            initialValues: {
              ...(pageConfig.initialValues || {}),
              ...actualFormData,
            },
            // Pass nested responseConfig so the form knows what to do next
            responseConfig: nestedResponseConfig,
            // CRITICAL: Pass dynamicConfigKey from pageConfig to enable continued chaining
            // This allows nested forms to also chain to subsequent steps
            dynamicConfigKey: pageConfig.dynamicConfigKey,
            // Pass close callback so the form can close the ResponseModal on success/cancel
            onCancelCallback: onClose,
          };
          break;

        case 'details':
          renderProps.detailsPageConfig = {
            ...pageConfig,
            dataSource: extractedData,
          };
          break;

        case 'list':
          renderProps.listPageConfig = {
            ...pageConfig,
            // Note: List pages normally fetch data via API
            // For static response display, this might need custom handling
          };
          break;

        case 'dashboard':
          renderProps.dashboardPageConfig = pageConfig;
          break;

        case 'accordion':
          renderProps.accordionsPageConfig = pageConfig;
          break;
      }

      return <RenderFromPageType {...renderProps} />;
    }

    // Option 3: Fallback to auto-JSON rendering
    return <JsonDescription data={extractedData} />;
  };

  return (
    <AntModal
      title={computedTitle}
      open={true}
      width={modalWidth}
      onCancel={onClose}
      zIndex={zIndex}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>,
      ]}
      destroyOnHidden
    >
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={onClose}
      >
        {renderContent()}
      </ErrorBoundary>
    </AntModal>
  );
};

/**
 * Hook for managing response modal state
 * Can be used by any component that needs response display functionality
 */
export const useResponseModal = () => {
  const [ responseModalVisible, setResponseModalVisible ] = React.useState(false);
  const [ responseData, setResponseData ] = React.useState<any>(null);

  const showResponseModal = (data: any) => {
    setResponseData(data);
    setResponseModalVisible(true);
  };

  const hideResponseModal = () => {
    setResponseModalVisible(false);
    setResponseData(null);
  };

  return {
    responseModalVisible,
    responseData,
    showResponseModal,
    hideResponseModal,
  };
};
