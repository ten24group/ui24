import { useNavigate } from 'react-router-dom';
import React, { Component, ReactNode } from 'react';

type ILinkProps = { url?: string; title?: string; children?: ReactNode, onClick?: Function } | { url: string; children: ReactNode; title?: string, onClick?: Function };

export function Link ({title, url, children, onClick }: ILinkProps ) {
  const navigate = useNavigate();
  return <a onClick={ () => {
    onClick && onClick(url)
    !onClick && navigate(url)
    } } className="forgotPassowrd">
      { title !== "" ? title : "" } { children !== undefined ? children : "" }
    </a>
}