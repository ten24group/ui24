//'use client';
//import { lazyLoadComponent } from '../utils/lazyLoadComponent';
import React, { ReactNode } from 'react';
import { Layout } from 'antd';
import { CoreLayout } from '../CoreLayout';
import { Header } from '../../pages';
import { useAuth } from '../../core';
import { AppNavigator } from '../../routes/AppRouter';

const { Content, Footer, Sider } = Layout;

interface IChildren{
    children: ReactNode;
}

export const PostAuthLayout: React.FC<IChildren> = ({ children }) => {
  const { isLoggedIn } = useAuth();

  if( !isLoggedIn ) {
    return <AppNavigator />
}
  
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