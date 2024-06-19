import { CaretRightOutlined } from '@ant-design/icons';
import React from 'react';
import { Collapse, theme } from 'antd';
import { IRenderFromPageType } from '../PostAuthPage';
import { RenderFromPageType } from '../PostAuthPage';

type IAccordion = Record<string, IRenderFromPageType>

export const Accordion = ({ accordionsPageConfig } : { accordionsPageConfig: IAccordion }) => {
  const { token } = theme.useToken();

  const panelStyle: React.CSSProperties = {
    marginBottom: 24,
    background: token.colorFillAlter,
    borderRadius: token.borderRadiusLG,
    border: 'none',
  };

  console.log(accordionsPageConfig, " accordionsPageConfig ")

  //loop over accordionsPageConfig create a Collapse for every record and render the respective component using RenderFromPageType
  let itemCount = -1;
  const items = Object.keys(accordionsPageConfig).map((key: string) => {
    const accordion = accordionsPageConfig[key];
    const { pageTitle = "" } = accordion;
    itemCount += 1;
    return {
      itemCount,
      label: pageTitle || key,
      children: <RenderFromPageType {...accordion} />,
      style: panelStyle,
    };
  });

  const onChange = (key: string | string[]) => {
    console.log(key, "accordion click");
  }

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
