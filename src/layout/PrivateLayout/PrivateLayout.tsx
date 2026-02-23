//'use client';
//import { lazyLoadComponent } from '../utils/lazyLoadComponent';
import React, { ReactNode, useEffect } from 'react';
import { Layout } from 'antd';
import { Header } from '../../pages';
import { useUi24Config } from '../../core/context';
import { CommandPalette } from '../../core/common/CommandPalette';
import { useCommandPalette } from '../../core/common/CommandPalette';
import { useCoreNavigator } from '../../routes/Navigation';
import { MaintenancePage } from '../MaintenancePage';

const { Content, Footer } = Layout;

interface IChildren{
    children: ReactNode;
}

export const PrivateLayout: React.FC<IChildren> = ({ children }) => {

  const { selectConfig } = useUi24Config();
  const companyName = selectConfig( config => config.companyName || 'Ten24' );
  const environment = selectConfig( (config: { environment?: { name?: string; showBanner?: boolean; color?: string; titlePrefix?: boolean } }) => config.environment );
  const maintenance = selectConfig( (config: { maintenance?: { enabled?: boolean; message?: string } }) => config.maintenance );
  const navigate = useCoreNavigator();
  const commandPalette = useCommandPalette(navigate);

  // Environment title prefix (#86)
  useEffect(() => {
    if (environment?.titlePrefix && environment.name) {
      const base = document.title.replace(/^\[.*?\]\s*/, '');
      document.title = `[${environment.name}] ${base}`;
    }
  }, [ environment?.titlePrefix, environment?.name ]);

  // Maintenance mode gate (#86) — renders a full-screen message instead of content
  if (maintenance?.enabled) {
    return <MaintenancePage message={maintenance.message} onRefresh={() => window.location.reload()} />;
  }

  return (
    <>
      {/* Environment banner (#86) */}
      {environment?.showBanner && environment.name && (
        <div style={{
          background: environment.color ?? '#faad14',
          color: '#000',
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 600,
          padding: '2px 0',
          letterSpacing: 1,
          userSelect: 'none',
        }}>
          {environment.name} ENVIRONMENT
        </div>
      )}
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