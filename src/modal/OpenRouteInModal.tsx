/**
 * OpenRouteInModal.tsx
 * 
 * ==========================================
 * VIEW-ORIENTED MODAL COMPONENT
 * ==========================================
 * 
 * PURPOSE: Browse and view entities in modals (read-only operations)
 * 
 * USE THIS WHEN:
 * - Viewing entity details (e.g., "View Team", "View Player")
 * - Browsing related lists (e.g., "View Home Games", "View Team Players")
 * - Opening any route from entities.json in a modal
 * 
 * USE Modal.tsx (OpenInModal) INSTEAD WHEN:
 * - Performing actions (delete, approve, reject)
 * - Submitting forms that trigger API calls
 * - Showing confirmation dialogs
 * 
 * ==========================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { Modal as AntModal, Spin } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { useResolveRoute } from '../core/hooks/useResolveRoute';
import { useEntityConfig } from '../core/hooks/useEntityConfig';
import type { IEntityConfigReference } from '../core/hooks/useEntityConfig';
import { Link, ErrorFallback } from '../core/common';
import { RenderFromPageType } from '../pages/PostAuth/PostAuthPage';
import { ModalContextProvider } from '../core/context';
import { substituteUrlParams } from '../core/utils';
import { getDefaultModalWidth } from './modalUtils';
import { evaluateTemplateValue } from '../core/utils/template';
import type { Template } from '../core/types';
import { useCoreNavigator } from '../routes/Navigation';
import { useModalDepth, ModalDepthContext } from './Modal';

export interface OpenRouteInModalProps {
  /** 
   * URL to resolve and open in modal (e.g., "/view-user/:id")
   * Optional when modalConfigRef is provided.
   */
  url?: string;

  /** Route parameters to substitute in URL */
  routeParams?: Record<string, string>;

  /** Primary identifier (fallback for :id param) */
  primaryIndex?: string;

  /**
   * Entity config reference with overrideConfig support (optional).
   * If provided, uses resolveConfigRef() instead of route resolution.
   * This ensures overrideConfig (defaultFilters, hideFields, etc.) is properly applied.
   * When using modalConfigRef, url is optional.
   * 
   * @example
   * modalConfigRef={{
   *   entityName: 'gameStat',
   *   pageType: 'list',
   *   overrideConfig: {
   *     defaultFilters: { gameId: ':gameId' }
   *   }
   * }}
   */
  modalConfigRef?: IEntityConfigReference;

  /** Custom modal width (overrides auto-detection) */
  modalWidth?: number | string;

  /**
   * Modal title - can be static string or dynamic template.
   * Evaluated from routeParams when modal opens.
   * 
   * @example modalTitle: "View Team"
   * @example modalTitle: "View {teamName}"
   */
  modalTitle?: Template;

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
 * OpenRouteInModal - View-Oriented Modal Component
 * 
 * PURPOSE:
 * Opens existing entity pages (list, view, create, update) in a modal by resolving 
 * their configuration from entities.json. This is the "read-only" or "browse" modal.
 * 
 * WHEN TO USE:
 * ✅ View entity details in modal (e.g., "View Team", "View Player Stats")
 * ✅ Browse related entity lists (e.g., "View Home Games", "View Team Players")
 * ✅ Open any route defined in entities.json as a modal
 * ✅ Need lazy config loading (performance optimization)
 * ✅ Need overrideConfig support (defaultFilters, hideFields, etc.)
 * 
 * WHEN NOT TO USE (use OpenInModal instead):
 * ❌ Action modals with API calls (delete, approve, reject)
 * ❌ Form submissions that trigger API operations
 * ❌ Confirmation dialogs with OK/Cancel buttons
 * ❌ Response display modals (show API results)
 * ❌ Navigation-only forms (filter form → navigate)
 * 
 * KEY FEATURES:
 * - Auto-resolves page config from entities.json via route pattern
 * - Supports modalConfigRef for overrideConfig (filters, field visibility)
 * - Lazy loading: only resolves config when modal opens
 * - Auto-closes on route changes (navigation cleanup)
 * - Responsive: can disable modal on mobile (openInModalCondition)
 * - Modal depth tracking for nested modals (visual stacking)
 * - Error boundaries for safe rendering
 * - destroyOnHidden for clean unmount
 * 
 * EXAMPLE USAGE:
 * ```tsx
 * // Example 1: Simple - Open entity detail
 * <OpenRouteInModal 
 *   url="/view-team/:teamId" 
 *   routeParams={{ teamId: 'team-123' }}
 * >
 *   <Button>View Team</Button>
 * </OpenRouteInModal>
 * 
 * // Example 2: With custom title template
 * <OpenRouteInModal
 *   url="/view-team/:teamId"
 *   routeParams={{ teamId: 'team-123', teamName: 'Lakers' }}
 *   modalTitle="Team Details - {teamName}"
 *   modalWidth={900}
 * >
 *   <Button>View Lakers</Button>
 * </OpenRouteInModal>
 * 
 * // Example 3: Filtered list with overrideConfig (to-many relation)
 * <OpenRouteInModal
 *   url="/list-game"
 *   modalConfigRef={{
 *     entityName: 'game',
 *     pageType: 'list',
 *     overrideConfig: {
 *       defaultFilters: { homeTeamId: ':teamId' }  // Filters applied automatically
 *     }
 *   }}
 *   routeParams={{ teamId: 'team-123', teamName: 'Lakers' }}
 *   modalTitle="Home Games - {teamName}"
 * >
 *   <Button type="text" size="small" icon={<UnorderedListOutlined />} />
 * </OpenRouteInModal>
 * 
 * // Example 4: Responsive modal (desktop only)
 * <OpenRouteInModal
 *   url="/view-player/:playerId"
 *   routeParams={{ playerId: 'player-456' }}
 *   openInModalCondition="md"  // Opens modal on md+ screens, navigates on mobile
 * >
 *   <Button>View Player</Button>
 * </OpenRouteInModal>
 * ```
 * 
 * COMPARISON WITH OpenInModal:
 * - OpenRouteInModal: Browse entities (this component)
 * - OpenInModal: Perform actions (see Modal.tsx)
 * 
 * @see Modal.tsx - OpenInModal component for action-oriented modals
 * @see useResolveRoute - Route resolution logic
 * @see useEntityConfig - Config resolution with overrideConfig support
 */
