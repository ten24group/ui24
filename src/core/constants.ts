/**
 * Global constants used across ui24 framework.
 * Centralized to avoid duplication and ensure consistency.
 */

export const IS_DEV = process.env.NODE_ENV !== 'production';
export const IS_PROD = process.env.NODE_ENV === 'production';
export const MAX_SPANS = 1000;