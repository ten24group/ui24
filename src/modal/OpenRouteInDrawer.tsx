/**
 * OpenRouteInDrawer.tsx
 *
 * ==========================================
 * VIEW-ORIENTED DRAWER COMPONENT
 * ==========================================
 *
 * PURPOSE: Browse and view entities in a Drawer (slide-out panel)
 *
 * This mirrors OpenRouteInModal, but renders via Ant Design Drawer instead of Modal.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Drawer as AntDrawer, Spin } from 'antd';
import { useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { useResolveRoute } from '../core/hooks/useResolveRoute';
import { useEntityConfig } from '../core/hooks/useEntityConfig';
import type { IEntityConfigReference } from '../core/hooks/useEntityConfig';
import { Link, ErrorFallback } from '../core/common';
import { RenderFromPageType } from '../pages/PostAuth/PostAuthPage';
import { ModalContextProvider } from '../core/context';
import { evaluateTemplateValue } from '../core/utils/template';
import type { Template } from '../core/types';
import { useModalDepth, ModalDepthContext } from './Modal';
import { getModalZIndex } from './modalUtils';

export interface OpenRouteInDrawerProps {
  /** URL to resolve and open in drawer (e.g., "/view-user/:id"). Optional when drawerConfigRef is provided. */
  url?: string;
  /** Route parameters to substitute in URL */
  routeParams?: Readonly<Record<string, string>>;
  /** Primary identifier (fallback for :id param) */
  primaryIndex?: string;
  /** Entity config reference with overrideConfig support (preferred) */
  drawerConfigRef?: IEntityConfigReference;

  /** Drawer title template */
  drawerTitle?: Template;

  /** Drawer placement */
  placement?: 'left' | 'right' | 'top' | 'bottom';
  /** Drawer width (left/right) */
  width?: number | string;
  /** Drawer height (top/bottom) */
  height?: number | string;
  /** Show close button */
  closable?: boolean;
  /** Mask overlay */
  mask?: boolean;
  /** Close on mask click */
  maskClosable?: boolean;
  /** Destroy on close */
  destroyOnClose?: boolean;

  /** Callback when drawer closes */
  onCloseCallback?: () => void;

  /** Trigger element */
  children: React.ReactNode;
}

export const OpenRouteInDrawer: React.FC<OpenRouteInDrawerProps> = ({
  url,
  routeParams = {},
  primaryIndex,
  drawerConfigRef,
  drawerTitle,
  placement = 'right',
  width = 600,
  height = 400,
  closable = true,
  mask = true,
  maskClosable = true,
  destroyOnClose = true,
  onCloseCallback,
  children
}) => {
  const [ open, setOpen ] = useState(false);
  const [ opening, setOpening ] = useState(false);
  const [ loading, setLoading ] = useState(false);
  const location = useLocation();
  const initialLocation = useRef(location.pathname);

  // Track drawer depth for stack effect (same as modal)
  const currentDepth = useModalDepth();
  const nextDepth = currentDepth + 1;

  const { resolveConfigRef } = useEntityConfig();

  const resolvedFromRef = React.useMemo(() => {
    if (!drawerConfigRef) return null;
    return resolveConfigRef(drawerConfigRef);
  }, [ drawerConfigRef, resolveConfigRef ]);

  const { found: foundViaUrl, pageConfig: pageConfigViaUrl } = useResolveRoute(
    url || '',
    { ...routeParams, ...(primaryIndex ? { id: primaryIndex } : {}) }
  );

  const found = drawerConfigRef ? !!resolvedFromRef : foundViaUrl;
  const pageConfig = drawerConfigRef ? resolvedFromRef : pageConfigViaUrl;

  // Close drawer if route changes
  useEffect(() => {
    if (location.pathname !== initialLocation.current && open) {
      setOpen(false);
    }
  }, [ location.pathname, open ]);

  const handleOpen = () => {
    if (opening || open) return;
    setLoading(true);
    setOpening(true);
    setTimeout(() => {
      setOpen(true);
      setLoading(false);
      setOpening(false);
    }, 50);
  };

  const handleClose = () => {
    setOpen(false);
    onCloseCallback?.();
  };

  const evaluatedTitle = drawerTitle
    ? evaluateTemplateValue(drawerTitle, routeParams)
    : undefined;

  return (
    <>
      <Link onClick={() => handleOpen()} className="OpenRouteInDrawer">
        {children}
      </Link>

      {open && (
        <ModalDepthContext.Provider value={nextDepth}>
          <AntDrawer
            title={evaluatedTitle}
            placement={placement}
            width={(placement === 'left' || placement === 'right') ? width : undefined}
            height={(placement === 'top' || placement === 'bottom') ? height : undefined}
            closable={closable}
            mask={mask}
            maskClosable={maskClosable}
            destroyOnHidden={destroyOnClose}
            open={true}
            onClose={handleClose}
            zIndex={getModalZIndex(nextDepth)}
          >
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <Spin />
              </div>
            ) : !found || !pageConfig ? (
              <ErrorFallback error={new Error('Unable to resolve drawer route configuration')} resetErrorBoundary={handleClose} />
            ) : (
              <ErrorBoundary FallbackComponent={ErrorFallback} onReset={handleClose}>
                <ModalContextProvider>
                  <RenderFromPageType {...pageConfig} />
                </ModalContextProvider>
              </ErrorBoundary>
            )}
          </AntDrawer>
        </ModalDepthContext.Provider>
      )}
    </>
  );
};

