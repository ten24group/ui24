import React from 'react';
import { Modal as AntModal, Button } from 'antd';
import { JsonDescription } from '../common/JsonDescription/JsonDescription';
import { RenderFromPageType } from '../../pages/PostAuth/PostAuthPage';
import { getNestedValue } from '../utils';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '../common';
import type { IResponseDisplayConfig } from '../../modal/Modal';

interface IResponseModalProps {
  visible: boolean;
  responseData: any;
  responseConfig: IResponseDisplayConfig;
  actionModalTitle?: string;
  onClose: () => void;
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
        case 'details':
          renderProps.detailsPageConfig = {
            ...pageConfig,
            detailResponse: extractedData, // Inject response data
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
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>,
      ]}
      destroyOnClose
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
  const [responseModalVisible, setResponseModalVisible] = React.useState(false);
  const [responseData, setResponseData] = React.useState<any>(null);

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

