//'use client';
//import { lazyLoadComponent } from '../utils/lazyLoadComponent';
import React, { ReactNode } from 'react';
import { Layout } from 'antd';
import { Header } from '../../pages';
import { useUi24Config } from '../../core/context';
import { CommandPalette } from '../../core/common/CommandPalette';
import { useCommandPalette } from '../../core/common/CommandPalette';
import { useCoreNavigator } from '../../routes/Navigation';

const { Content, Footer } = Layout;

interface IChildren{
    children: ReactNode;
}

export const PrivateLayout: React.FC<IChildren> = ({ children }) => {

  const { selectConfig } = useUi24Config();
  const companyName = selectConfig( config => config.companyName || 'Ten24' );
  const navigate = useCoreNavigator();
  const commandPalette = useCommandPalette(navigate);

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
      <CommandPalette
        open={commandPalette.open}
        onClose={commandPalette.close}
        items={commandPalette.items}
      />
    </>
  );
};