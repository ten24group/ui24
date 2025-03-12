import { useCoreNavigator } from '../../../routes/Navigation';
import React, { Component, ReactNode } from 'react';

type ICommonLinkProps = {
  title?: string;
  children?: ReactNode
} & React.AnchorHTMLAttributes<HTMLAnchorElement>

type ILinkProps = ({ url?: string; onClick: (url?: string) => void } | { url: string; onClick?: (url?: string) => void }) & ICommonLinkProps;

export function Link ({title, url, children, onClick, ...props }: ILinkProps ) {
  const navigate = useCoreNavigator();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    e.preventDefault(); // Prevent the default anchor behavior
    if( onClick ) {
      onClick(url)
    }

    if( url ) {
      navigate(url);
    }
  };

  return <a onClick={ handleClick }  {...props} >
      { title !== "" ? title : "" } { children !== undefined ? children : "" }
    </a>
}