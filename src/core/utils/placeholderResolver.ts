/**
 * @fileoverview Placeholder Resolver
 * 
 * Extends the existing `:paramName` placeholder system to support:
 * - Context references: `:actor.actorId`, `:actor.organizationId`
 * - Date expressions: `:startOfToday`, `:endOfMonth`, `:nowMinus7Days`
 * - Route params: `:teamId`, `:gameId` (existing)
 * 
 * All placeholders start with `:` and are resolved at runtime in the frontend.
 */

import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import { getNestedValue } from '../utils';

// Initialize dayjs plugins
dayjs.extend(quarterOfYear);

/**
 * Context available for resolving placeholders
 */
export interface PlaceholderContext {
  /** Current authenticated user/actor */
  actor?: {
    actorId?: string;
    email?: string;
    name?: string;
    roles?: string[];
    groups?: string[];
    organizationId?: string;
    [key: string]: any;
  };
  
  /** Current record (for row-level context) */
  record?: Record<string, any>;
  
  /** Parent record (for nested tables) */
  parent?: Record<string, any>;
  
  /** URL route parameters */
  routeParams?: Record<string, string>;
  
  /** URL query parameters */
  queryParams?: Record<string, string>;
  
  /** Current date/time */
  now?: Date;
}

/**
 * Evaluate date expression to ISO string
 */
function evaluateDateExpression(expression: string, now: Date = new Date()): string {
  const d = dayjs(now);
  
  // Day boundaries
  if (expression === 'startOfToday') return d.startOf('day').toISOString();
  if (expression === 'endOfToday') return d.endOf('day').toISOString();
  if (expression === 'startOfYesterday') return d.subtract(1, 'day').startOf('day').toISOString();
  if (expression === 'endOfYesterday') return d.subtract(1, 'day').endOf('day').toISOString();
  if (expression === 'startOfTomorrow') return d.add(1, 'day').startOf('day').toISOString();
  if (expression === 'endOfTomorrow') return d.add(1, 'day').endOf('day').toISOString();
  
  // Week boundaries
  if (expression === 'startOfWeek') return d.startOf('week').toISOString();
  if (expression === 'endOfWeek') return d.endOf('week').toISOString();
  if (expression === 'startOfLastWeek') return d.subtract(1, 'week').startOf('week').toISOString();
  if (expression === 'endOfLastWeek') return d.subtract(1, 'week').endOf('week').toISOString();
  if (expression === 'startOfNextWeek') return d.add(1, 'week').startOf('week').toISOString();
  if (expression === 'endOfNextWeek') return d.add(1, 'week').endOf('week').toISOString();
  
  // Month boundaries
  if (expression === 'startOfMonth') return d.startOf('month').toISOString();
  if (expression === 'endOfMonth') return d.endOf('month').toISOString();
  if (expression === 'startOfLastMonth') return d.subtract(1, 'month').startOf('month').toISOString();
  if (expression === 'endOfLastMonth') return d.subtract(1, 'month').endOf('month').toISOString();
  if (expression === 'startOfNextMonth') return d.add(1, 'month').startOf('month').toISOString();
  if (expression === 'endOfNextMonth') return d.add(1, 'month').endOf('month').toISOString();
  
  // Quarter boundaries
  if (expression === 'startOfQuarter') return d.startOf('quarter').toISOString();
  if (expression === 'endOfQuarter') return d.endOf('quarter').toISOString();
  if (expression === 'startOfLastQuarter') return d.subtract(1, 'quarter').startOf('quarter').toISOString();
  if (expression === 'endOfLastQuarter') return d.subtract(1, 'quarter').endOf('quarter').toISOString();
  if (expression === 'startOfNextQuarter') return d.add(1, 'quarter').startOf('quarter').toISOString();
  if (expression === 'endOfNextQuarter') return d.add(1, 'quarter').endOf('quarter').toISOString();
  
  // Year boundaries
  if (expression === 'startOfYear') return d.startOf('year').toISOString();
  if (expression === 'endOfYear') return d.endOf('year').toISOString();
  if (expression === 'startOfLastYear') return d.subtract(1, 'year').startOf('year').toISOString();
  if (expression === 'endOfLastYear') return d.subtract(1, 'year').endOf('year').toISOString();
  if (expression === 'startOfNextYear') return d.add(1, 'year').startOf('year').toISOString();
  if (expression === 'endOfNextYear') return d.add(1, 'year').endOf('year').toISOString();
  
  // Relative time
  if (expression === 'now') return d.toISOString();
  if (expression === 'nowMinus1Hour') return d.subtract(1, 'hour').toISOString();
  if (expression === 'nowMinus24Hours') return d.subtract(24, 'hour').toISOString();
  if (expression === 'nowMinus7Days') return d.subtract(7, 'day').toISOString();
  if (expression === 'nowMinus30Days') return d.subtract(30, 'day').toISOString();
  if (expression === 'nowPlus1Hour') return d.add(1, 'hour').toISOString();
  if (expression === 'nowPlus24Hours') return d.add(24, 'hour').toISOString();
  if (expression === 'nowPlus7Days') return d.add(7, 'day').toISOString();
  if (expression === 'nowPlus30Days') return d.add(30, 'day').toISOString();
  
  // Unknown expression - return original
  console.warn(`Unknown date expression: :${expression}`);
  return expression;
}

