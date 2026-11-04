import { describe, expect, test } from 'bun:test';
import { PLAN_LIMITS as SERVER_PLAN_LIMITS } from '../../../functions/import-tree/src/plans.js';
import { planDetails, planName, PLAN_LIMITS } from './plan';

describe('plan name', () => {
  test('uses the highest assigned plan', () => {
    expect(planName(['planfree', 'planteam', 'planpro'])).toBe('Team');
    expect(planName(['planfree', 'planpro'])).toBe('Pro');
  });

  test('defaults to free without a plan label', () => {
    expect(planName([])).toBe('Free');
    expect(planName(['other'])).toBe('Free');
  });
});

describe('plan details', () => {
  test('lists the limits of the assigned plan', () => {
    expect(planDetails(PLAN_LIMITS.team)).toEqual([
      { label: 'Owned workspaces', value: '20' },
      { label: 'Members per workspace', value: '30' },
      { label: 'Tasks per workspace', value: '20000' },
      { label: 'Active milestones per workspace', value: '100' },
      { label: 'Tree imports', value: '50 per month' },
      { label: 'Rows per import', value: '10000' }
    ]);
  });

  test('describes the free import allowance as total', () => {
    expect(planDetails(PLAN_LIMITS.free)).toContainEqual({
      label: 'Tree imports',
      value: '1 total'
    });
  });

  test('matches the limits enforced by the server', () => {
    expect(PLAN_LIMITS).toEqual(SERVER_PLAN_LIMITS);
  });
});
