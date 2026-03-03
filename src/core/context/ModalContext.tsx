import React, { createContext, useContext } from 'react';

export interface IModalContext {
  /** Whether the current component is rendered inside a modal */
  isInModal: boolean;
  /** Function to close the modal/drawer. Only available when isInModal is true. */
  closeModal?: () => void;
}

const ModalContext = createContext<IModalContext>({
  isInModal: false
});

export const useModalContext = () => useContext(ModalContext);

export const ModalContextProvider: React.FC<{
  children: React.ReactNode;
  onClose?: () => void;
}> = ({ children, onClose }) => {
  return (
    <ModalContext.Provider value={{ isInModal: true, closeModal: onClose }}>
      {children}
    </ModalContext.Provider>
  );
};

