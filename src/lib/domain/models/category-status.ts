export const CATEGORY_STATUSES = ['todo', 'in_progress', 'done'] as const;

export type CategoryStatus = (typeof CATEGORY_STATUSES)[number];

export type CategoryOverrideMode = 'any' | 'done_only';

export function isCategoryStatus(value: unknown): value is CategoryStatus {
  return typeof value === 'string' && (CATEGORY_STATUSES as readonly string[]).includes(value);
}