/**
 * Check if a placeholder is a date expression
 */
function isDateExpression(placeholder: string): boolean {
  return /^(startOf|endOf|now)/.test(placeholder);
}

/**
 * Check if a placeholder is a context reference (has dot notation)
 */
function isContextReference(placeholder: string): boolean {
  return placeholder.includes('.');
}

/**
 * Resolve a single placeholder value
 * 
 * @param placeholder - Placeholder string WITHOUT leading `:` (e.g., 'teamId', 'actor.actorId', 'startOfToday')
 * @param context - Context containing actor, routeParams, etc.
 * @returns Resolved value or undefined
 * 
 * @example
 * resolvePlaceholder('teamId', { routeParams: { teamId: '123' } }); // '123'
 * resolvePlaceholder('actor.actorId', { actor: { actorId: 'user1' } }); // 'user1'
 * resolvePlaceholder('startOfToday', { now: new Date() }); // '2024-11-08T00:00:00.000Z'
 */
export function resolvePlaceholder(
  placeholder: string,
  context: PlaceholderContext
): any {
  // Date expression (startOfToday, endOfMonth, etc.)
  if (isDateExpression(placeholder)) {
    return evaluateDateExpression(placeholder, context.now);
  }
  
  // Context reference with dot notation (actor.actorId, parent.teamId, etc.)
  if (isContextReference(placeholder)) {
    const [contextName, ...pathParts] = placeholder.split('.');
    const path = pathParts.join('.');
    
    switch (contextName) {
      case 'actor':
        return getNestedValue(context.actor, path);
      case 'record':
        return getNestedValue(context.record, path);
      case 'parent':
        return getNestedValue(context.parent, path);
      case 'routeParams':
        return getNestedValue(context.routeParams, path);
      case 'queryParams':
        return getNestedValue(context.queryParams, path);
      default:
        console.warn(`Unknown context: ${contextName}`);
        return undefined;
    }
  }
  
  // Simple route param (existing behavior - backward compatible)
  return context.routeParams?.[placeholder];
}

/**
 * Recursively resolve all placeholders in a filter object
 * 
 * @param filter - Filter object that may contain placeholders
 * @param context - Context for resolving placeholders
 * @returns Filter with all placeholders resolved
 * 
 * @example
 * const filter = {
 *   teamId: ':teamId',
 *   createdBy: ':actor.actorId',
 *   gameDate: { gte: ':startOfToday' }
 * };
 * resolveFilterPlaceholders(filter, context);
 * // Result: {
 * //   teamId: '123',
 * //   createdBy: 'user1',
 * //   gameDate: { gte: '2024-11-08T00:00:00.000Z' }
 * // }
 */
export function resolveFilterPlaceholders(
  filter: Record<string, any>,
  context: PlaceholderContext
): Record<string, any> {
  if (!filter || typeof filter !== 'object') {
    return filter;
  }
  
  // Handle arrays
  if (Array.isArray(filter)) {
    return filter.map(item => resolveFilterPlaceholders(item, context));
  }
  
  const resolved: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(filter)) {
    if (value === null || value === undefined) {
      resolved[key] = value;
    } else if (typeof value === 'string' && value.startsWith(':')) {
      // Resolve placeholder
      const placeholder = value.slice(1); // Remove leading ':'
      resolved[key] = resolvePlaceholder(placeholder, context);
    } else if (typeof value === 'object') {
      // Recursively resolve nested objects/arrays
      resolved[key] = resolveFilterPlaceholders(value, context);
    } else {
      // Primitive value, keep as-is
      resolved[key] = value;
    }
  }
  
  return resolved;
}

/**
 * Check if a value is a placeholder string
 */
export function isPlaceholder(value: any): boolean {
  return typeof value === 'string' && value.startsWith(':');
}

/**
 * Check if a filter contains any placeholders
 */
export function hasPlaceholders(filter: any): boolean {
  if (!filter) return false;
  
  if (typeof filter === 'string') {
    return isPlaceholder(filter);
  }
  
  if (Array.isArray(filter)) {
    return filter.some(item => hasPlaceholders(item));
  }
  
  if (typeof filter === 'object') {
    return Object.values(filter).some(value => hasPlaceholders(value));
  }
  
  return false;
}

