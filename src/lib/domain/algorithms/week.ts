import type { IsoDate, WeekStart } from '../models/common';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isIsoDate(value: string): value is IsoDate {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && toIsoDate(parsed) === value;
}

export function parseIsoDate(value: IsoDate): Date {
  if (!isIsoDate(value)) throw new RangeError(`Invalid ISO date: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

export function toIsoDate(date: Date): IsoDate {
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date');
  return date.toISOString().slice(0, 10);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

/** Monday-based week start. */
export function startOfWeek(value: IsoDate): WeekStart {
  const date = parseIsoDate(value);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return toIsoDate(date);
}

export function isWeekStart(value: IsoDate): boolean {
  return isIsoDate(value) && startOfWeek(value) === value;
}

export function endOfWeek(weekStart: WeekStart): IsoDate {
  return addDays(weekStart, 6);
}

export function nextWeekStart(weekStart: WeekStart): WeekStart {
  return addDays(weekStart, 7);
}

export function previousWeekStart(weekStart: WeekStart): WeekStart {
  return addDays(weekStart, -7);
}

export function isWithinDateRange(value: IsoDate, from: IsoDate, to: IsoDate): boolean {
  return value >= from && value <= to;
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / MS_PER_DAY);
}

export function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}
