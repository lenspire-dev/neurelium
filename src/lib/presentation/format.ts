import { endOfWeek, parseIsoDate } from '#lib/domain/algorithms/week.js';
import type { IsoDate, WeekStart } from '#lib/domain/models/common.js';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC'
});

const longDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC'
});

const weekdayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  timeZone: 'UTC'
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium'
});

export function formatDate(value: IsoDate): string {
  return dateFormatter.format(parseIsoDate(value));
}

export function formatLongDate(value: IsoDate): string {
  return longDateFormatter.format(parseIsoDate(value));
}

export function formatWeekday(value: IsoDate): string {
  return weekdayFormatter.format(parseIsoDate(value));
}

export function formatWeek(weekStart: WeekStart): string {
  return `${formatDate(weekStart)} – ${formatDate(endOfWeek(weekStart))}`;
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}


export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatWeight(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

