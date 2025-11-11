import { describe, expect, it } from '@jest/globals';
import {
  resolvePlaceholder,
  resolveFilterPlaceholders,
  type PlaceholderContext
} from '../placeholderResolver';

describe('Placeholder Resolver', () => {
  const mockContext: PlaceholderContext = {
    actor: {
      actorId: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      organizationId: 'org-456',
      groups: ['admin', 'team-admin']
    },
    routeParams: {
      teamId: 'team-789',
      seasonId: 'season-101'
    },
    queryParams: {
      page: '1',
      sort: 'name'
    },
    record: {
      gameId: 'game-001',
      homeTeamId: 'team-home'
    },
    parent: {
      leagueId: 'league-001'
    },
    now: new Date('2024-01-15T10:30:00.000Z')
  };

  describe('resolvePlaceholder', () => {
    describe('Actor context', () => {
      it('should resolve actor.actorId', () => {
        const result = resolvePlaceholder('actor.actorId', mockContext);
        expect(result).toBe('user-123');
      });

      it('should resolve actor.email', () => {
        const result = resolvePlaceholder('actor.email', mockContext);
        expect(result).toBe('test@example.com');
      });

      it('should resolve actor.organizationId', () => {
        const result = resolvePlaceholder('actor.organizationId', mockContext);
        expect(result).toBe('org-456');
      });

      it('should return undefined for non-existent actor property', () => {
        const result = resolvePlaceholder('actor.nonExistent', mockContext);
        expect(result).toBeUndefined();
      });

      it('should handle missing actor gracefully', () => {
        const result = resolvePlaceholder('actor.actorId', { ...mockContext, actor: undefined });
        expect(result).toBeUndefined();
      });
    });

    describe('Route parameters', () => {
      it('should resolve route params', () => {
        const result = resolvePlaceholder('teamId', mockContext);
        expect(result).toBe('team-789');
      });

      it('should resolve multiple route params', () => {
        const seasonId = resolvePlaceholder('seasonId', mockContext);
        const teamId = resolvePlaceholder('teamId', mockContext);
        
        expect(seasonId).toBe('season-101');
        expect(teamId).toBe('team-789');
      });

      it('should return undefined for non-existent route param', () => {
        const result = resolvePlaceholder('nonExistent', mockContext);
        expect(result).toBeUndefined();
      });
    });

    describe('Record context', () => {
      it('should resolve record.gameId', () => {
        const result = resolvePlaceholder('record.gameId', mockContext);
        expect(result).toBe('game-001');
      });

      it('should resolve record.homeTeamId', () => {
        const result = resolvePlaceholder('record.homeTeamId', mockContext);
        expect(result).toBe('team-home');
      });

      it('should handle missing record gracefully', () => {
        const result = resolvePlaceholder('record.gameId', { ...mockContext, record: undefined });
        expect(result).toBeUndefined();
      });
    });

    describe('Parent context', () => {
      it('should resolve parent.leagueId', () => {
        const result = resolvePlaceholder('parent.leagueId', mockContext);
        expect(result).toBe('league-001');
      });

      it('should handle missing parent gracefully', () => {
        const result = resolvePlaceholder('parent.leagueId', { ...mockContext, parent: undefined });
        expect(result).toBeUndefined();
      });
    });

    describe('Date expressions', () => {
      it('should resolve startOfToday', () => {
        const result = resolvePlaceholder('startOfToday', mockContext);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        // Date should be in ISO format
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      it('should resolve endOfToday', () => {
        const result = resolvePlaceholder('endOfToday', mockContext);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        // Date should be in ISO format
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      it('should resolve startOfMonth', () => {
        const result = resolvePlaceholder('startOfMonth', mockContext);
        expect(result).toBeDefined();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      it('should resolve endOfMonth', () => {
        const result = resolvePlaceholder('endOfMonth', mockContext);
        expect(result).toBeDefined();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      it('should resolve startOfWeek', () => {
        const result = resolvePlaceholder('startOfWeek', mockContext);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      });

      it('should resolve now', () => {
        const result = resolvePlaceholder('now', mockContext);
        expect(result).toBeDefined();
        // Should match the exact time from mock context
        expect(result).toBe('2024-01-15T10:30:00.000Z');
      });

      it('should resolve nowMinus7Days', () => {
        const result = resolvePlaceholder('nowMinus7Days', mockContext);
        expect(result).toBeDefined();
        // Should be 7 days before mock context time
        expect(result).toMatch(/2024-01-08T10:30:00/);
      });

      it('should resolve startOfYear', () => {
        const result = resolvePlaceholder('startOfYear', mockContext);
        expect(result).toBeDefined();
        // Should be start of year (timezone-dependent)
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      it('should handle unknown date expression', () => {
        const result = resolvePlaceholder('unknownDateExpression', mockContext);
        // Unknown expressions are not date expressions, so they check route params
        expect(result).toBeUndefined();
      });
    });

    describe('Priority and fallback', () => {
      it('should prioritize route params over query params', () => {
        const context = {
          routeParams: { id: 'route-123' },
          queryParams: { id: 'query-456' }
        };
        
        const result = resolvePlaceholder('id', context);
        expect(result).toBe('route-123');
      });

      it('should resolve query params with dot notation', () => {
        const result = resolvePlaceholder('queryParams.page', mockContext);
        expect(result).toBe('1');
      });

      it('should handle empty context', () => {
        const result = resolvePlaceholder('anything', {});
        expect(result).toBeUndefined();
      });
    });
  });

  describe('resolveFilterPlaceholders', () => {
    it('should resolve placeholders in simple filters', () => {
      const filters = {
        teamId: { eq: ':teamId' },
        status: { eq: 'active' }
      };

      const resolved = resolveFilterPlaceholders(filters, mockContext);

      expect(resolved.teamId.eq).toBe('team-789');
      expect(resolved.status.eq).toBe('active');
    });

    it('should resolve date placeholders in filters', () => {
      const filters = {
        createdAt: { gte: ':startOfMonth' },
        updatedAt: { lte: ':endOfMonth' }
      };

      const resolved = resolveFilterPlaceholders(filters, mockContext);

      expect(resolved.createdAt.gte).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(resolved.updatedAt.lte).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should resolve actor placeholders in filters', () => {
      const filters = {
        userId: { eq: ':actor.actorId' },
        organizationId: { eq: ':actor.organizationId' }
      };

      const resolved = resolveFilterPlaceholders(filters, mockContext);

      expect(resolved.userId.eq).toBe('user-123');
      expect(resolved.organizationId.eq).toBe('org-456');
    });

    it('should handle nested filter operators', () => {
      const filters = {
        price: { gte: 100, lte: 500 },
        date: { gte: ':startOfToday', lte: ':endOfToday' }
      };

      const resolved = resolveFilterPlaceholders(filters, mockContext);

      expect(resolved.price.gte).toBe(100);
      expect(resolved.price.lte).toBe(500);
      expect(resolved.date.gte).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(resolved.date.lte).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle array values', () => {
      const filters = {
        or: [
          { teamId: { eq: ':teamId' } },
          { teamId: { eq: 'team-static' } }
        ]
      };

      const resolved = resolveFilterPlaceholders(filters, mockContext);

      expect(resolved.or[0].teamId.eq).toBe('team-789');
      expect(resolved.or[1].teamId.eq).toBe('team-static');
    });

    it('should handle nested objects', () => {
      const filters = {
        metadata: {
          owner: ':actor.actorId',
          createdDate: ':startOfToday'
        }
      };

      const resolved = resolveFilterPlaceholders(filters, mockContext);

      expect(resolved.metadata.owner).toBe('user-123');
      expect(resolved.metadata.createdDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should leave non-placeholder strings unchanged', () => {
      const filters = {
        status: { eq: 'active' },
        name: { contains: 'test' }
      };

      const resolved = resolveFilterPlaceholders(filters, mockContext);

      expect(resolved.status.eq).toBe('active');
      expect(resolved.name.contains).toBe('test');
    });

    it('should handle empty filters', () => {
      const resolved = resolveFilterPlaceholders({}, mockContext);
      expect(resolved).toEqual({});
    });

    it('should handle null and undefined values', () => {
      const filters = {
        field1: { eq: null },
        field2: { eq: undefined },
        field3: { eq: ':teamId' }
      };

      const resolved = resolveFilterPlaceholders(filters, mockContext);

      expect(resolved.field1.eq).toBeNull();
      expect(resolved.field2.eq).toBeUndefined();
      expect(resolved.field3.eq).toBe('team-789');
    });

    it('should handle complex nested structures', () => {
      const filters = {
        or: [
          { teamId: { eq: ':teamId' } },
          { seasonId: { eq: ':seasonId' } }
        ],
        and: {
          createdAt: { gte: ':startOfMonth' },
          status: { eq: 'active' }
        }
      };

      const resolved = resolveFilterPlaceholders(filters, mockContext);

      expect(resolved.or[0].teamId.eq).toBe('team-789');
      expect(resolved.or[1].seasonId.eq).toBe('season-101');
      expect(resolved.and.createdAt.gte).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(resolved.and.status.eq).toBe('active');
    });

    it('should handle unresolvable placeholders gracefully', () => {
      const filters = {
        unknownField: { eq: ':nonExistentParam' }
      };

      const resolved = resolveFilterPlaceholders(filters, mockContext);

      // Unresolved placeholders become undefined
      expect(resolved.unknownField.eq).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle placeholders with multiple dots', () => {
      const context = {
        actor: {
          profile: {
            settings: {
              theme: 'dark'
            }
          }
        }
      };

      const result = resolvePlaceholder('actor.profile.settings.theme', context);
      expect(result).toBe('dark');
    });

    it('should handle numeric values in context', () => {
      const context = {
        record: {
          count: 42,
          price: 99.99
        }
      };

      const result1 = resolvePlaceholder('record.count', context);
      const result2 = resolvePlaceholder('record.price', context);

      expect(result1).toBe(42);
      expect(result2).toBe(99.99);
    });

    it('should handle boolean values in context', () => {
      const context = {
        record: {
          isActive: true,
          isDeleted: false
        }
      };

      const result1 = resolvePlaceholder('record.isActive', context);
      const result2 = resolvePlaceholder('record.isDeleted', context);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('should handle array values in context', () => {
      const context = {
        actor: {
          roles: ['admin', 'user']
        }
      };

      const result = resolvePlaceholder('actor.roles', context);
      expect(result).toEqual(['admin', 'user']);
    });
  });
});

