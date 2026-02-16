import React from 'react';
import { OptionSelector } from '../../forms/FormField/OptionSelector';
import type { BuiltInFormFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';

const SelectForm: React.FC<BuiltInFormFieldProps> = ({ initialValue, fieldType, options, addNewOption, addNewOptionConfig, setFormValue, name, placeholder }) => (
  <OptionSelector
    value={initialValue}
    fieldType={fieldType}
    options={options || []}
    addNewOption={addNewOption}
    addNewOptionConfig={addNewOptionConfig}
    onOptionChange={(newSelections) => {
      if (setFormValue && name) setFormValue({ name, value: newSelections });
    }}
    placeholder={placeholder}
  />
);

const MultiSelectForm: React.FC<BuiltInFormFieldProps> = ({ initialValue, fieldType, options, addNewOption, addNewOptionConfig, setFormValue, name, placeholder }) => (
  <OptionSelector
    value={initialValue}
    fieldType={fieldType}
    options={options || []}
    addNewOption={addNewOption}
    addNewOptionConfig={addNewOptionConfig}
    onOptionChange={(newSelections) => {
      if (setFormValue && name) setFormValue({ name, value: newSelections });
    }}
    placeholder={placeholder}
  />
);

const CheckboxForm: React.FC<BuiltInFormFieldProps> = ({ initialValue, fieldType, options }) => (
  <OptionSelector value={initialValue} fieldType={fieldType} options={options || []} />
);

const RadioForm: React.FC<BuiltInFormFieldProps> = ({ initialValue, fieldType, options }) => (
  <OptionSelector value={initialValue} fieldType={fieldType} options={options || []} />
);

const AutocompleteForm: React.FC<BuiltInFormFieldProps> = ({ initialValue, fieldType, options, addNewOption, setFormValue, name }) => (
  <OptionSelector
    value={initialValue}
    fieldType={fieldType}
    options={options || []}
    addNewOption={addNewOption}
    onOptionChange={(newSelections) => {
      if (setFormValue && name) setFormValue({ name, value: newSelections });
    }}
  />
);

const TagsForm: React.FC<BuiltInFormFieldProps> = ({ initialValue, options, setFormValue, name }) => (
  <OptionSelector
    value={initialValue}
    fieldType="multi-select"
    options={options || []}
    onOptionChange={(newSelections) => {
      if (setFormValue && name) setFormValue({ name, value: newSelections });
    }}
  />
);

const IconForm: React.FC<BuiltInFormFieldProps> = ({ initialValue, options }) => (
  <OptionSelector
    value={initialValue}
    fieldType="select"
    options={options || []}
    placeholder="Select icon"
  />
);

export const selectRegistrations: Record<string, FieldTypeRegistration> = {
  select: { form: SelectForm },
  'multi-select': { form: MultiSelectForm },
  checkbox: { form: CheckboxForm },
  radio: { form: RadioForm },
  autocomplete: { form: AutocompleteForm },
  tags: { form: TagsForm },
  icon: { form: IconForm },
};
