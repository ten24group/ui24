export type ViewType = 'table' | 'card-grid' | 'kanban' | 'calendar' | 'map';

export interface CardGridConfig {
  /** Number of columns in the card grid (default: responsive 3) */
  columns?: number;
  /** Field name for card title */
  titleField: string;
  /** Field name for card description */
  descriptionField?: string;
  /** Field name for card image/avatar */
  imageField?: string;
  /** Additional fields to show as summary on the card */
  summaryFields?: string[];
}

export interface ViewConfig {
  /** Available view types for this page */
  available: ViewType[];
  /** Default view on first visit */
  default: ViewType;
  /** Persist user's view preference to localStorage */
  persistPreference?: boolean;
  /** Card grid configuration (required when 'card-grid' is in available) */
  cardConfig?: CardGridConfig;
}
