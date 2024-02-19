import React, { Component, ReactNode } from 'react';
type IFormFieldType = "text" | "password" | "email" | "textarea" | "checkbox"

interface IFormField {
    name: string; //unique identifier, should be without spaces
    validationRules: Array<any>; //rules matchin ant design convention
    placeholder: string; //placeholder text
    prefixIcon?: ReactNode; //prefix icon as a react component
    fieldType?: IFormFieldType; //field type
    label: string;
}

type IPreDefinedValidations = "required" | "email" | `match:${string}`;
interface IFormFieldResponse {
    column: string;
    label: string;
    placeholder: string;
    validations: Array<IPreDefinedValidations>;
    fieldType?: IFormFieldType;
}

const convertValidationRules = ( validationRules : Array<IPreDefinedValidations> ) => {
    return validationRules.map( validationRule => {
        let antValidationRule = {}
        if( validationRule === "required") {
            antValidationRule = { ...antValidationRule, required: true }
        } else if( validationRule === "email") {
            antValidationRule = { ...antValidationRule, type: 'email' }
        } else if( validationRule.includes("match:") ) {
            const targetColumn = validationRule.split(':').pop()
            antValidationRule = ({ getFieldValue }) => ({
                validator(_, value) {
                    if (!value || getFieldValue( targetColumn ) === value) {
                        return Promise.resolve();
                    }
                    return Promise.reject(new Error(`This field does not match with "${targetColumn}" !`));
                },
            })
        }
        return antValidationRule
    })
}

export const convertColumnsConfigForFormField  =( columnsConfig : Array<IFormFieldResponse> ):  Array<IFormField> => {
    return columnsConfig.map( columnConfig => {
        return {
            name: columnConfig.column,
            validationRules: convertValidationRules(columnConfig.validations),
            label: columnConfig.label,
            placeholder: columnConfig.placeholder ?? columnConfig.label,
            fieldType: columnConfig.fieldType ?? "text",
        }
    })
}

export type { IFormField, IFormFieldResponse }