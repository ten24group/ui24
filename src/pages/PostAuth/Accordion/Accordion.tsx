import { CaretRightOutlined } from '@ant-design/icons';
import React, { useState } from 'react';
import { Collapse, theme } from 'antd';
import { IRenderFromPageType } from '../PostAuthPage';
import { RenderFromPageType } from '../PostAuthPage';
import { PageDataProvider } from '../../../core/context/PageDataContext';
import { OnDataChangeCallback } from '../../../core/types/pageData';

export type IAccordionPageConfig = Record<string, IRenderFromPageType>

export interface IAccordionProps {
  accordionsPageConfig?: IAccordionPageConfig;
  routeParams?: Record<string, string>;
  onDataChange?: OnDataChangeCallback;  // NEW: For lifting state (optional)
}

export const Accordion = ({ 
  accordionsPageConfig, 
  routeParams = {},
  onDataChange  // NEW
}: IAccordionProps) => {
  const { token } = theme.useToken();

  // Add null check for accordionsPageConfig
  if (!accordionsPageConfig) {
    return <div>No accordion configuration found</div>;
  }

  //loop over accordionsPageConfig create a Collapse for every record and render the respective component using RenderFromPageType
  const items = Object.keys(accordionsPageConfig).map((key: string, index: number) => {
    const accordion = accordionsPageConfig[key];
    const { pageTitle = "" } = accordion;
    return {
      key: index.toString(),
      label: pageTitle || key,
      // Each panel gets ISOLATED context to prevent state interference
      children: (
        <PageDataProvider 
          localData={{}} 
          isolated={true}
        >
          <RenderFromPageType 
            {...accordion} 
            routeParams={routeParams}
            onDataChange={onDataChange}
          />
        </PageDataProvider>
      ),
    };
  });

  return (
    <Collapse
      bordered={false}
      defaultActiveKey={['0']}
      expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
      style={{ background: "#8080801c",  }}
      items={ items }
    />
  );
};
