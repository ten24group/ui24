//'use client';
//import { lazyLoadComponent } from '../utils/lazyLoadComponent';
import React, { ReactNode } from 'react';
import { Layout } from 'antd';
import { Header } from '../../pages';

const { Content, Footer, Sider } = Layout;

interface IChildren{
    children: ReactNode;
}

export const PrivateLayout: React.FC<IChildren> = ({ children }) => {

  return (
    <>
      <Header />
      <Layout >
        <Content >
          {children}
        </Content>
      </Layout>
      <Footer style={{ textAlign: 'center' }}>
        Ten24 ©{new Date().getFullYear()}
      </Footer>
    </>
  );
};