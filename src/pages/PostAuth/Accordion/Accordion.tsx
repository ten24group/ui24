import { CaretRightOutlined } from '@ant-design/icons';
import React, { useMemo } from 'react';
import { Collapse, theme } from 'antd';
import type { CollapseProps } from 'antd';
import { IRenderFromPageType } from '../PostAuthPage';
import { RenderFromPageType } from '../PostAuthPage';
import { PageDataProvider } from '../../../core/context/PageDataContext';
import { useEvaluatedItems } from '../../../core/hooks/useEvaluatedItems';

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

  // Extract accordion entries for batch visibility evaluation
  const accordionEntries = useMemo(() =>
    Object.entries(accordionsPageConfig),
    [accordionsPageConfig]
  );

  // Memoize accordion configs for stable reference to useEvaluatedItems
  const accordionConfigs = useMemo(() =>
    accordionEntries.map(([, accordion]) => accordion),
    [accordionEntries]
  );

  // Batch evaluate visibility using useEvaluatedItems
  const { visibilityResults } = useEvaluatedItems(accordionConfigs);

  // Build collapse items with proper typing, filtering out hidden panels
  const items: CollapseProps[ 'items' ] = accordionEntries
    .map(([key, accordion], index) => {
      // Skip hidden panels
      if (!visibilityResults[index]) return null;

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
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // Default to expanding the first visible panel
  const firstVisibleKey = items.length > 0 ? [items[0].key as string] : [];

  return (
    <Collapse
      bordered={false}
      defaultActiveKey={firstVisibleKey}
      expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
      style={{ background: "#8080801c", }}
      items={items}
    />
  );
};
