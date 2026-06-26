import React from 'react';
import { OptionSelector } from '../../forms/FormField/OptionSelector';
import type { BuiltInFormFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';

// All select-family renderers use `value` (injected by antd Form.Item via cloneElement) —
// NOT `initialValue`. Form.Item controls the field value; `initialValue` is only the
// pre-populated value when the form first loads and is NOT kept in sync after mount.
// Using `initialValue` here would break programmatic updates (form.setFieldValue etc.).

const SelectForm: React.FC<BuiltInFormFieldProps> = ({ value, fieldType, options, addNewOption, addNewOptionConfig, quickCreate, setFormValue, name, placeholder, dependencyFilters, disabled, readOnly }) => (
  <OptionSelector
    value={value}
    fieldType={fieldType}
    options={options || []}
    addNewOption={addNewOption}
    addNewOptionConfig={addNewOptionConfig}
    quickCreate={quickCreate}
    onOptionChange={(newSelections) => {
      if (setFormValue && name) setFormValue({ name, value: newSelections });
    }}
    placeholder={placeholder}
    dependencyFilters={dependencyFilters}
    disabled={disabled || readOnly}
  />
);

const MultiSelectForm: React.FC<BuiltInFormFieldProps> = ({ value, fieldType, options, addNewOption, addNewOptionConfig, quickCreate, setFormValue, name, placeholder, dependencyFilters, disabled, readOnly }) => (
  <OptionSelector
    value={value}
    fieldType={fieldType}
    options={options || []}
    addNewOption={addNewOption}
    addNewOptionConfig={addNewOptionConfig}
    quickCreate={quickCreate}
    onOptionChange={(newSelections) => {
      if (setFormValue && name) setFormValue({ name, value: newSelections });
    }}
    placeholder={placeholder}
    dependencyFilters={dependencyFilters}
    disabled={disabled || readOnly}
  />
);

const CheckboxForm: React.FC<BuiltInFormFieldProps> = ({ value, fieldType, options, dependencyFilters }) => (
  <OptionSelector value={value} fieldType={fieldType} options={options || []} dependencyFilters={dependencyFilters} />
);

const RadioForm: React.FC<BuiltInFormFieldProps> = ({ value, fieldType, options, dependencyFilters }) => (
  <OptionSelector value={value} fieldType={fieldType} options={options || []} dependencyFilters={dependencyFilters} />
);

const AutocompleteForm: React.FC<BuiltInFormFieldProps> = ({ value, fieldType, options, addNewOption, setFormValue, name, dependencyFilters }) => (
  <OptionSelector
    value={value}
    fieldType={fieldType}
    options={options || []}
    addNewOption={addNewOption}
    onOptionChange={(newSelections) => {
      if (setFormValue && name) setFormValue({ name, value: newSelections });
    }}
    dependencyFilters={dependencyFilters}
  />
);

const TagsForm: React.FC<BuiltInFormFieldProps> = ({ value, options, setFormValue, name, dependencyFilters }) => (
  <OptionSelector
    value={value}
    fieldType="multi-select"
    options={options || []}
    onOptionChange={(newSelections) => {
      if (setFormValue && name) setFormValue({ name, value: newSelections });
    }}
    dependencyFilters={dependencyFilters}
  />
);

const IconForm: React.FC<BuiltInFormFieldProps> = ({ value, options, dependencyFilters }) => (
  <OptionSelector
    value={value}
    fieldType="select"
    options={options || []}
    placeholder="Select icon"
    dependencyFilters={dependencyFilters}
  />
);

export const selectRegistrations: Record<string, FieldTypeRegistration> = {
  select: {
    form: SelectForm,
    defaults: {
      form: { placeholder: 'Select an option' },
      table: { width: 160, ellipsis: true },
    },
  },
  'multi-select': {
    form: MultiSelectForm,
    defaults: {
      form: { placeholder: 'Select options' },
      table: { width: 200, ellipsis: true },
    },
  },
  checkbox: { form: CheckboxForm },
  radio: { form: RadioForm },
  autocomplete: {
    form: AutocompleteForm,
    defaults: { form: { placeholder: 'Search or type...' } },
  },
  tags: {
    form: TagsForm,
    defaults: {
      form: { placeholder: 'Add tags' },
      table: { width: 180, ellipsis: true },
    },
  },
  icon: { form: IconForm },
};
