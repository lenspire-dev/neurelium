import { describe, expect, test } from 'bun:test';
import {
  PLAN_LIMITS,
  monthStartIso,
  planName,
  resolvePlan
} from './plans.js';

describe('plan limits', () => {
  test('resolves the highest assigned plan label', () => {
    expect(resolvePlan([])).toBe('free');
    expect(resolvePlan(['plan_free'])).toBe('free');
    expect(resolvePlan(['plan_pro'])).toBe('pro');
    expect(resolvePlan(['plan_pro', 'plan_team'])).toBe('team');
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

  test('uses the UTC month boundary', () => {
    expect(monthStartIso(new Date('2026-11-03T23:59:59.000Z'))).toBe(
      '2026-11-01T00:00:00.000Z'
    );
  });
});
