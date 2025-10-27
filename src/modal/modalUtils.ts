/**
 * Centralized modal sizing utilities
 * Used by Modal.tsx, OpenRouteInModal.tsx, and backend config generation
 */

export type ModalSizeType = 'confirm' | 'form' | 'list' | 'details' | 'dashboard' | 'accordion' | 'custom';

/**
 * Get default modal width based on page/modal type
 * These are maximums - CSS will constrain with max-width for stacking
 */
export const getDefaultModalWidth = (
  modalType: ModalSizeType,
  explicitWidth?: number | string
): number | string | undefined => {
  // If explicitly provided, use it
  if (explicitWidth !== undefined) {
    return explicitWidth;
  }
  
  // Default widths by type
  switch (modalType) {
    case 'dashboard':
      return 1200;
    case 'accordion':
      return 1200;
    case 'details':
      return 1200;
    case 'list':
      return 1200;
    case 'form':
      return 1000;
    case 'confirm':
      return 520;
    case 'custom':
      return undefined; // Let AntD default
    default:
      return 800;
  }
};

