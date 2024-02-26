import { CaretRightOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import React from 'react';
import type { CollapseProps } from 'antd';
import { Collapse, theme } from 'antd';

const text = `
  A dog is a type of domesticated animal.
  Known for its loyalty and faithfulness,
  it can be found as a welcome guest in many households across the world.
`;

const getItems: (panelStyle: CSSProperties) => CollapseProps['items'] = (panelStyle) => [
  {
    key: '1',
    label: 'This is panel header 1',
    children: <p>{text}</p>,
    style: { ...panelStyle, background: "white"},
  },
  {
    key: '2',
    label: 'This is panel header 2',
    children: <p>{text}</p>,
    style: panelStyle,
  },
  {
    key: '3',
    label: 'This is panel header 3',
    children: <p>{text}</p>,
    style: {...panelStyle, size: "large"},
  },
];

export const AccordionParent = ({ children } : { children: React.ReactNode }) => {
  return <Accordion items={ [ { key: "1", label: "Basic", children : children, style: { background: "white"} } ] } />
}

export const Accordion = ({ items } : { items: any }) => {
  const { token } = theme.useToken();

  const panelStyle: React.CSSProperties = {
    marginBottom: 24,
    background: token.colorFillAlter,
    borderRadius: token.borderRadiusLG,
    border: 'none',
  };

  return (
    <Collapse
      bordered={false}
      defaultActiveKey={['1']}
      size = "large"
      expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
      style={{ background: "transparent" }}
      items={ items }
    />
  );
};
