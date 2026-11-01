import { describe, expect, test } from 'bun:test';
import { resolveTheme } from './theme';

describe('resolveTheme', () => {
  test('uses explicit modes as-is', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  test('follows the system preference in system mode', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
