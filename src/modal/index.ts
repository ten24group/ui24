/**
 * Modal module exports
 */

export { Modal, OpenInModal, ModalDepthContext, useModalDepth } from './Modal';
export type { IModalConfig, INavigateToConfig, IResponseDisplayConfig } from './Modal';

export { Drawer, OpenInDrawer } from './Drawer';
export type { IDrawerConfig, IDrawerProps } from './Drawer';

export { OpenRouteInModal } from './OpenRouteInModal';
export type { OpenRouteInModalProps } from './OpenRouteInModal';

export { OpenRouteInDrawer } from './OpenRouteInDrawer';
export type { OpenRouteInDrawerProps } from './OpenRouteInDrawer';

export { getDefaultModalWidth } from './modalUtils';
