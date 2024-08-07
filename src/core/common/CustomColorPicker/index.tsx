import React, { Component, ReactNode } from 'react';
import { ColorPicker } from 'antd';
import { ColorPickerProps } from 'antd/lib';
import { Color } from 'antd/lib/color-picker';

export type IColorPickerProps = ColorPickerProps & { onChange?: ( hex: string )=>void };

export function CustomColorPicker (props: IColorPickerProps ){

  const{ onChange, ...restProps } = props;
  
  const _onChange = (value: Color, hex: string) => {
    onChange && typeof onChange === 'function' && onChange(hex);  
  }

  return <ColorPicker {...restProps} onChange={_onChange} />
}