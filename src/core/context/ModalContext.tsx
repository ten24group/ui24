import React, { createContext, useContext } from 'react';

export interface IModalContext {
  /** Whether the current component is rendered inside a modal */
  isInModal: boolean;
}

const ModalContext = createContext<IModalContext>({
  isInModal: false
});

export const useModalContext = () => useContext(ModalContext);

export const ModalContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ModalContext.Provider value={{ isInModal: true }}>
      {children}
    </ModalContext.Provider>
  );
};

