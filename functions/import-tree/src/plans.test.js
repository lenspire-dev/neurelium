import { describe, expect, test } from 'bun:test';
import {
  PLAN_LIMITS,
  monthStartIso,
  planName,
  resolvePlan,
  resolveSubscriptionPlan
} from './plans.js';

describe('plan limits', () => {
  test('resolves the highest assigned plan label', () => {
    expect(resolvePlan([])).toBe('free');
    expect(resolvePlan(['planfree'])).toBe('free');
    expect(resolvePlan(['planpro'])).toBe('pro');
    expect(resolvePlan(['planpro', 'planteam'])).toBe('team');
  });

  test('matches the product limits', () => {
    expect(PLAN_LIMITS.free).toEqual({
      ownedWorkspaces: 1,
      membersPerWorkspace: 1,
      tasksPerWorkspace: 500,
      activeMilestonesPerWorkspace: 3,
      treeImports: 1,
      treeImportWindow: 'total',
      maxRowsPerImport: 600
    });
    expect(PLAN_LIMITS.pro.treeImports).toBe(10);
    expect(PLAN_LIMITS.team.tasksPerWorkspace).toBe(20000);
    expect(planName('pro')).toBe('Pro');
  });

  test('resolves the highest active subscription', () => {
    const now = new Date('2026-11-04T00:00:00.000Z');
    expect(
      resolveSubscriptionPlan(
        [
          { plan: 'pro', status: 'active', currentPeriodEnd: '2026-12-01T00:00:00.000Z' },
          { plan: 'team', status: 'trialing', currentPeriodEnd: '2026-12-15T00:00:00.000Z' }
        ],
        now
      )
    ).toEqual({ plan: 'team', expiresAt: '2026-12-15T00:00:00.000Z' });
  });

  test('ignores inactive and expired subscriptions', () => {
    const now = new Date('2026-11-04T00:00:00.000Z');
    expect(
      resolveSubscriptionPlan(
        [
          { plan: 'team', status: 'canceled', currentPeriodEnd: '2026-12-01T00:00:00.000Z' },
          { plan: 'pro', status: 'active', currentPeriodEnd: '2026-11-01T00:00:00.000Z' }
        ],
        now
      )
    ).toEqual({ plan: 'free', expiresAt: null });
  });

  test('uses the UTC month boundary', () => {
    expect(monthStartIso(new Date('2026-11-03T23:59:59.000Z'))).toBe(
      '2026-11-01T00:00:00.000Z'
    );
  });
});
