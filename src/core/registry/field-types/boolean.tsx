import React from 'react';
import { Switch } from 'antd';
import type { BuiltInFormFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';

const BooleanForm: React.FC<BuiltInFormFieldProps> = ({ checked, onChange, id, checkedChildren, unCheckedChildren }) => (
  <Switch checked={checked} onChange={onChange} id={id} checkedChildren={checkedChildren} unCheckedChildren={unCheckedChildren} />
);

const sharedDefaults = {
  form: { checkedChildren: 'Yes', unCheckedChildren: 'No' },
};

export const booleanRegistrations: Record<string, FieldTypeRegistration> = {
  boolean: { form: BooleanForm, defaults: sharedDefaults },
  toggle: { form: BooleanForm, defaults: sharedDefaults },
  switch: { form: BooleanForm, defaults: sharedDefaults },
};
