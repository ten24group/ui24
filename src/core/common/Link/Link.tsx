import { useNavigate } from 'react-router-dom';
import React, { Component, ReactNode } from 'react';

type ILinkProps = { url: string; title: string; children?: ReactNode } | { url: string; children: ReactNode; title?: string };

export function Link ({title, url, children }: ILinkProps ) {
  const navigate = useNavigate();
  return <a onClick={ () => navigate(url) } className="forgotPassowrd">
      { title !== "" ? title : "" } { children !== undefined ? children : "" }
    </a>
}