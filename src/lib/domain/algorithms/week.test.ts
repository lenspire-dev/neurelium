import { describe, expect, test } from 'bun:test';
import {
  addDays,
  clampPercentage,
  daysBetween,
  endOfWeek,
  isIsoDate,
  isWeekStart,
  isWithinDateRange,
  nextWeekStart,
  previousWeekStart,
  startOfWeek,
} from './week';

describe('week utilities', () => {
  test('validates real calendar dates', () => {
    expect(isIsoDate('2026-10-30')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2024-02-30')).toBe(false);
    expect(isIsoDate('2026-1-01')).toBe(false);
  });

  test('starts weeks on Monday', () => {
    expect(startOfWeek('2026-10-26')).toBe('2026-10-26');
    expect(startOfWeek('2026-10-30')).toBe('2026-10-26');
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26');
  });

  test('recognises Monday as a week start', () => {
    expect(isWeekStart('2026-10-26')).toBe(true);
    expect(isWeekStart('2026-10-30')).toBe(false);
  });

  test('calculates week boundaries and adjacent weeks', () => {
    expect(endOfWeek('2026-10-26')).toBe('2026-11-01');
    expect(nextWeekStart('2026-10-26')).toBe('2026-11-02');
    expect(previousWeekStart('2026-10-26')).toBe('2026-10-19');
  });

  test('adds days across month boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  test('counts days between dates in both directions', () => {
    expect(daysBetween('2026-10-26', '2026-10-30')).toBe(4);
    expect(daysBetween('2026-10-30', '2026-10-26')).toBe(-4);
    expect(daysBetween('2026-10-26', '2026-10-26')).toBe(0);
  });

  test('checks inclusive date ranges', () => {
    expect(isWithinDateRange('2026-10-26', '2026-10-26', '2026-11-01')).toBe(true);
    expect(isWithinDateRange('2026-11-01', '2026-10-26', '2026-11-01')).toBe(true);
    expect(isWithinDateRange('2026-11-02', '2026-10-26', '2026-11-01')).toBe(false);
  });

  test('clamps percentages to zero through one hundred', () => {
    expect(clampPercentage(-10)).toBe(0);
    expect(clampPercentage(42)).toBe(42);
    expect(clampPercentage(140)).toBe(100);
  });
});
