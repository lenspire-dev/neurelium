export const CATEGORY_COLOR_KEYS = [
  'amber',
  'lime',
  'emerald',
  'teal',
  'sky',
  'indigo',
  'violet',
  'pink'
] as const;

export type CategoryColor = (typeof CATEGORY_COLOR_KEYS)[number];

export function isCategoryColor(value: unknown): value is CategoryColor {
  return (
    typeof value === 'string' &&
    (CATEGORY_COLOR_KEYS as readonly string[]).includes(value)
  );
}
