import React from 'react';
import { Switch } from 'antd';
import type { BuiltInFormFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';

const BooleanForm: React.FC<BuiltInFormFieldProps> = ({ checked, onChange, id }) => (
  <Switch checked={checked} onChange={onChange} id={id} />
);

export const booleanRegistrations: Record<string, FieldTypeRegistration> = {
  boolean: { form: BooleanForm },
  toggle: { form: BooleanForm },
  switch: { form: BooleanForm },
};
