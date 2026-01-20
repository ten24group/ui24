/**
 * ResponseModalContext.tsx
 * 
 * Global context for response modal management.
 * Renders response modal ONCE at app level - no duplication in Modal, Drawer, Form, etc.
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { IResponseDisplayConfig } from '../../modal/Modal';
import { ResponseModal } from '../utils/responseDisplay';

interface ResponseModalContextValue {
  showResponseModal: (data: any, config: IResponseDisplayConfig, onModalClose?: () => void) => void;
  hideResponseModal: () => void;
}

const ResponseModalContext = createContext<ResponseModalContextValue | null>(null);

interface ResponseModalProviderProps {
  children: ReactNode;
}

/**
 * Provider that manages global response modal state
 * Should be placed at app level (in UI24.tsx)
 * 
 * SUPPORTS CHAINING/WIZARD FLOWS:
 * - Calling showResponseModal while modal is open will smoothly transition to new content
 * - This enables multi-step flows where each step is a response modal
 * - Example: Step 1 (form) → submit → Step 2 (confirmation) → submit → Step 3 (results)
 */
export const ResponseModalProvider: React.FC<ResponseModalProviderProps> = ({ children }) => {
  const [ visible, setVisible ] = useState(false);
  const [ responseData, setResponseData ] = useState<any>(null);
  const [ responseConfig, setResponseConfig ] = useState<IResponseDisplayConfig | null>(null);
  const [ parentTitle, setParentTitle ] = useState<string | undefined>(undefined);
  const [ onModalCloseCallback, setOnModalCloseCallback ] = useState<(() => void) | null>(null);

  const showResponseModal = (data: any, config: IResponseDisplayConfig, onModalClose?: () => void) => {
    // Always update data/config first
    setResponseData(data);
    setResponseConfig(config);
    setParentTitle(config.modalTitle);

    // Store close callback for parent modal
    // Only set if we are not already visible (start of chain) to preserve the original parent closer
    if (onModalClose && !visible) {
      setOnModalCloseCallback(() => onModalClose);
    }

    // Then ensure visibility (handles both new modals and chaining)
    if (!visible) {
      setVisible(true);
    }
    // If already visible, React will re-render with new data automatically
  };

  const hideResponseModal = () => {
    // Close modal immediately
    setVisible(false);

    // Call parent modal close callback if exists
    if (onModalCloseCallback) {
      onModalCloseCallback();
      setOnModalCloseCallback(null);
    }

    // Clear data/config synchronously to avoid setTimeout races
    setResponseData(null);
    setResponseConfig(null);
    setParentTitle(undefined);
  };

  const contextValue: ResponseModalContextValue = {
    showResponseModal,
    hideResponseModal
  };

  return (
    <ResponseModalContext.Provider value={contextValue}>
      {children}

      {/* SINGLE response modal for entire app */}
      {responseConfig && (
        <ResponseModal
          visible={visible}
          responseData={responseData}
          responseConfig={responseConfig}
          actionModalTitle={parentTitle}
          onClose={hideResponseModal}
        />
      )}
    </ResponseModalContext.Provider>
  );
};

/**
 * Hook to access global response modal
 * Used by OperationExecutor
 */
export const useResponseModalContext = (): ResponseModalContextValue => {
  const context = useContext(ResponseModalContext);
  if (!context) {
    throw new Error('useResponseModalContext must be used within ResponseModalProvider');
  }
  return context;
};
