//'use client';
//import { lazyLoadComponent } from '../utils/lazyLoadComponent';
import React, { ReactNode } from 'react';
import { Layout } from 'antd';
import { CoreLayout } from '../CoreLayout';
import { Header } from '../../pages';


const { Content, Footer, Sider } = Layout;

const items = new Array(8).fill(null).map((_, index) => ({
  key: index + 1,
  label: `nav ${index + 1}`,
}));

interface IChildren{
    children: ReactNode;
}

export const PostAuthLayout: React.FC<IChildren> = ({ children }) => {
  
  return (
    <CoreLayout >
      <Header />
      <Layout >
        <Content >
          {children}
        </Content>
      </Layout>
      <Footer style={{ textAlign: 'center' }}>
        Ten24 ©{new Date().getFullYear()}
      </Footer>
    </CoreLayout>
  );
};