export const OpenRouteInModal: React.FC<OpenRouteInModalProps> = ({
  url,
  routeParams = {},
  primaryIndex,
  modalConfigRef,
  modalWidth,
  modalTitle,
  openInModalCondition,
  onSuccessCallback,
  children
}) => {
  const [ open, setOpen ] = useState(false);
  const [ opening, setOpening ] = useState(false);
  const [ loading, setLoading ] = useState(false);
  const location = useLocation();
  const navigate = useCoreNavigator();
  const initialLocation = useRef(location.pathname);

  // Track modal depth for stack effect
  const currentDepth = useModalDepth();
  const nextDepth = currentDepth + 1;

  // Resolution strategy:
  // 1. If modalConfigRef provided, use it (supports overrideConfig for defaultFilters, hideFields, etc.)
  // 2. Otherwise, fall back to URL resolution (backward compatible)
  const { resolveConfigRef } = useEntityConfig();

  // Resolve via modalConfigRef (preferred - supports overrideConfig)
  const resolvedFromRef = React.useMemo(() => {
    if (!modalConfigRef) return null;
    return resolveConfigRef(modalConfigRef);
  }, [ modalConfigRef, resolveConfigRef ]);

  // Resolve via URL (fallback - backward compatible, only if url is provided)
  const { found: foundViaUrl, pageConfig: pageConfigViaUrl, params, queryParams } = useResolveRoute(
    url || '', // Empty string if url not provided (when using modalConfigRef)
    { ...routeParams, ...(primaryIndex ? { id: primaryIndex } : {}) }
  );

  // Use resolved config (prioritize modalConfigRef, fallback to URL resolution)
  const found = modalConfigRef ? !!resolvedFromRef : foundViaUrl;
  const pageConfig = modalConfigRef ? resolvedFromRef : pageConfigViaUrl;

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

  // Handle opening with debounce and loading state
  const handleOpen = () => {
    if (opening || open) return; // Prevent duplicate opens

    if (!shouldOpenInModal) {
      // Navigate instead of opening modal (responsive behavior)
      const finalUrl = substituteUrlParams(url, routeParams, primaryIndex);
      navigate(finalUrl);
      return;
    }

    // Show loading while resolving config
    setLoading(true);
    setOpening(true);

    // Small delay for config resolution (if needed)
    setTimeout(() => {
      if (!found) {
        console.warn(`Route not found for modal: ${url}. Falling back to navigation.`);
        const fallbackUrl = substituteUrlParams(url, routeParams, primaryIndex);
        navigate(fallbackUrl);
        setLoading(false);
        setOpening(false);
        return;
      }

      setOpen(true);
      setLoading(false);
      setOpening(false);
    }, 100); // Brief delay for smooth UX
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSuccess = (response?: any) => {
    setOpen(false);
    onSuccessCallback?.(response);
  };

  // Use centralized width calculation
  const finalWidth = React.useMemo(() => {
    if (!pageConfig) return getDefaultModalWidth('details', modalWidth);

    return getDefaultModalWidth(pageConfig.pageType as any, modalWidth);
  }, [ pageConfig, modalWidth ]);

  // Merge route params: original routeParams + resolved params from URL + query params
  // This ensures custom params (like teamId, homeTeamId from identifierMapping) are preserved
  // Memoized to prevent unnecessary re-renders and duplicate API calls
  const finalRouteParams = React.useMemo(() => ({
    ...routeParams,  // Include original route params (important for filters and record data)
    ...params,        // Override with params extracted from URL pattern
    ...Object.fromEntries(queryParams.entries())  // Add query params
  }), [ routeParams, params, queryParams ]);

  // Evaluate modalTitle template if provided, otherwise use page title
  // Use finalRouteParams (includes record data) instead of just params
  const finalTitle = React.useMemo(() => {
    const pageTitleFallback = pageConfig?.pageTitle;
    return modalTitle
      ? evaluateTemplateValue(modalTitle, finalRouteParams, pageTitleFallback)
      : pageTitleFallback;
  }, [ modalTitle, finalRouteParams, pageConfig?.pageTitle ]);

  return (
    <>
      <Link onClick={handleOpen}>
        {children}
      </Link>

      {/* Loading state while resolving config */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000
        }}>
          <Spin size="large" />
        </div>
      )}

      {/* Actual modal with resolved page config */}
      {open && found && pageConfig && (
        <ModalDepthContext.Provider value={nextDepth}>
          <AntModal
            title={finalTitle}
            footer={null}
            open={true}
            onCancel={handleClose}
            width={finalWidth}
            destroyOnHidden
            wrapClassName={`modal-depth-${currentDepth}`}
          >
            <ErrorBoundary
              FallbackComponent={ErrorFallback}
              onReset={() => {
                console.log("OpenRouteInModal ErrorBoundary Reset");
                handleClose(); // Close modal on error reset
              }}
            >
              {/* Wrap in ModalContext so child components know they're in a modal */}
              <ModalContextProvider>
                <RenderFromPageType
                  {...pageConfig}
                  routeParams={finalRouteParams}
                  onSuccessCallback={handleSuccess}
                  onCancelCallback={handleClose}
                />
              </ModalContextProvider>
            </ErrorBoundary>
          </AntModal>
        </ModalDepthContext.Provider>
      )}
    </>
  );
};

