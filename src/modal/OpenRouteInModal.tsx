import React, { useState, useEffect, useRef } from 'react';
import { Modal as AntModal } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useResolveRoute } from '../core/hooks/useResolveRoute';
import { Link } from '../core/common';
import { RenderFromPageType } from '../pages/PostAuth/PostAuthPage';
import { ModalContextProvider } from '../core/context';
import { substituteUrlParams } from '../core/utils';

export interface OpenRouteInModalProps {
  /** URL to resolve and open in modal (e.g., "/view-user/:id") */
  url: string;

  /** Route parameters to substitute in URL */
  routeParams?: Record<string, string>;

  /** Primary identifier (fallback for :id param) */
  primaryIndex?: string;

  /** Custom modal width (overrides auto-detection) */
  modalWidth?: number | string;

  /** Override resolved page title */
  modalTitle?: string;

  /** Only open in modal on specified screen size */
  openInModalCondition?: 'sm' | 'md' | 'lg' | 'xl';

  /** Callback when modal operation succeeds */
  onSuccessCallback?: (response?: any) => void;

  /** Trigger element */
  children: React.ReactNode;
}

const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280
};

/**
 * Opens an existing route in a modal by resolving its page configuration
 * Includes improvements:
 * - Auto-resolves routes from entities.json
 * - Debounces opening to prevent duplicates
 * - Closes on route changes
 * - Responsive (can disable modal on mobile)
 * - Auto-detects modal width from page type
 * - Suppresses conflicting actions via ModalContext
 */
export const OpenRouteInModal: React.FC<OpenRouteInModalProps> = ({
  url,
  routeParams = {},
  primaryIndex,
  modalWidth,
  modalTitle,
  openInModalCondition,
  onSuccessCallback,
  children
}) => {
  const [ open, setOpen ] = useState(false);
  const [ opening, setOpening ] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const initialLocation = useRef(location.pathname);

  // Resolve route
  const { found, pageConfig, params, queryParams } = useResolveRoute(
    url,
    { ...routeParams, ...(primaryIndex ? { id: primaryIndex } : {}) }
  );

  // Check if modal should open based on screen size
  const shouldOpenInModal = React.useMemo(() => {
    if (!openInModalCondition) return true;

    if (typeof window === 'undefined') return true;

    const breakpoint = BREAKPOINTS[ openInModalCondition ];
    return window.innerWidth >= breakpoint;
  }, [ openInModalCondition ]);

  // Edge Case 2: Close modal if route changes
  useEffect(() => {
    if (location.pathname !== initialLocation.current && open) {
      setOpen(false);
    }
  }, [ location.pathname, open ]);

  // Handle opening with debounce (Edge Case 1)
  const handleOpen = () => {
    if (opening || open) return; // Prevent duplicate opens

    if (!shouldOpenInModal) {
      // Navigate instead of opening modal
      const finalUrl = substituteUrlParams(url, routeParams, primaryIndex);
      navigate(finalUrl);
      return;
    }

    if (!found) {
      console.warn(`Route not found for modal: ${url}. Falling back to navigation.`);
      const fallbackUrl = substituteUrlParams(url, routeParams, primaryIndex);
      navigate(fallbackUrl);
      return;
    }

    setOpening(true);
    setOpen(true);
    setTimeout(() => setOpening(false), 500); // Debounce duration
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSuccess = (response?: any) => {
    setOpen(false);
    onSuccessCallback?.(response);
  };

  // Auto-detect modal width from page type
  const defaultWidth = React.useMemo(() => {
    if (!pageConfig) return 800;

    switch (pageConfig.pageType) {
      case 'list':
        return '95%';
      case 'details':
        return '95%';
      case 'form':
        return '80%';
      case 'dashboard':
        return '95%';
      case 'accordion':
        return '95%';
      default:
        return 800;
    }

  }, [ pageConfig ]);

  const finalWidth = modalWidth || defaultWidth;
  const finalTitle = modalTitle || pageConfig?.pageTitle;

  // Merge query params from resolved URL
  const finalRouteParams = {
    ...params,
    ...Object.fromEntries(queryParams.entries())
  };

  return (
    <>
      <Link onClick={handleOpen}>
        {children}
      </Link>

      {open && found && pageConfig && (
        <AntModal
          title={finalTitle}
          footer={null}
          open={true}
          onCancel={handleClose}
          width={finalWidth}
          destroyOnClose
        >
          {/* Wrap in ModalContext so actions can check if they're in a modal */}
          <ModalContextProvider>
            <RenderFromPageType
              {...pageConfig}
              routeParams={finalRouteParams}
              onSuccessCallback={handleSuccess}
            />
          </ModalContextProvider>
        </AntModal>
      )}
    </>
  );
};

