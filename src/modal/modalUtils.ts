/**
 * Centralized modal sizing and z-index utilities
 * Used by Modal.tsx, OpenRouteInModal.tsx, and backend config generation
 */

export type ModalSizeType = 'confirm' | 'form' | 'list' | 'details' | 'dashboard' | 'accordion' | 'custom';

/**
 * Base z-index for modal/drawer components.
 * Ant Design's default modal z-index is 1000.
 * We use this as the base and add depth to create proper stacking.
 */
export const MODAL_BASE_ZINDEX = 1000;

/**
 * Calculate z-index for a modal or drawer based on its depth in the stack.
 * 
 * @param depth - The depth level (0 = page, 1 = first modal, 2 = nested modal, etc.)
 * @returns The calculated z-index value
 * 
 * @example
 * // Page level (depth 0)
 * getModalZIndex(0) // returns 1000
 * 
 * // First modal (depth 1)
 * getModalZIndex(1) // returns 1001
 * 
 * // Response modal from first modal (depth 2)
 * getModalZIndex(2) // returns 1002
 */
export function getModalZIndex(depth: number): number {
  return MODAL_BASE_ZINDEX + depth;
}

/**
 * Convert page type string to ModalSizeType for width calculation
 */
export function toModalSizeType(pageType: string | undefined): ModalSizeType {
  if (!pageType) return 'details';

  switch (pageType) {
    case 'view':
      return 'details';
    case 'create':
    case 'edit':
      return 'form';
    case 'list':
      return 'list';
    case 'dashboard':
      return 'dashboard';
    case 'accordion':
      return 'accordion';
    case 'confirm':
      return 'confirm';
    case 'custom':
      return 'custom';
    default:
      return 'details';
  }
}

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
      return 1200;
    case 'confirm':
      return 520;
    case 'custom':
      return undefined; // Let AntD default
    default:
      return 707;
  }
};

