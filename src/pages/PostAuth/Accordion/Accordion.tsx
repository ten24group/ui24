import { CaretRightOutlined } from '@ant-design/icons';
import React from 'react';
import { Collapse, theme } from 'antd';
import type { CollapseProps } from 'antd';
import { IRenderFromPageType } from '../PostAuthPage';
import { RenderFromPageType } from '../PostAuthPage';
import { PageDataProvider } from '../../../core/context/PageDataContext';

export type IAccordionPageConfig = Readonly<{ [ key: string ]: IRenderFromPageType }>;

export interface IAccordionProps {
  readonly accordionsPageConfig?: IAccordionPageConfig;
  readonly routeParams?: Readonly<{ readonly [ key: string ]: string | number | undefined }>;
}

/**
 * Resolve page title to a string.
 * Handles both string and Template (ITemplateConfig) types.
 */
function resolvePageTitle(pageTitle: string | { composite: string[]; template: string } | undefined, fallback: string): string {
  if (!pageTitle) {
    return fallback;
  }
  if (typeof pageTitle === 'string') {
    return pageTitle;
  }
  // ITemplateConfig - return the template string (placeholders won't be resolved without context)
  return pageTitle.template || fallback;
}

export const Accordion: React.FC<IAccordionProps> = ({
  accordionsPageConfig,
  routeParams = {}
}) => {
  const { token } = theme.useToken();

  // Add null check for accordionsPageConfig
  if (!accordionsPageConfig) {
    return <div>No accordion configuration found</div>;
  }

  // Build collapse items with proper typing
  const items: CollapseProps[ 'items' ] = Object.keys(accordionsPageConfig).map((key: string, index: number) => {
    const accordion = accordionsPageConfig[ key ];
    const label = resolvePageTitle(accordion.pageTitle, key);

    return {
      key: index.toString(),
      label,
      // Each panel gets ISOLATED context to prevent state interference
      children: (
        <PageDataProvider
          localData={{}}
          isolated={true}
        >
          <RenderFromPageType
            {...accordion}
            routeParams={routeParams}
          />
        </PageDataProvider>
      ),
    };
  });

  return (
    <Collapse
      bordered={false}
      defaultActiveKey={[ '0' ]}
      expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
      style={{ background: "#8080801c", }}
      items={items}
    />
  );
};
