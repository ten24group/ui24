import React from 'react';
import { DatePicker, TimePicker } from 'antd';
import type { BuiltInFormFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';

const DateForm: React.FC<BuiltInFormFieldProps> = ({ formatConfig, value, onChange, id }) => (
  <DatePicker format={formatConfig?.date} value={value} onChange={onChange} id={id} />
);

const DatetimeForm: React.FC<BuiltInFormFieldProps> = ({ formatConfig, value, onChange, id }) => (
  <DatePicker format={formatConfig?.datetime} showTime value={value} onChange={onChange} id={id} />
);

const TimeForm: React.FC<BuiltInFormFieldProps> = ({ formatConfig, value, onChange, id }) => (
  <TimePicker format={formatConfig?.time} value={value} onChange={onChange} id={id} />
);

export const dateRegistrations: Record<string, FieldTypeRegistration> = {
  date: {
    form: DateForm,
    defaults: { table: { ellipsis: false, width: 160 } },
  },
  datetime: {
    form: DatetimeForm,
    defaults: { table: { ellipsis: false, width: 180 } },
  },
  time: {
    form: TimeForm,
    defaults: { table: { ellipsis: false, width: 120 } },
  },
};
