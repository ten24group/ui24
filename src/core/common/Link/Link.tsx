import { useCoreNavigator } from '../../../routes/Navigation';
import React, { ReactNode } from 'react';
import { isExternalUrl, isModifiedEvent, resolveAnchorProps } from '../../utils/link-utils';

type ICommonLinkProps = {
  title?: string;
  children?: ReactNode
} & React.AnchorHTMLAttributes<HTMLAnchorElement>

type ILinkProps = ({ url?: string; onClick: (url?: string) => void } | { url: string; onClick?: (url?: string) => void }) & ICommonLinkProps;

export function Link({ title, url, children, onClick, target, ...props }: ILinkProps) {
  const navigate = useCoreNavigator();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    // Let the browser handle: modifier keys (Ctrl/Cmd+click), middle-click, or _blank target
    if (isModifiedEvent(e) || target === '_blank') {
      onClick?.(url);
      return;
    }

    e.preventDefault();
    onClick?.(url);

    if (url) {
      if (isExternalUrl(url)) {
        window.open(url, target || '_blank', 'noopener,noreferrer');
      } else {
        navigate(url);
      }
    }
  };

  const href = url || undefined;
  const { target: resolvedTarget, rel } = resolveAnchorProps(target, url);

  return (
    <a href={href} target={resolvedTarget} rel={rel} onClick={handleClick} {...props}>
      {title} {children}
    </a>
  );
}
