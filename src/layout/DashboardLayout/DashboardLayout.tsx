//'use client';
//import { lazyLoadComponent } from '../utils/lazyLoadComponent';
import React, { ReactNode, lazy, Suspense } from 'react';
import { Breadcrumb, Layout, theme } from 'antd';
import { Header } from '../../pages';

const { Content, Footer, Sider } = Layout;

const items = new Array(8).fill(null).map((_, index) => ({
  key: index + 1,
  label: `nav ${index + 1}`,
}));

interface IChildren{
    children: ReactNode;
}

export const DashboardLayout: React.FC<IChildren> = ({ children }) => {

  return (
    <Layout style={{ minHeight: "100vh"}}>
      <Header />
      <Layout >
        <Content >
          {children}
        </Content>
      </Layout>
      <Footer style={{ textAlign: 'center' }}>
        Ten24 ©{new Date().getFullYear()}
      </Footer>
    </Layout>
  );
};