/**
 * Component data context - formalized payload for "Lifting State Up" pattern
 * 
 * Components (Table, Form, Details) provide this data to their parent (PostAuthPage)
 * via the onDataChange callback. PostAuthPage then provides it to PageDataProvider.
 */
export interface ComponentDataContext {
  /**
   * Current record (for Details view, Form edit mode)
   */
  record?: any;
  
  /**
   * Selected records (for Table bulk actions)
   */
  selectedRecords?: any[];
  
  /**
   * Applied filters (for Table filtered exports)
   */
  filters?: Record<string, any>;
  
  /**
   * Search query (for Table context)
   */
  searchQuery?: string;
  
  /**
   * Form values (for Form buttons)
   * Note: High-frequency updates, should be debounced
   */
  formValues?: any;
  
  /**
   * Page type (list, view, edit, create, dashboard, custom)
   */
  pageType?: 'list' | 'view' | 'edit' | 'create' | 'dashboard' | 'custom';
  
  /**
   * Entity name (from API config)
   */
  entityName?: string;
  
  /**
   * Extensible for future needs (dashboard filters, widget state, etc.)
   */
  [key: string]: any;
}

/**
 * Callback signature for lifting component data to parent
 */
export type OnDataChangeCallback = (data: Partial<ComponentDataContext>) => void;

