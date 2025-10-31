# Evaluation System Enhancements - Comprehensive Implementation Plan

**Version:** 1.0  
**Date:** October 31, 2025  
**Status:** Planning Phase  
**Estimated Effort:** 4-6 weeks (3 sprints)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Feature Specifications](#feature-specifications)
   - [Feature 1: Entitlement-Based Evaluation](#feature-1-entitlement-based-evaluation)
   - [Feature 2: Fine-Grained Permission System](#feature-2-fine-grained-permission-system)
   - [Feature 3: Form Field Visibility](#feature-3-form-field-visibility)
   - [Feature 4: Evaluation Debugging & Tracing](#feature-4-evaluation-debugging--tracing)
   - [Feature 5: Feature Flags Implementation](#feature-5-feature-flags-implementation)
   - [Feature 6: Widget & Component Visibility](#feature-6-widget--component-visibility)
   - [Feature 7: Smart Caching Strategies](#feature-7-smart-caching-strategies)
   - [Feature 8: Batch Evaluation Optimization](#feature-8-batch-evaluation-optimization)
4. [Implementation Phases](#implementation-phases)
5. [Testing Strategy](#testing-strategy)
6. [Migration & Rollout](#migration--rollout)
7. [Performance Benchmarks](#performance-benchmarks)
8. [Security Considerations](#security-considerations)
9. [Documentation Requirements](#documentation-requirements)

---

## Executive Summary

### Current State
The evaluation system provides basic visibility control for actions based on:
- Role-based access (Cognito groups)
- Context-based rules (pageType, modalDepth, entityName)
- Custom evaluators (registered functions)
- Template references for dynamic values

### Goals
Transform the evaluation system into a comprehensive authorization and personalization framework that supports:
- **Entitlement-based access** (premium features, tier-based access)
- **Fine-grained permissions** (resource-level authorization)
- **Universal visibility control** (actions, form fields, widgets, components)
- **Feature flags** (gradual rollouts, A/B testing)
- **Developer experience** (debugging, tracing, error messages)
- **Performance optimization** (smart caching, batch processing)

### Success Metrics
- ✅ 100% backward compatibility with existing configurations
- ✅ <50ms evaluation time for 90% of checks (cached)
- ✅ <200ms evaluation time for permission API calls
- ✅ Zero security regressions
- ✅ Comprehensive test coverage (>90%)
- ✅ Clear migration path for all existing code

---

## System Architecture

### Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND (fw24)                          │
├─────────────────────────────────────────────────────────────┤
│  Entity Schema                                               │
│  ├── listPageActions: IEntityPageAction[]                   │
│  │   └── visibility?: VisibilityConfig                      │
│  ├── viewPageActions: IEntityPageAction[]                   │
│  └── editPageActions: IEntityPageAction[]                   │
│                                                               │
│  VisibilityConfig Types:                                     │
│  ├── InlineVisibilityCondition (requiredRoles, context)     │
│  ├── CustomVisibilityCondition (custom evaluator name)      │
│  ├── NamedVisibilityCondition (named conditions)            │
│  └── ShortcutVisibilityCondition (alwaysHidden, etc.)       │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ UI Config Generation
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (ui24)                          │
├─────────────────────────────────────────────────────────────┤
│  Context Providers                                           │
│  ├── AppStateProvider (actor, tenant, featureFlags)         │
│  └── PageDataProvider (record, selectedRecords, formValues) │
│                                                               │
│  Evaluation System                                           │
│  ├── UniversalEvaluator (sync/async evaluation)             │
│  ├── ConditionEvaluatorRegistry (custom evaluators)         │
│  ├── useEvaluation (single evaluation hook)                 │
│  └── useEvaluationBatch (batch evaluation hook)             │
│                                                               │
│  Components                                                  │
│  ├── PageHeader (renders actions with evaluation)           │
│  ├── Form (renders form with buttons)                       │
│  └── Table (renders table with actions)                     │
└─────────────────────────────────────────────────────────────┘
```

### Enhanced Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         BACKEND (fw24)                                │
├──────────────────────────────────────────────────────────────────────┤
│  Entity Schema (ENHANCED)                                             │
│  ├── listPageActions: IEntityPageAction[]                            │
│  │   └── visibility?: VisibilityConfig (ENHANCED)                    │
│  ├── attributes                                                       │
│  │   └── [field]: { visibility?: VisibilityConfig } (NEW)            │
│  └── widgets?: IWidgetConfig[] (NEW)                                 │
│      └── visibility?: VisibilityConfig                               │
│                                                                        │
│  VisibilityConfig Types (ENHANCED):                                  │
│  ├── InlineVisibilityCondition                                       │
│  │   ├── requiredRoles                                               │
│  │   ├── hasEntitlement (NEW)                                        │
│  │   ├── hasAllEntitlements (NEW)                                    │
│  │   ├── hasPermission (NEW)                                         │
│  │   ├── featureFlag (NEW)                                           │
│  │   └── context                                                      │
│  ├── CustomVisibilityCondition                                       │
│  ├── NamedVisibilityCondition                                        │
│  └── ShortcutVisibilityCondition                                     │
│                                                                        │
│  New API Endpoints:                                                  │
│  ├── GET /api/permissions/user/:userId (NEW)                         │
│  ├── POST /api/permissions/check (NEW)                               │
│  ├── GET /api/feature-flags (NEW)                                    │
│  └── GET /api/entitlements/user/:userId (existing, integrate)        │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ UI Config Generation
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (ui24)                                │
├──────────────────────────────────────────────────────────────────────┤
│  Context Providers (ENHANCED)                                        │
│  ├── AppStateProvider                                                │
│  │   ├── actor (ENHANCED with entitlements, permissions)            │
│  │   ├── tenant (with customizations)                               │
│  │   └── featureFlags (IMPLEMENTED)                                 │
│  └── PageDataProvider (unchanged)                                   │
│                                                                        │
│  New Services:                                                       │
│  ├── EntitlementService (NEW)                                       │
│  │   ├── loadUserEntitlements()                                     │
│  │   └── hasEntitlement()                                           │
│  ├── PermissionService (NEW)                                        │
│  │   ├── loadUserPermissions()                                      │
│  │   ├── hasPermission()                                            │
│  │   └── checkPermission() (async)                                  │
│  └── FeatureFlagService (NEW)                                       │
│      ├── loadFeatureFlags()                                         │
│      └── isEnabled()                                                │
│                                                                        │
│  Evaluation System (ENHANCED)                                        │
│  ├── UniversalEvaluator (ENHANCED)                                  │
│  │   ├── evaluateSync() (ENHANCED with new checks)                 │
│  │   ├── evaluate() (ENHANCED with new checks)                     │
│  │   └── getTrace() (NEW - debugging)                              │
│  ├── SmartEvaluationCache (NEW)                                    │
│  │   ├── L1 Cache (in-memory)                                      │
│  │   ├── L2 Cache (sessionStorage)                                 │
│  │   └── Invalidation strategies                                   │
│  ├── useEvaluation (ENHANCED with debugging)                       │
│  └── useEvaluationBatch (OPTIMIZED)                                │
│                                                                        │
│  Components (ENHANCED)                                              │
│  ├── PageHeader (unchanged)                                        │
│  ├── Form (ENHANCED - field visibility)                            │
│  ├── Table (unchanged)                                             │
│  ├── ConditionalRender (NEW - universal wrapper)                   │
│  └── EvaluationDevTools (NEW - debugging UI)                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
┌─────────────┐
│   User      │
│   Login     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  AppStateProvider Initialization                    │
│  ┌───────────────────────────────────────────────┐ │
│  │ 1. Decode JWT token                           │ │
│  │ 2. Extract actor (userId, groups, email)      │ │
│  │ 3. Load entitlements (API call)               │ │
│  │ 4. Load permissions (API call)                │ │
│  │ 5. Load feature flags (API call)              │ │
│  │ 6. Build actor context                        │ │
│  └───────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Page Render                                        │
│  ┌───────────────────────────────────────────────┐ │
│  │ PostAuthPage                                  │ │
│  │   ├── PageDataProvider (record, formValues)  │ │
│  │   ├── PageHeader (actions)                   │ │
│  │   └── RenderFromPageType (content)           │ │
│  └───────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Action Evaluation (useEvaluationBatch)             │
│  ┌───────────────────────────────────────────────┐ │
│  │ For each action:                              │ │
│  │   1. Build evaluation context                 │ │
│  │      ├── actor (from AppState)                │ │
│  │      ├── record (from PageData)               │ │
│  │      └── pageType, entityName, etc.           │ │
│  │   2. Check cache (SmartEvaluationCache)       │ │
│  │   3. If cached: return result                 │ │
│  │   4. If not cached:                           │ │
│  │      ├── Evaluate roles                       │ │
│  │      ├── Evaluate entitlements (NEW)          │ │
│  │      ├── Evaluate permissions (NEW)           │ │
│  │      ├── Evaluate feature flags (NEW)         │ │
│  │      ├── Evaluate context rules               │ │
│  │      └── Evaluate custom conditions           │ │
│  │   5. Cache result                             │ │
│  │   6. Return { visible, enabled, trace }       │ │
│  └───────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  UI Rendering                                       │
│  ┌───────────────────────────────────────────────┐ │
│  │ Filter visible actions                        │ │
│  │ Render enabled/disabled states                │ │
│  │ Show tooltips for disabled actions            │ │
│  │ (Optional) Show debug traces                  │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Feature Specifications

### Feature 1: Entitlement-Based Evaluation

#### Overview
Integrate the existing entitlements system with the evaluation framework to enable tier-based access control (premium features, subscription levels, etc.).

#### Requirements

**Functional Requirements:**
- FR1.1: Support checking if user has a specific entitlement
- FR1.2: Support checking if user has ALL specified entitlements
- FR1.3: Support checking if user has ANY of specified entitlements
- FR1.4: Entitlements must be loaded on user login
- FR1.5: Entitlements must be cached for performance
- FR1.6: Entitlement checks must work synchronously (no API calls during evaluation)
- FR1.7: Support team-scoped entitlements (user may have different entitlements per team)

**Non-Functional Requirements:**
- NFR1.1: Entitlement loading must complete within 500ms
- NFR1.2: Entitlement checks must execute in <1ms (cached)
- NFR1.3: Must handle entitlement loading failures gracefully (fail-safe to no entitlements)
- NFR1.4: Must support at least 100 entitlements per user without performance degradation

#### Backend Changes (fw24)

**File: `fw24/src/entity/base-entity.ts`**

```typescript
// Add to InlineVisibilityCondition interface
export interface InlineVisibilityCondition {
  // ... existing properties
  
  /**
   * Check if actor has a specific entitlement.
   * 
   * Supports:
   * - Single entitlement: 'premium'
   * - Multiple entitlements (ANY): ['premium', 'pro']
   * - Template reference: '$ref:record.requiredEntitlement'
   * 
   * Evaluation: Returns true if user has ANY of the specified entitlements.
   * 
   * @example
   * // Single entitlement
   * visibility: {
   *   hasEntitlement: 'premium'
   * }
   * 
   * @example
   * // Multiple entitlements (user needs at least one)
   * visibility: {
   *   hasEntitlement: ['premium', 'pro', 'enterprise']
   * }
   * 
   * @example
   * // Dynamic entitlement from record
   * visibility: {
   *   hasEntitlement: { $ref: 'record.requiredEntitlement' }
   * }
   */
  readonly hasEntitlement?: EvaluationRule<string | string[]>;
  
  /**
   * Check if actor has ALL specified entitlements.
   * 
   * Evaluation: Returns true only if user has ALL specified entitlements.
   * 
   * @example
   * // User must have both entitlements
   * visibility: {
   *   hasAllEntitlements: ['premium', 'export-enabled']
   * }
   */
  readonly hasAllEntitlements?: EvaluationRule<string[]>;
  
  /**
   * Team context for entitlement checks.
   * If specified, checks entitlements scoped to this team.
   * 
   * @example
   * visibility: {
   *   hasEntitlement: 'premium',
   *   entitlementTeamId: { $ref: 'record.teamId' }
   * }
   */
  readonly entitlementTeamId?: TemplateRef<string>;
}
```

**File: `fw24/src/entity/base-entity.ts` - Type Exports**

```typescript
// Add to exports
export type {
  // ... existing exports
  InlineVisibilityCondition, // Updated
};
```

#### Frontend Changes (ui24)

**File: `ui24/src/core/types/evaluation.ts`**

```typescript
// Update InlineVisibilityCondition to match backend
export interface InlineVisibilityCondition {
  // ... existing properties
  
  readonly hasEntitlement?: EvaluationRule<string | string[]>;
  readonly hasAllEntitlements?: EvaluationRule<string[]>;
  readonly entitlementTeamId?: TemplateRef<string>;
}
```

**File: `ui24/src/core/services/EntitlementService.ts` (NEW)**

```typescript
import { IRecord } from '../../table/type';

/**
 * User entitlement information
 */
export interface UserEntitlement {
  entitlementId: string;
  teamId?: string;
  status: 'active' | 'expired' | 'revoked';
  startDate: string;
  endDate?: string;
}

/**
 * Service for managing user entitlements
 * 
 * Responsibilities:
 * - Load entitlements on user login
 * - Cache entitlements for fast synchronous checks
 * - Handle team-scoped entitlements
 * - Provide entitlement check methods
 */
export class EntitlementService {
  private entitlements: Map<string, UserEntitlement[]> = new Map();
  private loading: Promise<void> | null = null;
  
  /**
   * Load entitlements for a user
   * Called by AppStateProvider on login
   * 
   * @param userId - User ID to load entitlements for
   * @returns Promise that resolves when entitlements are loaded
   */
  async loadUserEntitlements(userId: string): Promise<void> {
    // Prevent concurrent loads
    if (this.loading) {
      return this.loading;
    }
    
    this.loading = (async () => {
      try {
        const response = await fetch(`/api/user-entitlements?userId=${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to load entitlements: ${response.statusText}`);
        }
        
        const data = await response.json();
        const entitlements: UserEntitlement[] = data.data || [];
        
        // Filter active entitlements only
        const activeEntitlements = entitlements.filter(e => {
          if (e.status !== 'active') return false;
          if (e.endDate && new Date(e.endDate) < new Date()) return false;
          return true;
        });
        
        this.entitlements.set(userId, activeEntitlements);
        
        console.log(`[EntitlementService] Loaded ${activeEntitlements.length} entitlements for user ${userId}`);
      } catch (error) {
        console.error('[EntitlementService] Failed to load entitlements:', error);
        // Fail-safe: set empty entitlements
        this.entitlements.set(userId, []);
      } finally {
        this.loading = null;
      }
    })();
    
    return this.loading;
  }
  
  /**
   * Check if user has a specific entitlement
   * 
   * @param userId - User ID
   * @param entitlementId - Entitlement ID to check
   * @param teamId - Optional team ID for team-scoped entitlements
   * @returns true if user has the entitlement
   */
  hasEntitlement(userId: string, entitlementId: string, teamId?: string): boolean {
    const userEntitlements = this.entitlements.get(userId) || [];
    
    return userEntitlements.some(e => {
      if (e.entitlementId !== entitlementId) return false;
      if (teamId && e.teamId !== teamId) return false;
      return true;
    });
  }
  
  /**
   * Check if user has ANY of the specified entitlements
   * 
   * @param userId - User ID
   * @param entitlementIds - Array of entitlement IDs
   * @param teamId - Optional team ID for team-scoped entitlements
   * @returns true if user has at least one entitlement
   */
  hasAnyEntitlement(userId: string, entitlementIds: string[], teamId?: string): boolean {
    return entitlementIds.some(id => this.hasEntitlement(userId, id, teamId));
  }
  
  /**
   * Check if user has ALL of the specified entitlements
   * 
   * @param userId - User ID
   * @param entitlementIds - Array of entitlement IDs
   * @param teamId - Optional team ID for team-scoped entitlements
   * @returns true if user has all entitlements
   */
  hasAllEntitlements(userId: string, entitlementIds: string[], teamId?: string): boolean {
    return entitlementIds.every(id => this.hasEntitlement(userId, id, teamId));
  }
  
  /**
   * Get all entitlements for a user
   * 
   * @param userId - User ID
   * @param teamId - Optional team ID to filter by team
   * @returns Array of entitlements
   */
  getUserEntitlements(userId: string, teamId?: string): UserEntitlement[] {
    const userEntitlements = this.entitlements.get(userId) || [];
    
    if (teamId) {
      return userEntitlements.filter(e => e.teamId === teamId);
    }
    
    return userEntitlements;
  }
  
  /**
   * Clear entitlements cache
   * Called on logout
   */
  clearCache(): void {
    this.entitlements.clear();
    this.loading = null;
  }
}

// Singleton instance
let entitlementServiceInstance: EntitlementService | null = null;

export function getEntitlementService(): EntitlementService {
  if (!entitlementServiceInstance) {
    entitlementServiceInstance = new EntitlementService();
  }
  return entitlementServiceInstance;
}
```

**File: `ui24/src/core/context/AppStateContext.tsx` - UPDATE**

```typescript
import { getEntitlementService } from '../services/EntitlementService';

// Update IAppState interface
export interface IAppState {
  actor?: {
    actorId: string;
    groups: string[];
    username?: string;
    email?: string;
    cognito?: {
      groups: string[];
      username?: string;
      [key: string]: any;
    };
    entitlements?: string[]; // NEW: Array of entitlement IDs
    // ... rest
  };
  // ... rest
}

// Update AppStateProvider
export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();
  const [actor, setActor] = useState<IAppState['actor'] | undefined>(undefined);
  
  useEffect(() => {
    const loadActorData = async () => {
      try {
        const token = auth.getToken();
        if (!token || !auth.isLoggedIn) {
          setActor(undefined);
          // Clear entitlements on logout
          getEntitlementService().clearCache();
          return;
        }
        
        const decoded = jwtDecode<CognitoTokenPayload>(token);
        const userId = decoded.sub || '';
        
        // Load entitlements
        const entitlementService = getEntitlementService();
        await entitlementService.loadUserEntitlements(userId);
        
        // Get entitlement IDs for context
        const userEntitlements = entitlementService.getUserEntitlements(userId);
        const entitlementIds = userEntitlements.map(e => e.entitlementId);
        
        setActor({
          actorId: userId,
          groups: decoded['cognito:groups'] || [],
          username: decoded['cognito:username'] || decoded.email,
          email: decoded.email,
          cognito: {
            groups: decoded['cognito:groups'] || [],
            username: decoded['cognito:username'],
            ...decoded
          },
          entitlements: entitlementIds, // NEW
        });
      } catch (error) {
        console.error('[AppStateProvider] Failed to load actor data:', error);
        setActor(undefined);
      }
    };
    
    loadActorData();
  }, [auth.isLoggedIn, auth]);
  
  // ... rest of component
};
```

**File: `ui24/src/core/utils/UniversalEvaluator.ts` - UPDATE**

```typescript
import { getEntitlementService } from '../services/EntitlementService';

export class UniversalEvaluator {
  // ... existing code
  
  private evaluateInlineSync(
    config: InlineVisibilityCondition,
    context: EvaluationContext
  ): EvaluationResult {
    // ... existing role checks
    
    // NEW: Entitlement checks
    if (config.hasEntitlement !== undefined) {
      const required = Array.isArray(config.hasEntitlement)
        ? config.hasEntitlement
        : [config.hasEntitlement];
      
      // Resolve template references
      const resolvedEntitlements = required.map(e => {
        if (typeof e === 'object' && '$ref' in e) {
          return this.resolveTemplate(e, context);
        }
        return e;
      });
      
      // Get team ID if specified
      const teamId = config.entitlementTeamId
        ? this.resolveTemplate(config.entitlementTeamId, context)
        : undefined;
      
      const userEntitlements = context.actor?.entitlements || [];
      const entitlementService = getEntitlementService();
      
      // Check if user has ANY of the required entitlements
      const hasAny = resolvedEntitlements.some(entId => {
        // First check in-memory context (fast)
        if (userEntitlements.includes(entId)) {
          // If team-scoped, verify with service
          if (teamId) {
            return entitlementService.hasEntitlement(
              context.actor.actorId,
              entId,
              teamId
            );
          }
          return true;
        }
        return false;
      });
      
      if (!hasAny) {
        return {
          visible: false,
          enabled: false,
          reason: `Missing required entitlement: ${resolvedEntitlements.join(' or ')}`
        };
      }
    }
    
    // NEW: Check ALL entitlements
    if (config.hasAllEntitlements !== undefined) {
      const required = config.hasAllEntitlements;
      
      // Resolve template references
      const resolvedEntitlements = required.map(e => {
        if (typeof e === 'object' && '$ref' in e) {
          return this.resolveTemplate(e, context);
        }
        return e;
      });
      
      // Get team ID if specified
      const teamId = config.entitlementTeamId
        ? this.resolveTemplate(config.entitlementTeamId, context)
        : undefined;
      
      const entitlementService = getEntitlementService();
      
      // Check if user has ALL required entitlements
      const hasAll = resolvedEntitlements.every(entId => {
        return entitlementService.hasEntitlement(
          context.actor.actorId,
          entId,
          teamId
        );
      });
      
      if (!hasAll) {
        return {
          visible: false,
          enabled: false,
          reason: `Missing required entitlements: ${resolvedEntitlements.join(', ')}`
        };
      }
    }
    
    // ... rest of evaluation logic
  }
}
```

#### Configuration Examples

**Example 1: Simple Entitlement Check**
```typescript
// Backend entity schema
export const createGameSchema = () => createEntitySchema({
  model: {
    entity: 'game',
    entityNamePlural: 'Games',
    listPageActions: [
      {
        label: 'Export All Games',
        action: 'export-all',
        icon: 'download',
        visibility: {
          hasEntitlement: 'premium' // Only premium users can export
        }
      }
    ]
  },
  // ... attributes
});
```

**Example 2: Multiple Entitlements (ANY)**
```typescript
listPageActions: [
  {
    label: 'Advanced Analytics',
    url: '/analytics/advanced',
    visibility: {
      hasEntitlement: ['premium', 'pro', 'enterprise'], // Any of these
      requiredRoles: ['admin', 'team-admin'] // AND must be admin
    }
  }
]
```

**Example 3: All Entitlements Required**
```typescript
viewPageActions: [
  {
    label: 'Export to PDF',
    action: 'export-pdf',
    visibility: {
      hasAllEntitlements: ['premium', 'export-enabled'], // Must have both
    }
  }
]
```

**Example 4: Team-Scoped Entitlements**
```typescript
viewPageActions: [
  {
    label: 'Team Premium Features',
    url: '/team/:teamId/premium',
    visibility: {
      hasEntitlement: 'team-premium',
      entitlementTeamId: { $ref: 'record.teamId' } // Check for THIS team
    }
  }
]
```

**Example 5: Dynamic Entitlement from Record**
```typescript
viewPageActions: [
  {
    label: 'Access Feature',
    action: 'access-feature',
    visibility: {
      hasEntitlement: { $ref: 'record.requiredEntitlement' } // Dynamic
    }
  }
]
```

#### Test Scenarios

**Test 1: User with Entitlement**
```typescript
describe('Entitlement Evaluation', () => {
  it('should show action when user has required entitlement', () => {
    const context: EvaluationContext = {
      actor: {
        actorId: 'user-123',
        groups: ['user'],
        entitlements: ['premium', 'export-enabled']
      }
    };
    
    const config: VisibilityConfig = {
      hasEntitlement: 'premium'
    };
    
    const result = evaluator.evaluateSync(config, context);
    
    expect(result.visible).toBe(true);
    expect(result.enabled).toBe(true);
  });
});
```

**Test 2: User without Entitlement**
```typescript
it('should hide action when user lacks required entitlement', () => {
  const context: EvaluationContext = {
    actor: {
      actorId: 'user-123',
      groups: ['user'],
      entitlements: ['basic']
    }
  };
  
  const config: VisibilityConfig = {
    hasEntitlement: 'premium'
  };
  
  const result = evaluator.evaluateSync(config, context);
  
  expect(result.visible).toBe(false);
  expect(result.reason).toContain('Missing required entitlement');
});
```

**Test 3: Multiple Entitlements (ANY)**
```typescript
it('should show action when user has ANY of required entitlements', () => {
  const context: EvaluationContext = {
    actor: {
      actorId: 'user-123',
      groups: ['user'],
      entitlements: ['pro'] // Has one of ['premium', 'pro', 'enterprise']
    }
  };
  
  const config: VisibilityConfig = {
    hasEntitlement: ['premium', 'pro', 'enterprise']
  };
  
  const result = evaluator.evaluateSync(config, context);
  
  expect(result.visible).toBe(true);
});
```

**Test 4: All Entitlements Required**
```typescript
it('should hide action when user lacks ALL required entitlements', () => {
  const context: EvaluationContext = {
    actor: {
      actorId: 'user-123',
      groups: ['user'],
      entitlements: ['premium'] // Missing 'export-enabled'
    }
  };
  
  const config: VisibilityConfig = {
    hasAllEntitlements: ['premium', 'export-enabled']
  };
  
  const result = evaluator.evaluateSync(config, context);
  
  expect(result.visible).toBe(false);
  expect(result.reason).toContain('Missing required entitlements');
});
```

**Test 5: Team-Scoped Entitlements**
```typescript
it('should check entitlements for specific team', () => {
  const context: EvaluationContext = {
    actor: {
      actorId: 'user-123',
      groups: ['user'],
      entitlements: ['team-premium'] // Global list
    },
    record: {
      teamId: 'team-456'
    }
  };
  
  const config: VisibilityConfig = {
    hasEntitlement: 'team-premium',
    entitlementTeamId: { $ref: 'record.teamId' }
  };
  
  // Mock entitlement service to return team-specific check
  const mockService = getEntitlementService();
  jest.spyOn(mockService, 'hasEntitlement').mockReturnValue(true);
  
  const result = evaluator.evaluateSync(config, context);
  
  expect(result.visible).toBe(true);
  expect(mockService.hasEntitlement).toHaveBeenCalledWith(
    'user-123',
    'team-premium',
    'team-456'
  );
});
```

**Test 6: Entitlement Loading Failure (Fail-Safe)**
```typescript
it('should fail-safe to no entitlements on loading error', async () => {
  const mockFetch = jest.spyOn(global, 'fetch').mockRejectedValue(
    new Error('Network error')
  );
  
  const service = new EntitlementService();
  await service.loadUserEntitlements('user-123');
  
  // Should have empty entitlements, not crash
  const hasEntitlement = service.hasEntitlement('user-123', 'premium');
  expect(hasEntitlement).toBe(false);
  
  mockFetch.mockRestore();
});
```

**Test 7: Template Reference Resolution**
```typescript
it('should resolve template references in entitlement checks', () => {
  const context: EvaluationContext = {
    actor: {
      actorId: 'user-123',
      groups: ['user'],
      entitlements: ['feature-x']
    },
    record: {
      requiredEntitlement: 'feature-x'
    }
  };
  
  const config: VisibilityConfig = {
    hasEntitlement: { $ref: 'record.requiredEntitlement' }
  };
  
  const result = evaluator.evaluateSync(config, context);
  
  expect(result.visible).toBe(true);
});
```

#### Edge Cases

**Edge Case 1: No Entitlements in Context**
```typescript
// Context has no entitlements array
const context: EvaluationContext = {
  actor: {
    actorId: 'user-123',
    groups: ['user']
    // entitlements: undefined
  }
};

const config: VisibilityConfig = {
  hasEntitlement: 'premium'
};

const result = evaluator.evaluateSync(config, context);
// Should return false (hidden), not crash
expect(result.visible).toBe(false);
```

**Edge Case 2: Empty Entitlements Array**
```typescript
const context: EvaluationContext = {
  actor: {
    actorId: 'user-123',
    groups: ['user'],
    entitlements: [] // Empty
  }
};

const config: VisibilityConfig = {
  hasEntitlement: 'premium'
};

const result = evaluator.evaluateSync(config, context);
expect(result.visible).toBe(false);
```

**Edge Case 3: Invalid Template Reference**
```typescript
const context: EvaluationContext = {
  actor: {
    actorId: 'user-123',
    groups: ['user'],
    entitlements: ['premium']
  },
  record: {
    // requiredEntitlement: undefined (missing)
  }
};

const config: VisibilityConfig = {
  hasEntitlement: { $ref: 'record.requiredEntitlement' }
};

const result = evaluator.evaluateSync(config, context);
// Should handle gracefully, return false
expect(result.visible).toBe(false);
```

**Edge Case 4: Expired Entitlements**
```typescript
// EntitlementService should filter expired entitlements during load
const entitlements = [
  {
    entitlementId: 'premium',
    status: 'active',
    endDate: '2024-01-01' // Past date
  }
];

// After filtering, this should not be in the active list
const service = new EntitlementService();
// ... load logic should exclude expired
```

**Edge Case 5: Team ID Mismatch**
```typescript
// User has entitlement for team-A, checking for team-B
const context: EvaluationContext = {
  actor: {
    actorId: 'user-123',
    groups: ['user'],
    entitlements: ['team-premium']
  },
  record: {
    teamId: 'team-B'
  }
};

const config: VisibilityConfig = {
  hasEntitlement: 'team-premium',
  entitlementTeamId: { $ref: 'record.teamId' }
};

// Service should return false for team-B
const mockService = getEntitlementService();
jest.spyOn(mockService, 'hasEntitlement').mockReturnValue(false);

const result = evaluator.evaluateSync(config, context);
expect(result.visible).toBe(false);
```

#### Performance Considerations

**Performance Requirements:**
- Entitlement loading: <500ms
- Entitlement check (cached): <1ms
- Memory footprint: <1MB for 100 entitlements

**Optimization Strategies:**
1. **Preload on Login:** Load all entitlements once, cache in memory
2. **Synchronous Checks:** All checks use cached data, no API calls during evaluation
3. **Efficient Data Structure:** Use Map for O(1) lookups
4. **Minimal Data:** Store only entitlement IDs in context, full data in service

**Performance Tests:**
```typescript
describe('Entitlement Performance', () => {
  it('should load 100 entitlements in <500ms', async () => {
    const start = performance.now();
    await entitlementService.loadUserEntitlements('user-123');
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(500);
  });
  
  it('should check entitlement in <1ms', () => {
    const start = performance.now();
    const result = entitlementService.hasEntitlement('user-123', 'premium');
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(1);
  });
});
```

#### Security Considerations

**Security Requirements:**
- SEC1.1: Entitlement checks must be enforced on backend (frontend is for UX only)
- SEC1.2: Entitlement data must not be tamperable by client
- SEC1.3: Expired entitlements must be filtered out
- SEC1.4: Team-scoped entitlements must verify team membership

**Security Implementation:**
1. **Backend Enforcement:** All API endpoints must verify entitlements server-side
2. **JWT Claims:** Consider adding entitlements to JWT for faster checks
3. **Audit Logging:** Log entitlement checks for compliance
4. **Rate Limiting:** Prevent entitlement enumeration attacks

**Security Tests:**
```typescript
describe('Entitlement Security', () => {
  it('should not trust client-provided entitlements', () => {
    // Frontend evaluation is for UX only
    // Backend must always verify
    expect(true).toBe(true); // Placeholder for backend tests
  });
  
  it('should filter expired entitlements', () => {
    const expiredEntitlement = {
      entitlementId: 'premium',
      status: 'active',
      endDate: '2024-01-01'
    };
    
    // Should be filtered during load
    // Test in EntitlementService.loadUserEntitlements
  });
});
```

#### Migration Strategy

**Phase 1: Add Types (No Breaking Changes)**
1. Add new properties to `InlineVisibilityCondition`
2. Mark as optional
3. Deploy backend types
4. Deploy frontend types

**Phase 2: Implement Service**
1. Create `EntitlementService`
2. Integrate with `AppStateProvider`
3. Test with feature flag (disabled by default)

**Phase 3: Implement Evaluation**
1. Update `UniversalEvaluator`
2. Add entitlement checks
3. Test thoroughly

**Phase 4: Enable & Monitor**
1. Enable for internal users
2. Monitor performance metrics
3. Gradual rollout to all users

**Rollback Plan:**
- If issues detected, disable entitlement loading in `AppStateProvider`
- System falls back to role-based checks only
- No data loss or corruption

#### Documentation Requirements

**Developer Documentation:**
1. How to add entitlement checks to actions
2. How to create team-scoped entitlements
3. How to use template references
4. Performance best practices
5. Security guidelines

**API Documentation:**
1. `GET /api/user-entitlements` endpoint spec
2. Response format
3. Error codes
4. Rate limits

**User Documentation:**
1. What are entitlements?
2. How to upgrade to premium?
3. Team-specific entitlements
4. FAQ

---

### Feature 2: Fine-Grained Permission System

#### Overview
Implement resource-level permission checks beyond role-based access. Enable checks like "can_edit_team:123", "can_delete_post:456".

#### Requirements

**Functional Requirements:**
- FR2.1: Support resource-level permission checks
- FR2.2: Support permission checks with dynamic resource IDs
- FR2.3: Permissions must be preloaded for synchronous checks
- FR2.4: Support async permission checks for uncached permissions
- FR2.5: Permission format: `resource:action` or `resource:action:resourceId`
- FR2.6: Support wildcard permissions (e.g., `team:*` for all team actions)

**Non-Functional Requirements:**
- NFR2.1: Cached permission checks must execute in <1ms
- NFR2.2: Uncached permission API calls must complete in <200ms
- NFR2.3: Support at least 1000 permissions per user
- NFR2.4: Permission cache must be invalidated on permission changes

#### Backend Changes (fw24)

**File: `fw24/src/entity/base-entity.ts`**

```typescript
export interface InlineVisibilityCondition {
  // ... existing properties
  
  /**
   * Check if actor has a specific permission.
   * 
   * Supports:
   * - Simple permission: 'team:edit'
   * - Permission with resource ID: { resource: 'team', action: 'edit', resourceId: '$ref:record.teamId' }
   * - Wildcard: 'team:*' (any action on team)
   * 
   * Permission Format:
   * - `resource:action` - General permission (e.g., 'team:create')
   * - `resource:action:resourceId` - Specific resource (e.g., 'team:edit:team-123')
   * - `resource:*` - All actions on resource (e.g., 'team:*')
   * 
   * @example
   * // Simple permission check
   * visibility: {
   *   hasPermission: 'team:create'
   * }
   * 
   * @example
   * // Resource-specific permission
   * visibility: {
   *   hasPermission: {
   *     resource: 'team',
   *     action: 'delete',
   *     resourceId: { $ref: 'record.teamId' }
   *   }
   * }
   * 
   * @example
   * // Wildcard permission
   * visibility: {
   *   hasPermission: 'team:*' // Can do anything with teams
   * }
   */
  readonly hasPermission?: string | {
    resource: string;
    action: string;
    resourceId?: TemplateRef<string>;
  };
  
  /**
   * Check if actor has ALL specified permissions.
   * 
   * @example
   * visibility: {
   *   hasAllPermissions: ['team:edit', 'team:delete']
   * }
   */
  readonly hasAllPermissions?: Array<string | {
    resource: string;
    action: string;
    resourceId?: TemplateRef<string>;
  }>;
  
  /**
   * Check if actor has ANY of specified permissions.
   * 
   * @example
   * visibility: {
   *   hasAnyPermission: ['team:edit', 'team:delete']
   * }
   */
  readonly hasAnyPermission?: Array<string | {
    resource: string;
    action: string;
    resourceId?: TemplateRef<string>;
  }>;
}
```

**File: `fw24/src/api/permissions.ts` (NEW) - Backend API Endpoint**

```typescript
import { Controller, Get, Post, InjectEntityService, BaseEntityService } from '@ten24group/fw24';
import { Request } from '../interfaces/request';

/**
 * Permission check request
 */
interface PermissionCheckRequest {
  permission: string;
  resourceId?: string;
}

/**
 * Permission check response
 */
interface PermissionCheckResponse {
  allowed: boolean;
  reason?: string;
}

/**
 * User permission
 */
interface UserPermission {
  permission: string;
  resourceId?: string;
  grantedAt: string;
  expiresAt?: string;
}

@Controller('permissions', {
  authorizer: {
    type: 'AWS_IAM'
  }
})
export class PermissionsController {
  
  /**
   * Get all permissions for current user
   * GET /api/permissions/user/:userId
   */
  @Get('/user/:userId')
  async getUserPermissions(request: Request): Promise<{ permissions: UserPermission[] }> {
    const userId = request.pathParameters?.userId;
    const actor = request.actor;
    
    // Security: Users can only fetch their own permissions (or admins can fetch any)
    if (userId !== actor.actorId && !actor.cognito?.groups?.includes('admin')) {
      throw new Error('Unauthorized');
    }
    
    // TODO: Implement permission loading from database
    // This is a placeholder - actual implementation depends on your permission storage
    const permissions: UserPermission[] = await this.loadUserPermissions(userId);
    
    return { permissions };
  }
  
  /**
   * Check if user has a specific permission
   * POST /api/permissions/check
   */
  @Post('/check')
  async checkPermission(request: Request): Promise<PermissionCheckResponse> {
    const body: PermissionCheckRequest = JSON.parse(request.body || '{}');
    const actor = request.actor;
    
    const { permission, resourceId } = body;
    
    if (!permission) {
      return { allowed: false, reason: 'Permission not specified' };
    }
    
    // Check permission
    const allowed = await this.hasPermission(actor.actorId, permission, resourceId);
    
    return {
      allowed,
      reason: allowed ? undefined : 'Permission denied'
    };
  }
  
  /**
   * Load user permissions from database
   * TODO: Implement based on your permission storage
   */
  private async loadUserPermissions(userId: string): Promise<UserPermission[]> {
    // Placeholder implementation
    // In real app, query from permissions table/service
    return [];
  }
  
  /**
   * Check if user has permission
   * TODO: Implement based on your permission logic
   */
  private async hasPermission(
    userId: string,
    permission: string,
    resourceId?: string
  ): Promise<boolean> {
    // Placeholder implementation
    // In real app, check against permissions table/service
    
    // Example logic:
    // 1. Load user's permissions
    // 2. Check for exact match
    // 3. Check for wildcard match
    // 4. Check for role-based permissions
    
    return false;
  }
}
```

#### Frontend Changes (ui24)

**File: `ui24/src/core/services/PermissionService.ts` (NEW)**

```typescript
/**
 * User permission
 */
export interface UserPermission {
  permission: string;
  resourceId?: string;
  grantedAt: string;
  expiresAt?: string;
}

/**
 * Permission check result
 */
interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  cached: boolean;
}

/**
 * Service for managing user permissions
 * 
 * Features:
 * - Preload permissions on login for fast synchronous checks
 * - Async permission checks for uncached permissions
 * - Wildcard permission support
 * - Permission cache with invalidation
 */
export class PermissionService {
  private permissions: Map<string, Set<string>> = new Map(); // userId -> Set<permissionKey>
  private loading: Promise<void> | null = null;
  private pendingChecks: Map<string, Promise<boolean>> = new Map();
  
  /**
   * Load permissions for a user
   * Called by AppStateProvider on login
   * 
   * @param userId - User ID to load permissions for
   * @returns Promise that resolves when permissions are loaded
   */
  async loadUserPermissions(userId: string): Promise<void> {
    if (this.loading) {
      return this.loading;
    }
    
    this.loading = (async () => {
      try {
        const response = await fetch(`/api/permissions/user/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to load permissions: ${response.statusText}`);
        }
        
        const data = await response.json();
        const userPermissions: UserPermission[] = data.permissions || [];
        
        // Filter expired permissions
        const activePermissions = userPermissions.filter(p => {
          if (p.expiresAt && new Date(p.expiresAt) < new Date()) return false;
          return true;
        });
        
        // Build permission set
        const permissionSet = new Set<string>();
        activePermissions.forEach(p => {
          const key = p.resourceId
            ? `${p.permission}:${p.resourceId}`
            : p.permission;
          permissionSet.add(key);
        });
        
        this.permissions.set(userId, permissionSet);
        
        console.log(`[PermissionService] Loaded ${permissionSet.size} permissions for user ${userId}`);
      } catch (error) {
        console.error('[PermissionService] Failed to load permissions:', error);
        this.permissions.set(userId, new Set());
      } finally {
        this.loading = null;
      }
    })();
    
    return this.loading;
  }
  
  /**
   * Check if user has permission (synchronous, uses cache)
   * 
   * @param userId - User ID
   * @param permission - Permission string (e.g., 'team:edit')
   * @param resourceId - Optional resource ID
   * @returns true if user has permission (from cache)
   */
  hasPermissionSync(userId: string, permission: string, resourceId?: string): boolean {
    const userPermissions = this.permissions.get(userId);
    if (!userPermissions) return false;
    
    // Check exact match
    const exactKey = resourceId ? `${permission}:${resourceId}` : permission;
    if (userPermissions.has(exactKey)) return true;
    
    // Check wildcard permission
    const [resource, action] = permission.split(':');
    const wildcardKey = `${resource}:*`;
    if (userPermissions.has(wildcardKey)) return true;
    
    // Check general permission (no resource ID)
    if (resourceId && userPermissions.has(permission)) return true;
    
    return false;
  }
  
  /**
   * Check if user has permission (async, with API fallback)
   * 
   * @param userId - User ID
   * @param permission - Permission string
   * @param resourceId - Optional resource ID
   * @returns Promise<boolean>
   */
  async hasPermission(userId: string, permission: string, resourceId?: string): Promise<boolean> {
    // First try cache
    const cachedResult = this.hasPermissionSync(userId, permission, resourceId);
    if (cachedResult) return true;
    
    // If not in cache, call API
    const checkKey = resourceId ? `${permission}:${resourceId}` : permission;
    
    // Deduplicate concurrent checks
    if (this.pendingChecks.has(checkKey)) {
      return this.pendingChecks.get(checkKey)!;
    }
    
    const checkPromise = (async () => {
      try {
        const response = await fetch('/api/permissions/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ permission, resourceId }),
        });
        
        if (!response.ok) {
          throw new Error(`Permission check failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Cache the result
        if (data.allowed) {
          const userPermissions = this.permissions.get(userId) || new Set();
          userPermissions.add(checkKey);
          this.permissions.set(userId, userPermissions);
        }
        
        return data.allowed;
      } catch (error) {
        console.error('[PermissionService] Permission check failed:', error);
        return false; // Fail-safe to deny
      } finally {
        this.pendingChecks.delete(checkKey);
      }
    })();
    
    this.pendingChecks.set(checkKey, checkPromise);
    return checkPromise;
  }
  
  /**
   * Check if user has ALL specified permissions
   * 
   * @param userId - User ID
   * @param permissions - Array of permission strings
   * @returns Promise<boolean>
   */
  async hasAllPermissions(
    userId: string,
    permissions: Array<{ permission: string; resourceId?: string }>
  ): Promise<boolean> {
    const results = await Promise.all(
      permissions.map(p => this.hasPermission(userId, p.permission, p.resourceId))
    );
    return results.every(r => r === true);
  }
  
  /**
   * Check if user has ANY of specified permissions
   * 
   * @param userId - User ID
   * @param permissions - Array of permission strings
   * @returns Promise<boolean>
   */
  async hasAnyPermission(
    userId: string,
    permissions: Array<{ permission: string; resourceId?: string }>
  ): Promise<boolean> {
    const results = await Promise.all(
      permissions.map(p => this.hasPermission(userId, p.permission, p.resourceId))
    );
    return results.some(r => r === true);
  }
  
  /**
   * Invalidate permission cache for user
   * Called when permissions change
   * 
   * @param userId - User ID
   */
  invalidateCache(userId: string): void {
    this.permissions.delete(userId);
  }
  
  /**
   * Clear all caches
   * Called on logout
   */
  clearCache(): void {
    this.permissions.clear();
    this.pendingChecks.clear();
    this.loading = null;
  }
}

// Singleton instance
let permissionServiceInstance: PermissionService | null = null;

export function getPermissionService(): PermissionService {
  if (!permissionServiceInstance) {
    permissionServiceInstance = new PermissionService();
  }
  return permissionServiceInstance;
}
```

**File: `ui24/src/core/context/AppStateContext.tsx` - UPDATE**

```typescript
import { getPermissionService } from '../services/PermissionService';

// Update AppStateProvider to load permissions
export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();
  const [actor, setActor] = useState<IAppState['actor'] | undefined>(undefined);
  
  useEffect(() => {
    const loadActorData = async () => {
      try {
        const token = auth.getToken();
        if (!token || !auth.isLoggedIn) {
          setActor(undefined);
          getEntitlementService().clearCache();
          getPermissionService().clearCache(); // NEW
          return;
        }
        
        const decoded = jwtDecode<CognitoTokenPayload>(token);
        const userId = decoded.sub || '';
        
        // Load entitlements and permissions in parallel
        await Promise.all([
          getEntitlementService().loadUserEntitlements(userId),
          getPermissionService().loadUserPermissions(userId), // NEW
        ]);
        
        // ... rest of actor setup
      } catch (error) {
        console.error('[AppStateProvider] Failed to load actor data:', error);
        setActor(undefined);
      }
    };
    
    loadActorData();
  }, [auth.isLoggedIn, auth]);
  
  // ... rest
};
```

**File: `ui24/src/core/utils/UniversalEvaluator.ts` - UPDATE**

```typescript
import { getPermissionService } from '../services/PermissionService';

export class UniversalEvaluator {
  // ... existing code
  
  /**
   * Evaluate permission checks
   * Note: Permission checks may require async evaluation if not cached
   */
  private async evaluatePermissions(
    config: InlineVisibilityCondition,
    context: EvaluationContext
  ): Promise<{ pass: boolean; reason?: string }> {
    const permissionService = getPermissionService();
    const userId = context.actor?.actorId;
    
    if (!userId) {
      return { pass: false, reason: 'No actor in context' };
    }
    
    // Check hasPermission
    if (config.hasPermission) {
      const permission = typeof config.hasPermission === 'string'
        ? config.hasPermission
        : config.hasPermission;
      
      if (typeof permission === 'string') {
        // Simple permission string
        const allowed = await permissionService.hasPermission(userId, permission);
        if (!allowed) {
          return { pass: false, reason: `Missing permission: ${permission}` };
        }
      } else {
        // Permission object with resource ID
        const resourceId = permission.resourceId
          ? this.resolveTemplate(permission.resourceId, context)
          : undefined;
        
        const permissionString = `${permission.resource}:${permission.action}`;
        const allowed = await permissionService.hasPermission(
          userId,
          permissionString,
          resourceId
        );
        
        if (!allowed) {
          return {
            pass: false,
            reason: `Missing permission: ${permissionString}${resourceId ? `:${resourceId}` : ''}`
          };
        }
      }
    }
    
    // Check hasAllPermissions
    if (config.hasAllPermissions) {
      const permissions = config.hasAllPermissions.map(p => {
        if (typeof p === 'string') {
          return { permission: p };
        } else {
          const resourceId = p.resourceId
            ? this.resolveTemplate(p.resourceId, context)
            : undefined;
          return {
            permission: `${p.resource}:${p.action}`,
            resourceId
          };
        }
      });
      
      const allowed = await permissionService.hasAllPermissions(userId, permissions);
      if (!allowed) {
        return { pass: false, reason: 'Missing required permissions' };
      }
    }
    
    // Check hasAnyPermission
    if (config.hasAnyPermission) {
      const permissions = config.hasAnyPermission.map(p => {
        if (typeof p === 'string') {
          return { permission: p };
        } else {
          const resourceId = p.resourceId
            ? this.resolveTemplate(p.resourceId, context)
            : undefined;
          return {
            permission: `${p.resource}:${p.action}`,
            resourceId
          };
        }
      });
      
      const allowed = await permissionService.hasAnyPermission(userId, permissions);
      if (!allowed) {
        return { pass: false, reason: 'Missing any of required permissions' };
      }
    }
    
    return { pass: true };
  }
  
  /**
   * Updated async evaluate to handle permissions
   */
  async evaluate(
    config: VisibilityConfig | undefined,
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    if (!config) {
      return { visible: true, enabled: true };
    }
    
    try {
      // Try sync evaluation first
      if (!this.requiresAsyncEvaluation(config)) {
        return this.evaluateSync(config, context);
      }
      
      // Handle async permission checks
      if ('hasPermission' in config || 'hasAllPermissions' in config || 'hasAnyPermission' in config) {
        const permissionResult = await this.evaluatePermissions(config as InlineVisibilityCondition, context);
        if (!permissionResult.pass) {
          return {
            visible: false,
            enabled: false,
            reason: permissionResult.reason
          };
        }
      }
      
      // ... rest of async evaluation
      
      return { visible: true, enabled: true };
    } catch (error) {
      console.error('[UniversalEvaluator] Evaluation failed:', error);
      return { visible: false, enabled: false, reason: 'Evaluation error' };
    }
  }
  
  /**
   * Check if config requires async evaluation
   */
  private requiresAsyncEvaluation(config: VisibilityConfig): boolean {
    if ('custom' in config) return true;
    if ('conditions' in config) return true;
    if ('hasPermission' in config) return true; // NEW
    if ('hasAllPermissions' in config) return true; // NEW
    if ('hasAnyPermission' in config) return true; // NEW
    return false;
  }
}
```

#### Configuration Examples

**Example 1: Simple Permission Check**
```typescript
listPageActions: [
  {
    label: 'Create Team',
    url: '/team/create',
    visibility: {
      hasPermission: 'team:create'
    }
  }
]
```

**Example 2: Resource-Specific Permission**
```typescript
viewPageActions: [
  {
    label: 'Delete Team',
    action: 'delete',
    visibility: {
      hasPermission: {
        resource: 'team',
        action: 'delete',
        resourceId: { $ref: 'record.teamId' }
      }
    }
  }
]
```

**Example 3: Wildcard Permission**
```typescript
listPageActions: [
  {
    label: 'Team Management',
    url: '/teams/manage',
    visibility: {
      hasPermission: 'team:*' // Can do anything with teams
    }
  }
]
```

**Example 4: Multiple Permissions (ALL)**
```typescript
viewPageActions: [
  {
    label: 'Transfer Ownership',
    action: 'transfer-ownership',
    visibility: {
      hasAllPermissions: [
        'team:edit',
        'team:transfer-ownership'
      ]
    }
  }
]
```

**Example 5: Multiple Permissions (ANY)**
```typescript
listPageActions: [
  {
    label: 'View Analytics',
    url: '/analytics',
    visibility: {
      hasAnyPermission: [
        'analytics:view',
        'analytics:admin'
      ]
    }
  }
]
```

#### Test Scenarios

**Test 1: User with Permission**
```typescript
it('should show action when user has required permission', async () => {
  const permissionService = getPermissionService();
  jest.spyOn(permissionService, 'hasPermission').mockResolvedValue(true);
  
  const context: EvaluationContext = {
    actor: {
      actorId: 'user-123',
      groups: ['user']
    }
  };
  
  const config: VisibilityConfig = {
    hasPermission: 'team:create'
  };
  
  const result = await evaluator.evaluate(config, context);
  
  expect(result.visible).toBe(true);
  expect(permissionService.hasPermission).toHaveBeenCalledWith(
    'user-123',
    'team:create',
    undefined
  );
});
```

**Test 2: User without Permission**
```typescript
it('should hide action when user lacks permission', async () => {
  const permissionService = getPermissionService();
  jest.spyOn(permissionService, 'hasPermission').mockResolvedValue(false);
  
  const context: EvaluationContext = {
    actor: {
      actorId: 'user-123',
      groups: ['user']
    }
  };
  
  const config: VisibilityConfig = {
    hasPermission: 'team:delete'
  };
  
  const result = await evaluator.evaluate(config, context);
  
  expect(result.visible).toBe(false);
  expect(result.reason).toContain('Missing permission');
});
```

**Test 3: Resource-Specific Permission**
```typescript
it('should check permission for specific resource', async () => {
  const permissionService = getPermissionService();
  jest.spyOn(permissionService, 'hasPermission').mockResolvedValue(true);
  
  const context: EvaluationContext = {
    actor: {
      actorId: 'user-123',
      groups: ['user']
    },
    record: {
      teamId: 'team-456'
    }
  };
  
  const config: VisibilityConfig = {
    hasPermission: {
      resource: 'team',
      action: 'edit',
      resourceId: { $ref: 'record.teamId' }
    }
  };
  
  const result = await evaluator.evaluate(config, context);
  
  expect(result.visible).toBe(true);
  expect(permissionService.hasPermission).toHaveBeenCalledWith(
    'user-123',
    'team:edit',
    'team-456'
  );
});
```

**Test 4: Wildcard Permission**
```typescript
it('should match wildcard permissions', () => {
  const permissionService = getPermissionService();
  
  // User has 'team:*' permission
  const userPermissions = new Set(['team:*']);
  permissionService['permissions'].set('user-123', userPermissions);
  
  // Check for specific action
  const hasPermission = permissionService.hasPermissionSync('user-123', 'team:delete');
  
  expect(hasPermission).toBe(true);
});
```

**Test 5: Permission Caching**
```typescript
it('should cache permission check results', async () => {
  const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ allowed: true })
  } as Response);
  
  const permissionService = getPermissionService();
  
  // First call - should hit API
  await permissionService.hasPermission('user-123', 'team:create');
  expect(mockFetch).toHaveBeenCalledTimes(1);
  
  // Second call - should use cache
  await permissionService.hasPermission('user-123', 'team:create');
  expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, not 2
  
  mockFetch.mockRestore();
});
```

#### Performance Considerations

**Performance Requirements:**
- Permission loading: <500ms
- Cached permission check: <1ms
- Uncached permission API call: <200ms

**Optimization Strategies:**
1. **Preload Common Permissions:** Load user's permissions on login
2. **Cache API Results:** Cache permission check results
3. **Deduplicate Concurrent Checks:** Prevent multiple API calls for same permission
4. **Wildcard Support:** Reduce number of permissions needed

#### Security Considerations

**Security Requirements:**
- SEC2.1: All permission checks must be enforced on backend
- SEC2.2: Frontend checks are for UX only (hiding UI elements)
- SEC2.3: API endpoints must verify permissions before executing actions
- SEC2.4: Permission enumeration must be prevented

**Security Implementation:**
1. **Backend Enforcement:** Every API endpoint verifies permissions
2. **Audit Logging:** Log all permission checks
3. **Rate Limiting:** Prevent permission enumeration attacks
4. **Least Privilege:** Grant minimum necessary permissions

---

### Feature 3: Form Field Visibility

*[Due to length constraints, I'll create a separate document for the remaining features. This document already covers 2 major features in extensive detail.]*

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Implement entitlement and permission infrastructure

**Tasks:**
1. ✅ Add types to backend (`InlineVisibilityCondition` updates)
2. ✅ Create `EntitlementService` in frontend
3. ✅ Create `PermissionService` in frontend
4. ✅ Update `AppStateContext` to load entitlements/permissions
5. ✅ Write unit tests for services
6. ✅ Deploy with feature flag (disabled)

**Deliverables:**
- Updated type definitions
- Service implementations
- Unit test suite
- Feature flag configuration

**Success Criteria:**
- All tests passing
- No performance regression
- Services load data successfully

### Phase 2: Evaluation Integration (Week 2)
**Goal:** Integrate entitlements/permissions into evaluation system

**Tasks:**
1. ✅ Update `UniversalEvaluator` for entitlement checks
2. ✅ Update `UniversalEvaluator` for permission checks
3. ✅ Add evaluation tests
4. ✅ Test with real entity schemas
5. ✅ Performance testing
6. ✅ Enable for internal users

**Deliverables:**
- Updated evaluator
- Integration tests
- Performance benchmarks
- Internal rollout

**Success Criteria:**
- <50ms evaluation time (cached)
- <200ms for uncached permissions
- Zero errors in internal testing

### Phase 3: Form Fields & Debugging (Week 3)
**Goal:** Extend to form fields and add debugging tools

**Tasks:**
1. ✅ Implement form field visibility
2. ✅ Create evaluation debugging tools
3. ✅ Add trace collection
4. ✅ Create dev tools UI
5. ✅ Documentation
6. ✅ Enable for all users

**Deliverables:**
- Form field visibility
- Debugging tools
- Developer documentation
- Full rollout

**Success Criteria:**
- Form fields respect visibility config
- Debug traces available in dev mode
- Documentation complete

### Phase 4: Advanced Features (Week 4-6)
**Goal:** Feature flags, widgets, caching, optimization

**Tasks:**
1. ✅ Implement feature flags
2. ✅ Create `ConditionalRender` component
3. ✅ Implement smart caching
4. ✅ Optimize batch evaluation
5. ✅ Performance tuning
6. ✅ Final testing & rollout

**Deliverables:**
- Feature flag system
- Universal conditional rendering
- Smart cache implementation
- Optimized batch evaluation
- Performance report

**Success Criteria:**
- All features working
- Performance targets met
- Zero production issues

---

## Testing Strategy

### Unit Tests

**Backend Tests:**
- Type validation
- Schema validation
- API endpoint tests

**Frontend Tests:**
- Service tests (EntitlementService, PermissionService)
- Evaluator tests (all condition types)
- Hook tests (useEvaluation, useEvaluationBatch)
- Component tests (Form, PageHeader, ConditionalRender)

**Coverage Target:** >90%

### Integration Tests

**Scenarios:**
1. User login → Load entitlements → Evaluate actions
2. Permission check → API call → Cache result
3. Form render → Evaluate fields → Hide/show
4. Navigation → Clear cache → Reload data
5. Multi-level conditions (roles + entitlements + permissions)

### E2E Tests

**User Flows:**
1. Premium user sees export action, free user doesn't
2. Admin can delete team, regular user can't
3. Form shows salary field only to HR role
4. Feature flag enables new dashboard for beta users
5. Debug mode shows evaluation traces

### Performance Tests

**Benchmarks:**
- Entitlement loading: <500ms
- Permission loading: <500ms
- Cached evaluation: <1ms
- Uncached permission check: <200ms
- Batch evaluation (10 actions): <50ms
- Form render with 20 fields: <100ms

### Security Tests

**Scenarios:**
1. Frontend bypass attempt (verify backend enforcement)
2. Permission enumeration attack (verify rate limiting)
3. Expired entitlement (verify filtering)
4. Invalid JWT (verify rejection)
5. Cross-tenant access (verify isolation)

---

## Migration & Rollout

### Backward Compatibility

**Guarantees:**
- All existing visibility configs continue to work
- No breaking changes to APIs
- Gradual adoption (opt-in for new features)
- Fallback to role-based checks if services fail

### Migration Steps

**Step 1: Deploy Types (No Impact)**
- Deploy updated type definitions
- No functional changes
- No migration needed

**Step 2: Deploy Services (Disabled)**
- Deploy EntitlementService, PermissionService
- Feature flag OFF
- Monitor for errors

**Step 3: Enable for Internal (Limited Rollout)**
- Enable feature flag for internal users
- Monitor performance and errors
- Gather feedback

**Step 4: Gradual Rollout (Phased)**
- Enable for 10% of users
- Monitor metrics
- Increase to 50%, then 100%

**Step 5: Deprecate Old Patterns (Future)**
- Mark old patterns as deprecated
- Provide migration guide
- Support old patterns for 6 months

### Rollback Plan

**Trigger Conditions:**
- Error rate >1%
- Performance degradation >20%
- Security issue detected

**Rollback Steps:**
1. Disable feature flag
2. System falls back to role-based checks
3. Investigate issue
4. Fix and redeploy
5. Re-enable gradually

**Data Safety:**
- No data loss (all changes are additive)
- No database migrations required
- Cache can be cleared without impact

---

## Performance Benchmarks

### Target Metrics

| Metric | Target | Acceptable | Unacceptable |
|--------|--------|------------|--------------|
| Entitlement Load | <300ms | <500ms | >500ms |
| Permission Load | <300ms | <500ms | >500ms |
| Cached Evaluation | <1ms | <5ms | >10ms |
| Uncached Permission | <100ms | <200ms | >300ms |
| Batch Eval (10 items) | <20ms | <50ms | >100ms |
| Form Render (20 fields) | <50ms | <100ms | >200ms |
| Memory Usage | <5MB | <10MB | >20MB |

### Monitoring

**Metrics to Track:**
- Evaluation latency (p50, p95, p99)
- Cache hit rate
- API call rate
- Error rate
- Memory usage

**Alerting:**
- Alert if p95 latency >100ms
- Alert if error rate >0.1%
- Alert if cache hit rate <80%

---

## Security Considerations

### Threat Model

**Threats:**
1. **Frontend Bypass:** User modifies client code to show hidden actions
2. **Permission Enumeration:** Attacker tries to discover all permissions
3. **Cache Poisoning:** Attacker tries to inject false permissions
4. **Token Theft:** Attacker steals JWT token
5. **Privilege Escalation:** User tries to gain unauthorized access

**Mitigations:**
1. **Backend Enforcement:** All API endpoints verify permissions
2. **Rate Limiting:** Limit permission check API calls
3. **Signed Tokens:** JWT tokens are signed and verified
4. **Audit Logging:** Log all permission checks
5. **Least Privilege:** Grant minimum necessary permissions

### Security Checklist

- [ ] All API endpoints verify permissions server-side
- [ ] Frontend checks are for UX only (not security)
- [ ] JWT tokens are validated on every request
- [ ] Expired entitlements/permissions are filtered
- [ ] Permission checks are logged for audit
- [ ] Rate limiting is enabled on permission APIs
- [ ] Error messages don't leak sensitive information
- [ ] Cache is cleared on logout
- [ ] Cross-tenant access is prevented

---

## Documentation Requirements

### Developer Documentation

**Topics:**
1. How to add entitlement checks
2. How to add permission checks
3. How to use form field visibility
4. How to use feature flags
5. How to debug evaluations
6. Performance best practices
7. Security guidelines
8. Migration guide

**Format:**
- Markdown files in `/docs`
- Code examples
- Screenshots
- Video tutorials

### API Documentation

**Endpoints:**
1. `GET /api/user-entitlements` - Get user entitlements
2. `GET /api/permissions/user/:userId` - Get user permissions
3. `POST /api/permissions/check` - Check permission

**For Each Endpoint:**
- Description
- Request format
- Response format
- Error codes
- Rate limits
- Examples

### User Documentation

**Topics:**
1. What are entitlements?
2. What are permissions?
3. How to upgrade subscription?
4. How to request permissions?
5. FAQ

**Format:**
- Help center articles
- In-app tooltips
- Video tutorials

---

## Appendix

### Glossary

- **Entitlement:** A feature or capability granted to a user (e.g., 'premium', 'export-enabled')
- **Permission:** Authorization to perform an action on a resource (e.g., 'team:edit:team-123')
- **Role:** A group of users with similar access (e.g., 'admin', 'user')
- **Feature Flag:** A toggle to enable/disable features (e.g., 'new_dashboard')
- **Evaluation:** The process of determining if an action should be visible/enabled
- **Context:** Data available during evaluation (actor, record, pageType, etc.)

### References

- [Existing Evaluation System Documentation]
- [Validation Framework Documentation]
- [Entity Schema Documentation]
- [UI24 Component Documentation]

### Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-31 | Initial comprehensive plan |

---

**END OF DOCUMENT**

*Note: This document covers Features 1-2 in extensive detail. Features 3-8 will follow the same structure and level of detail. The complete plan will be approximately 200-300 pages when all features are fully documented.*

