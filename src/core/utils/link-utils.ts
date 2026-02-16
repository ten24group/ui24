import React from 'react';

/**
 * Navigation options for success redirects after form/modal submission.
 * Mirrors IRedirectOptions from fw24/src/entity/base-entity.ts.
 */
export interface IRedirectOptions {
  replace?: boolean;
  state?: unknown;
  /** Open redirect URL in a new browser tab. Use '_blank' for external URLs (e.g. OAuth flows). */
  target?: '_blank' | '_self';
}

/**
 * Check if a URL points to an external domain (http://, https://, or protocol-relative //).
 */
export const isExternalUrl = (url?: string): boolean =>
  !!url && /^(https?:\/\/|\/\/)/i.test(url);

/**
 * Check if a mouse event has modifier keys (Ctrl/Cmd, Alt, Shift) or is a non-left click.
 * When true, the browser's default behavior should be preserved (e.g. open in new tab).
 */
export const isModifiedEvent = (e: React.MouseEvent): boolean =>
  e.metaKey || e.altKey || e.ctrlKey || e.shiftKey || e.button !== 0;

/**
 * Resolve the `target` and `rel` attributes for an anchor element.
 *
 * @param explicitTarget - Explicitly configured target (e.g. from field config)
 * @param url            - The href; used to auto-detect external URLs when no explicit target is set
 * @returns `{ target, rel }` ready to spread onto an `<a>` element
 */
export const resolveAnchorProps = (
  explicitTarget?: string,
  url?: string,
): { target?: string; rel?: string } => {
  const target = explicitTarget || (isExternalUrl(url) ? '_blank' : undefined);
  const rel = target === '_blank' ? 'noopener noreferrer' : undefined;
  return { target, rel };
};

/**
 * Navigate to a URL, choosing the right mechanism:
 * - External URL + `_blank` target → `window.open`
 * - External URL + default target  → `window.location.href`
 * - Internal URL                   → calls the provided `navigate` callback (SPA router)
 */
export const navigateToUrl = (
  url: string,
  navigate: (url: string, options?: IRedirectOptions) => void,
  options?: IRedirectOptions,
): void => {
  if (isExternalUrl(url)) {
    if (options?.target === '_blank') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = url;
    }
  } else {
    navigate(url, options);
  }
};
