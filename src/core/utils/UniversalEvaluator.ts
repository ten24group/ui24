/**
 * Universal evaluation engine for visibility/enablement conditions.
 * 
 * Features:
 * - Synchronous evaluation where possible (better for React)
 * - Asynchronous evaluation for custom functions
 * - Result caching with TTL
 * - Proper error handling with fail-safe defaults
 * - Template resolution with $ref syntax
 * - Promise.allSettled for batch operations
 * 
 * Security: Defaults to hidden/disabled on evaluation errors.
 */

import stableStringify from 'fast-json-stable-stringify';
import {
  EvaluationContext,
  EvaluationResult,
  VisibilityConfig,
  InlineVisibilityCondition,
  CustomVisibilityCondition,
  NamedVisibilityCondition,
  ShortcutVisibilityCondition,
  TemplateRef,
  EvaluationRule,
} from '../types/evaluation';
import { getEvaluator } from './ConditionEvaluatorRegistry';

/**
 * Universal evaluator with sync/async support, caching, and error handling
 */
export class UniversalEvaluator {
  private cache = new Map<string, { result: EvaluationResult; timestamp: number }>();
  private cacheTimeout = 5000; // 5 seconds
  
  /**
   * FIXED: Synchronous evaluation where possible (preferred for React hooks)
   * Throws if async evaluation required (caller handles fallback)
   * 
   * @param config - Visibility configuration
   * @param context - Evaluation context
   * @returns Evaluation result
   * @throws Error if async evaluation required
   */
  evaluateSync(
    config: VisibilityConfig | undefined,
    context: EvaluationContext
  ): EvaluationResult {
    if (!config) {
      return { visible: true, enabled: true };
    }
    
    try {
      // Shortcuts can be evaluated synchronously
      if (this.isShortcutCondition(config)) {
        return this.evaluateShortcutsSync(config, context);
      }
      
      // Custom evaluators and named conditions require async
      if ('custom' in config || 'conditions' in config) {
        throw new Error('Async evaluation required for custom/named conditions');
      }
      
      // Inline conditions - can handle synchronously if no custom rules
      return this.evaluateInlineSync(config as InlineVisibilityCondition, context);
      
    } catch (error) {
      console.error('[UniversalEvaluator] Sync evaluation failed:', error);
      throw error; // Re-throw to trigger async fallback
    }
  }
  
  /**
   * Asynchronous evaluation with caching and error handling
   * 
   * @param config - Visibility configuration
   * @param context - Evaluation context
   * @returns Promise resolving to evaluation result
   */
  async evaluate(
    config: VisibilityConfig | undefined,
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    
    if (!config) {
      return { visible: true, enabled: true };
    }
    
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(config, context);
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.result;
      }
      
      let result: EvaluationResult;
      
      // Evaluate based on config type
      if ('custom' in config && typeof config.custom === 'string') {
        result = await this.evaluateCustom(config.custom, context);
      } else if ('conditions' in config && Array.isArray(config.conditions)) {
        result = await this.evaluateNamedConditions(
          config.conditions as string[],
          config.scope || 'all',
          context
        );
      } else if (this.isShortcutCondition(config)) {
        result = this.evaluateShortcutsSync(config, context);
      } else {
        result = this.evaluateInlineSync(config as InlineVisibilityCondition, context);
      }
      
      // Cache result
      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      this.cleanCacheIfNeeded();
      
