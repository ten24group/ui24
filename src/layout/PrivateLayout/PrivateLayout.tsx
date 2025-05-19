//'use client';
//import { lazyLoadComponent } from '../utils/lazyLoadComponent';
import React, { ReactNode } from 'react';
import { Layout } from 'antd';
import { Header } from '../../pages';
import { useUi24Config } from '../../core/context';

const { Content, Footer, Sider } = Layout;

interface IChildren{
    children: ReactNode;
}

export const PrivateLayout: React.FC<IChildren> = ({ children }) => {

  const { selectConfig } = useUi24Config();
  const companyName = selectConfig( config => config.companyName || 'Ten24' );

  return (
    <>
      <Header />
      <Layout >
        <Content >
          {children}
        </Content>
      </Layout>
      <Footer style={{ textAlign: 'center' }}>
        {companyName} © {new Date().getFullYear()}
      </Footer>
    </>
  );
};