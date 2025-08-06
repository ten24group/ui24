import { CaretRightOutlined } from '@ant-design/icons';
import React from 'react';
import { Collapse, theme } from 'antd';
import { IRenderFromPageType } from '../PostAuthPage';
import { RenderFromPageType } from '../PostAuthPage';

type IAccordion = Record<string, IRenderFromPageType>

export const Accordion = ({ accordionsPageConfig, routeParams = {} } : { accordionsPageConfig?: IAccordion, routeParams?: Record<string, string> }) => {
  const { token } = theme.useToken();

  const panelStyle: React.CSSProperties = {
    marginBottom: 24,
    background: token.colorFillAlter,
    borderRadius: token.borderRadiusLG,
    border: 'none',
  };

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
      children: <RenderFromPageType {...accordion} routeParams={routeParams} />,
      style: panelStyle,
    };
  });

  return (
    <Collapse
      bordered={false}
      defaultActiveKey={['0']}
      size = "large"
      expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
      style={{ background: "transparent" }}
      items={ items }
    />
  );
};
