import { describe, expect, test } from 'bun:test';
import { activityActionLabel, activityEntityLabel } from './activity-event';

describe('activity event labels', () => {
  test('labels known actions', () => {
    expect(activityActionLabel('completed')).toBe('Completed');
    expect(activityActionLabel('member_invited')).toBe('Invited member');
  });

  test('labels entity types', () => {
    expect(activityEntityLabel('weekly_entry')).toBe('week entry');
    expect(activityEntityLabel('completion')).toBe('completion');
  });
});
