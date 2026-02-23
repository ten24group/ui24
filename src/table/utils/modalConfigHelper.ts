/**
 * Helper utilities for creating modal configurations in table renderers
 */

import type { IDetailsConfig } from "../../core/types/field-config";
import { ITablePropertiesConfig } from "../type";
import { PropertyType, FieldType } from "../../core/types/field-types";

/**
 * Creates a standardized details config for opening field data in modals
 * Used by jsonRenderer, listRenderer, richTextRenderer, etc.
 * 
 * @param fieldType - The field type (e.g., 'json', 'rich-text')
 * @param text - The actual data to display
 * @param column - Column configuration containing dataIndex
 * @param type - Optional PropertyType (e.g., 'map', 'list')
 * @returns IDetailsConfig object ready for OpenInModal
 */
export const createModalConfig = (
  fieldType: FieldType | undefined,
  text: unknown,
  column: Pick<ITablePropertiesConfig, 'dataIndex'>,
  type?: PropertyType
): IDetailsConfig => {
  const dataKey = column.dataIndex || 'value';
  
  return {
    propertiesConfig: [{
      label: undefined,  // No label in modal (title comes from modalTitle)
      ...(fieldType && { fieldType }),
      ...(type && { type }),
      column: dataKey
    }],
    dataSource: { [dataKey]: text }
  };
};

