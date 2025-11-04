import { UniversalEvaluator } from '../UniversalEvaluator';
import { EvaluationContext, VisibilityConfig } from '../../types/evaluation';

describe('UniversalEvaluator', () => {
  let evaluator: UniversalEvaluator;

  beforeEach(() => {
    evaluator = new UniversalEvaluator();
  });

  describe('Mixed Conditions (requiredRoles + record)', () => {
    const adminContext: EvaluationContext = {
      actor: {
        cognito: {
          groups: ['admin']
        }
      },
      record: {
        isActive: true,
        errorCount: 5
      }
    };

    const userContext: EvaluationContext = {
      actor: {
        cognito: {
          groups: ['user']
        }
      },
      record: {
        isActive: true,
        errorCount: 5
      }
    };

    test('should hide when record condition fails (isActive required but is true)', () => {
      const config: VisibilityConfig = {
        requiredRoles: ['admin'],
        record: {
          isActive: {
            eq: false
          }
        }
      };

      const result = evaluator.evaluateSync(config, adminContext);
      
      expect(result.visible).toBe(false);
      expect(result.enabled).toBe(false);
    });

    test('should show but disable when role fails', () => {
      const config: VisibilityConfig = {
        requiredRoles: ['admin'],
        record: {
          isActive: {
            eq: true
          }
        }
      };

      const result = evaluator.evaluateSync(config, userContext);
      
      expect(result.visible).toBe(true);
      expect(result.enabled).toBe(false);
    });

    test('should show and enable when both role and record pass', () => {
      const config: VisibilityConfig = {
        requiredRoles: ['admin'],
        record: {
          isActive: {
            eq: true
          }
        }
      };

      const result = evaluator.evaluateSync(config, adminContext);
      
      expect(result.visible).toBe(true);
      expect(result.enabled).toBe(true);
    });

    test('should hide when multiple record conditions fail', () => {
      const config: VisibilityConfig = {
        requiredRoles: ['admin'],
        record: {
          isActive: {
            eq: false
          },
          errorCount: {
            gt: 10
          }
        }
      };

      const result = evaluator.evaluateSync(config, adminContext);
      
      // isActive is true but should be false - HIDE
      expect(result.visible).toBe(false);
      expect(result.enabled).toBe(false);
    });

    test('should hide when one record condition fails even if role passes', () => {
      const config: VisibilityConfig = {
        requiredRoles: ['admin'],
        record: {
          errorCount: {
            gt: 10
          }
        }
      };

      const result = evaluator.evaluateSync(config, adminContext);
      
      // errorCount is 5, needs > 10 - HIDE
      expect(result.visible).toBe(false);
      expect(result.enabled).toBe(false);
    });
  });

  describe('Pure Record Conditions', () => {
    const context: EvaluationContext = {
      actor: {},
      record: {
        isActive: true,
        errorCount: 5,
        apiCredentials: {
          apiKey: 'test-key'
        }
      }
    };

    test('should show when record.isActive equals true', () => {
      const config: VisibilityConfig = {
        record: {
          isActive: {
            eq: true
          }
        }
      };

      const result = evaluator.evaluateSync(config, context);
      
      expect(result.visible).toBe(true);
      expect(result.enabled).toBe(true);
    });

    test('should hide when record.isActive equals false but is true', () => {
      const config: VisibilityConfig = {
        record: {
          isActive: {
            eq: false
          }
        }
      };

      const result = evaluator.evaluateSync(config, context);
      
      expect(result.visible).toBe(false);
      expect(result.enabled).toBe(false);
    });

    test('should hide when errorCount condition fails', () => {
      const config: VisibilityConfig = {
        record: {
          errorCount: {
            gt: 10
          }
        }
      };

      const result = evaluator.evaluateSync(config, context);
      
      // errorCount is 5, needs > 10
      expect(result.visible).toBe(false);
      expect(result.enabled).toBe(false);
    });

    test('should show when errorCount condition passes', () => {
      const config: VisibilityConfig = {
        record: {
          errorCount: {
            gt: 0
          }
        }
      };

      const result = evaluator.evaluateSync(config, context);
      
      // errorCount is 5, > 0
      expect(result.visible).toBe(true);
      expect(result.enabled).toBe(true);
    });

    test('should show when nested field exists', () => {
      const config: VisibilityConfig = {
        record: {
          'apiCredentials.apiKey': {
            exists: true
          }
        }
      };

      const result = evaluator.evaluateSync(config, context);
      
      expect(result.visible).toBe(true);
      expect(result.enabled).toBe(true);
    });

    test('should hide when nested field does not exist', () => {
      const contextNoApiKey: EvaluationContext = {
        actor: {},
        record: {
          isActive: true
        }
      };

      const config: VisibilityConfig = {
        record: {
          'apiCredentials.apiKey': {
            exists: true
          }
        }
      };

      const result = evaluator.evaluateSync(config, contextNoApiKey);
      
      expect(result.visible).toBe(false);
      expect(result.enabled).toBe(false);
    });
  });

  describe('Pure Role Conditions', () => {
    const adminContext: EvaluationContext = {
      actor: {
        cognito: {
          groups: ['admin']
        }
      }
    };

    const userContext: EvaluationContext = {
      actor: {
        cognito: {
          groups: ['user']
        }
      }
    };

    test('should show and enable when user has required role', () => {
      const config: VisibilityConfig = {
        requiredRoles: ['admin']
      };

      const result = evaluator.evaluateSync(config, adminContext);
      
      expect(result.visible).toBe(true);
      expect(result.enabled).toBe(true);
    });

    test('should show but disable when user lacks required role', () => {
      const config: VisibilityConfig = {
        requiredRoles: ['admin']
      };

      const result = evaluator.evaluateSync(config, userContext);
      
      expect(result.visible).toBe(true);
      expect(result.enabled).toBe(false);
    });

    test('should show but disable when user has excluded role', () => {
      const config: VisibilityConfig = {
        excludedRoles: ['user']
      };

      const result = evaluator.evaluateSync(config, userContext);
      
      expect(result.visible).toBe(true);
      expect(result.enabled).toBe(false);
    });
  });

  describe('Team Integration Config Real Scenarios', () => {
    describe('Active Integration (isActive=true, errorCount=0)', () => {
      const context: EvaluationContext = {
        actor: {
          cognito: {
            groups: ['admin']
          }
        },
        record: {
          isActive: true,
          gamesState: {
            errorCount: 0
          }
        }
      };

      test('Reset Errors - should HIDE (errorCount = 0)', () => {
        const config: VisibilityConfig = {
          record: {
            'gamesState.errorCount': {
              gt: 0
            }
          }
        };

        const result = evaluator.evaluateSync(config, context);
        expect(result.visible).toBe(false);
      });

      test('Pause Integration - should SHOW (isActive = true)', () => {
        const config: VisibilityConfig = {
          record: {
            isActive: {
              eq: true
            }
          }
        };

        const result = evaluator.evaluateSync(config, context);
        expect(result.visible).toBe(true);
        expect(result.enabled).toBe(true);
      });

      test('Resume Integration - should HIDE (isActive = true, needs false)', () => {
        const config: VisibilityConfig = {
          record: {
            isActive: {
              eq: false
            }
          }
        };

        const result = evaluator.evaluateSync(config, context);
        expect(result.visible).toBe(false);
      });

      test('Force Resume (Admin) - should HIDE (isActive = true AND errorCount = 0)', () => {
        const config: VisibilityConfig = {
          requiredRoles: ['admin'],
          record: {
            isActive: {
              eq: false
            },
            'gamesState.errorCount': {
              gt: 10
            }
          }
        };

        const result = evaluator.evaluateSync(config, context);
        expect(result.visible).toBe(false);
      });

      test('View API Logs - should HIDE (no apiKey)', () => {
        const config: VisibilityConfig = {
          record: {
            isActive: {
              eq: true
            },
            'apiCredentials.apiKey': {
              exists: true
            }
          }
        };

        const result = evaluator.evaluateSync(config, context);
        expect(result.visible).toBe(false);
      });
    });

    describe('Paused Integration with High Errors (isActive=false, errorCount=15)', () => {
      const context: EvaluationContext = {
        actor: {
          cognito: {
            groups: ['admin']
          }
        },
        record: {
          isActive: false,
          gamesState: {
            errorCount: 15
          }
        }
      };

      test('Reset Errors - should SHOW (errorCount > 0)', () => {
        const config: VisibilityConfig = {
          record: {
            'gamesState.errorCount': {
              gt: 0
            }
          }
        };

        const result = evaluator.evaluateSync(config, context);
        expect(result.visible).toBe(true);
        expect(result.enabled).toBe(true);
      });

      test('Pause Integration - should HIDE (isActive = false)', () => {
        const config: VisibilityConfig = {
          record: {
            isActive: {
              eq: true
            }
          }
        };

        const result = evaluator.evaluateSync(config, context);
        expect(result.visible).toBe(false);
      });

      test('Resume Integration - should SHOW (isActive = false)', () => {
        const config: VisibilityConfig = {
          record: {
            isActive: {
              eq: false
            }
          }
        };

        const result = evaluator.evaluateSync(config, context);
        expect(result.visible).toBe(true);
        expect(result.enabled).toBe(true);
      });

      test('Force Resume (Admin) - should SHOW and ENABLE (admin + isActive=false + errorCount>10)', () => {
        const config: VisibilityConfig = {
          requiredRoles: ['admin'],
          record: {
            isActive: {
              eq: false
            },
            'gamesState.errorCount': {
              gt: 10
            }
          }
        };

        const result = evaluator.evaluateSync(config, context);
        expect(result.visible).toBe(true);
        expect(result.enabled).toBe(true);
      });
    });

    describe('Paused Integration with Low Errors (isActive=false, errorCount=5)', () => {
      const context: EvaluationContext = {
        actor: {
          cognito: {
            groups: ['admin']
          }
        },
        record: {
          isActive: false,
          gamesState: {
            errorCount: 5
          }
        }
      };

      test('Force Resume (Admin) - should HIDE (errorCount=5, needs >10)', () => {
        const config: VisibilityConfig = {
          requiredRoles: ['admin'],
          record: {
            isActive: {
              eq: false
            },
            'gamesState.errorCount': {
              gt: 10
            }
          }
        };

        const result = evaluator.evaluateSync(config, context);
        expect(result.visible).toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    test('should show when no conditions provided', () => {
      const config: VisibilityConfig = {};
      const context: EvaluationContext = {
        actor: {}
      };

      const result = evaluator.evaluateSync(config, context);
      
      expect(result.visible).toBe(true);
      expect(result.enabled).toBe(true);
    });

    test('should handle missing actor.cognito.groups gracefully', () => {
      const config: VisibilityConfig = {
        requiredRoles: ['admin']
      };
      const context: EvaluationContext = {
        actor: {}
      };

      const result = evaluator.evaluateSync(config, context);
      
      expect(result.visible).toBe(true);
      expect(result.enabled).toBe(false);
    });

    test('should handle missing record gracefully', () => {
      const config: VisibilityConfig = {
        record: {
          isActive: {
            eq: true
          }
        }
      };
      const context: EvaluationContext = {
        actor: {}
      };

      const result = evaluator.evaluateSync(config, context);
      
      expect(result.visible).toBe(false);
      expect(result.enabled).toBe(false);
    });
  });
});

