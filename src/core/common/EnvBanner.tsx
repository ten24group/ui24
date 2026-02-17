import React, { useEffect } from 'react';
import { useUi24Config } from '../context/UI24Context';

const bannerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1100,
  textAlign: 'center',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1,
  padding: '2px 0',
  color: '#fff',
  lineHeight: '18px',
  textTransform: 'uppercase',
};

/**
 * Thin environment banner shown at top of the page.
 * Renders only when config.environment.showBanner is true.
 * Also prefixes document.title when config.environment.titlePrefix is true.
 */
export const EnvBanner: React.FC = () => {
  const { config } = useUi24Config();
  const env = config.environment;

  useEffect(() => {
    if (env?.titlePrefix && env.name) {
      const originalTitle = document.title;
      document.title = `[${env.name}] ${originalTitle}`;
      return () => { document.title = originalTitle; };
    }
  }, [env?.titlePrefix, env?.name]);

  if (!env?.showBanner || !env.name) return null;

  return (
    <div style={{ ...bannerStyle, backgroundColor: env.color || '#faad14' }}>
      {env.name}
    </div>
  );
};