      return result;
      
    } catch (error) {
      console.error('[UniversalEvaluator] Evaluation failed:', error);
      
      // FIXED: Fail-safe - hide on error (security first)
      return {
        visible: false,
        enabled: false,
        disabledMessage: 'Evaluation error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Type guard for shortcut conditions
   */
  private isShortcutCondition(config: VisibilityConfig):  config is ShortcutVisibilityCondition {
    return ('requiredRoles' in config || 
            'excludedRoles' in config || 
            'showWhen' in config || 
            'hideWhen' in config);
  }
  
  /**
   * Evaluate shortcut conditions (synchronous)
   */
  private evaluateShortcutsSync(
    config: ShortcutVisibilityCondition,
    context: EvaluationContext
  ): EvaluationResult {
    
    // Required roles
    if (config.requiredRoles && config.requiredRoles.length > 0) {
      const userRoles = context.actor?.cognito?.groups || [];
      const hasRequiredRole = config.requiredRoles.some(role => userRoles.includes(role));
      if (!hasRequiredRole) {
        // TODO: disabled messages 
        return { visible: true, enabled: false };
      }
    }
    
    // Excluded roles
    if (config.excludedRoles && config.excludedRoles.length > 0) {
      const userRoles = context.actor?.cognito?.groups || [];
      const hasExcludedRole = config.excludedRoles.some(role => userRoles.includes(role));
      if (hasExcludedRole) {
        return { visible: true, enabled: false };
      }
    }
    
    // Show when
    if (config.showWhen && context.record) {
      if (!this.matchesObject(config.showWhen, context.record, context)) {
        return { visible: false, enabled: false };
      }
    }
    
    // Hide when
    if (config.hideWhen && context.record) {
      if (this.matchesObject(config.hideWhen, context.record, context)) {
        return { visible: false, enabled: false };
      }
    }
    
    return { visible: true, enabled: true };
  }
  
  /**
   * Evaluate inline conditions (synchronous)
   */
  private evaluateInlineSync(
    config: InlineVisibilityCondition,
    context: EvaluationContext
  ): EvaluationResult {
    
    // Actor conditions
    if (config.actor) {
      if (!this.evaluateRulesSync(config.actor, context.actor, context)) {
        return { visible: false, enabled: false };
      }
    }
    
    // Record conditions
    if (config.record && context.record) {
      if (!this.evaluateRulesSync(config.record, context.record, context)) {
        return { visible: false, enabled: false };
      }
    }
    
    // Query params conditions
    if (config.queryParams && context.queryParams) {
      if (!this.evaluateRulesSync(config.queryParams, context.queryParams, context)) {
        return { visible: false, enabled: false };
      }
    }
    
    // Context conditions
    if (config.context) {
      const contextData = {
        pageType: context.pageType,
        modalDepth: context.modalDepth,
        entityName: context.entityName,
      };
      if (!this.evaluateRulesSync(config.context, contextData, context)) {
        return { visible: false, enabled: false };
      }
    }
    
    // Selected records conditions
    if (config.selectedRecords && context.selectedRecords) {
      if (!this.evaluateSelectedRecordsSync(config.selectedRecords, context.selectedRecords, context)) {
        return { visible: false, enabled: false };
      }
    }
    
    // Form values conditions
    if (config.formValues && context.formValues) {
      if (!this.evaluateRulesSync(config.formValues, context.formValues, context)) {
        return { visible: false, enabled: false };
      }
    }
    
    return { visible: true, enabled: true };
  }
  
  /**
   * Evaluate custom evaluator (async)
   */
  private async evaluateCustom(
    name: string,
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    const fn = getEvaluator(name);
    
    if (!fn) {
      console.error(`[Evaluator] Custom function not found: "${name}"`);
      return { visible: false, enabled: false, error: `Evaluator "${name}" not registered` };
    }
    
    try {
      const result = await fn(context);
      return result;
    } catch (error) {
      console.error(`[Evaluator] Custom function "${name}" failed:`, error);
      return { visible: false, enabled: false, error: 'Custom evaluator failed' };
    }
  }
  
  /**
   * Evaluate named conditions (async)
   * FIXED: Uses Promise.allSettled for graceful degradation
   */
  private async evaluateNamedConditions(
    names: string[],
    scope: 'all' | 'any' | 'none',
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    
    // FIXED: Use allSettled instead of all for graceful error handling
    const results = await Promise.allSettled(
      names.map(name => this.evaluateCustom(name, context))
    );
    
    const successfulResults = results
      .filter((r): r is PromiseFulfilledResult<EvaluationResult> => r.status === 'fulfilled')
      .map(r => r.value);
    
    const visibleCount = successfulResults.filter(r => r.visible).length;
    
    let finalVisible = false;
    switch (scope) {
      case 'all':
        // All must succeed and be visible
        finalVisible = visibleCount === names.length && results.every(r => r.status === 'fulfilled');
        break;
      case 'any':
        // At least one must be visible
        finalVisible = visibleCount > 0;
        break;
      case 'none':
        // None should be visible
        finalVisible = visibleCount === 0;
        break;
    }
    
    return { visible: finalVisible, enabled: finalVisible };
  }
  
  /**
   * Evaluate rules against data (synchronous)
   */
  private evaluateRulesSync(
    rules: Record<string, EvaluationRule>,
    data: Record<string, any>,
    context: EvaluationContext
  ): boolean {
    return Object.entries(rules).every(([path, rule]) => {
      const actualValue = this.getNestedValue(data, path);
      return this.evaluateRuleSync(rule, actualValue, context);
    });
  }
  
  /**
   * Evaluate selected records conditions (synchronous)
   */
  private evaluateSelectedRecordsSync(
    config: NonNullable<InlineVisibilityCondition['selectedRecords']>,
    selectedRecords: Array<Record<string, any>>,
    context: EvaluationContext
  ): boolean {
    
    // Length check
    if (config.length) {
      if (!this.evaluateRuleSync(config.length, selectedRecords.length, context)) {
        return false;
      }
    }
    
    // All records must match
    if (config.all) {
      return selectedRecords.every(record => 
        this.evaluateRulesSync(config.all!, record, context)
      );
    }
    
    // At least one record must match
    if (config.some) {
      return selectedRecords.some(record => 
        this.evaluateRulesSync(config.some!, record, context)
      );
    }
    
    // No records should match
    if (config.none) {
      return !selectedRecords.some(record => 
        this.evaluateRulesSync(config.none!, record, context)
      );
    }
    
    return true;
  }
  
  /**
   * Evaluate single rule (synchronous)
   */
  private evaluateRuleSync(
    rule: EvaluationRule,
    value: any,
    context: EvaluationContext
  ): boolean {
    
    // Equality
    if ('eq' in rule && rule.eq !== undefined) {
      const expected = this.resolveTemplate(rule.eq, context);
      return value === expected;
    }
    
    // Inequality
    if ('neq' in rule && rule.neq !== undefined) {
      const expected = this.resolveTemplate(rule.neq, context);
      return value !== expected;
    }
    
    // Greater than
    if ('gt' in rule && rule.gt !== undefined) {
      const expected = this.resolveTemplate(rule.gt, context);
      return value > expected;
    }
    
    // Greater than or equal
    if ('gte' in rule && rule.gte !== undefined) {
      const expected = this.resolveTemplate(rule.gte, context);
      return value >= expected;
    }
    
    // Less than
    if ('lt' in rule && rule.lt !== undefined) {
      const expected = this.resolveTemplate(rule.lt, context);
      return value < expected;
    }
    
    // Less than or equal
    if ('lte' in rule && rule.lte !== undefined) {
      const expected = this.resolveTemplate(rule.lte, context);
      return value <= expected;
    }
    
    // In list
    if ('inList' in rule && rule.inList !== undefined) {
      return rule.inList.includes(value);
    }
    
    // Not in list
    if ('notInList' in rule && rule.notInList !== undefined) {
      return !rule.notInList.includes(value);
    }
    
    // Exists
    if ('exists' in rule && rule.exists !== undefined) {
      return rule.exists ? value !== undefined && value !== null : value === undefined || value === null;
    }
    
    // Empty
    if ('empty' in rule && rule.empty !== undefined) {
      const isEmpty = value === undefined || value === null || value === '' || 
                      (Array.isArray(value) && value.length === 0) ||
                      (typeof value === 'object' && Object.keys(value).length === 0);
      return rule.empty ? isEmpty : !isEmpty;
    }
    
    // Pattern (regex)
    if ('pattern' in rule && rule.pattern !== undefined) {
      if (typeof value !== 'string') return false;
      const regex = new RegExp(rule.pattern);
      return regex.test(value);
    }
    
    // Custom function (not supported in sync mode)
    if ('custom' in rule && rule.custom !== undefined) {
      throw new Error('Custom rule functions require async evaluation');
    }
    
    return true;
  }
  
  /**
   * Template resolution - FIXED: Use $ref instead of {...}
   */
  private resolveTemplate(value: any, context: EvaluationContext): any {
    // Check if it's a template reference
    if (value && typeof value === 'object' && '$ref' in value) {
      const path = (value as TemplateRef).$ref;
      const resolved = this.getNestedValue(context, path);
      
      if (resolved === undefined) {
        console.warn(`[Template] Path not found: ${path}`);
      }
      
      return resolved;
    }
    
    return value;
  }
  
  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  /**
   * Simple object matching for showWhen/hideWhen
   */
  private matchesObject(
    expected: Record<string, any>,
    actual: Record<string, any>,
    context: EvaluationContext
  ): boolean {
    return Object.entries(expected).every(([key, value]) => {
      const actualValue = this.getNestedValue(actual, key);
      const resolvedValue = this.resolveTemplate(value, context);
      return actualValue === resolvedValue;
    });
  }
  
  /**
   * Generate cache key from config and context
   */
  private getCacheKey(config: VisibilityConfig, context: EvaluationContext): string {
    return stableStringify({ config, context });
  }
  
  /**
   * Clean cache if it exceeds size limit
   */
  private cleanCacheIfNeeded(): void {
    if (this.cache.size <= 1000) return;
    
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, value] of entries) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const universalEvaluator = new UniversalEvaluator();

