import React from 'react';
import { OptionSelector } from '../../forms/FormField/OptionSelector';
import type { BuiltInFormFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';

const SelectForm: React.FC<BuiltInFormFieldProps> = ({ initialValue, fieldType, options, addNewOption, addNewOptionConfig, setFormValue, name, placeholder, dependencyFilters }) => (
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
    dependencyFilters={dependencyFilters}
  />
);

const MultiSelectForm: React.FC<BuiltInFormFieldProps> = ({ initialValue, fieldType, options, addNewOption, addNewOptionConfig, setFormValue, name, placeholder, dependencyFilters }) => (
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
    dependencyFilters={dependencyFilters}
  />
);

const CheckboxForm: React.FC<BuiltInFormFieldProps> = ({ initialValue, fieldType, options, dependencyFilters }) => (
  <OptionSelector value={initialValue} fieldType={fieldType} options={options || []} dependencyFilters={dependencyFilters} />
);

const RadioForm: React.FC<BuiltInFormFieldProps> = ({ initialValue, fieldType, options, dependencyFilters }) => (
  <OptionSelector value={initialValue} fieldType={fieldType} options={options || []} dependencyFilters={dependencyFilters} />
);

const AutocompleteForm: React.FC<BuiltInFormFieldProps> = ({ initialValue, fieldType, options, addNewOption, setFormValue, name, dependencyFilters }) => (
  <OptionSelector
    value={initialValue}
    fieldType={fieldType}
    options={options || []}
    addNewOption={addNewOption}
    onOptionChange={(newSelections) => {
      if (setFormValue && name) setFormValue({ name, value: newSelections });
    }}
    dependencyFilters={dependencyFilters}
  />
);

const TagsForm: React.FC<BuiltInFormFieldProps> = ({ initialValue, options, setFormValue, name, dependencyFilters }) => (
  <OptionSelector
    value={initialValue}
    fieldType="multi-select"
    options={options || []}
    onOptionChange={(newSelections) => {
      if (setFormValue && name) setFormValue({ name, value: newSelections });
    }}
    dependencyFilters={dependencyFilters}
  />
);

const IconForm: React.FC<BuiltInFormFieldProps> = ({ initialValue, options, dependencyFilters }) => (
  <OptionSelector
    value={initialValue}
    fieldType="select"
    options={options || []}
    placeholder="Select icon"
    dependencyFilters={dependencyFilters}
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
