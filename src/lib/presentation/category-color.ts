import {
  CATEGORY_COLOR_KEYS,
  type CategoryColor
} from '#lib/domain/models/category-color.js';
import type { Category } from '#lib/domain/models/hierarchy.js';
import type { CategoryId } from '#lib/domain/models/identifiers.js';

export interface CategoryColorMeta {
  readonly key: CategoryColor;
  readonly label: string;
  readonly dotClass: string;
  readonly barClass: string;
  readonly borderClass: string;
  readonly softClass: string;
  readonly swatchClass: string;
  readonly ringClass: string;
}

export const CATEGORY_COLOR_META: Record<CategoryColor, CategoryColorMeta> = {
  amber: {
    key: 'amber',
    label: 'Amber',
    dotClass: 'bg-amber-500 dark:bg-amber-400',
    barClass: 'bg-amber-500 dark:bg-amber-400',
    borderClass: 'border-l-amber-500/70 dark:border-l-amber-400/60',
    softClass: 'bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
    swatchClass: 'bg-amber-500',
    ringClass: 'ring-amber-500 dark:ring-amber-400'
  },
  lime: {
    key: 'lime',
    label: 'Lime',
    dotClass: 'bg-lime-500 dark:bg-lime-400',
    barClass: 'bg-lime-500 dark:bg-lime-400',
    borderClass: 'border-l-lime-500/70 dark:border-l-lime-400/60',
    softClass: 'bg-lime-500/15 text-lime-700 dark:bg-lime-400/15 dark:text-lime-300',
    swatchClass: 'bg-lime-500',
    ringClass: 'ring-lime-500 dark:ring-lime-400'
  },
  emerald: {
    key: 'emerald',
    label: 'Emerald',
    dotClass: 'bg-emerald-500 dark:bg-emerald-400',
    barClass: 'bg-emerald-500 dark:bg-emerald-400',
    borderClass: 'border-l-emerald-500/70 dark:border-l-emerald-400/60',
    softClass:
      'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
    swatchClass: 'bg-emerald-500',
    ringClass: 'ring-emerald-500 dark:ring-emerald-400'
  },
  teal: {
    key: 'teal',
    label: 'Teal',
    dotClass: 'bg-teal-500 dark:bg-teal-400',
    barClass: 'bg-teal-500 dark:bg-teal-400',
    borderClass: 'border-l-teal-500/70 dark:border-l-teal-400/60',
    softClass: 'bg-teal-500/15 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300',
    swatchClass: 'bg-teal-500',
    ringClass: 'ring-teal-500 dark:ring-teal-400'
  },
  sky: {
    key: 'sky',
    label: 'Sky',
    dotClass: 'bg-sky-500 dark:bg-sky-400',
    barClass: 'bg-sky-500 dark:bg-sky-400',
    borderClass: 'border-l-sky-500/70 dark:border-l-sky-400/60',
    softClass: 'bg-sky-500/15 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
    swatchClass: 'bg-sky-500',
    ringClass: 'ring-sky-500 dark:ring-sky-400'
  },
  indigo: {
    key: 'indigo',
    label: 'Indigo',
    dotClass: 'bg-indigo-500 dark:bg-indigo-400',
    barClass: 'bg-indigo-500 dark:bg-indigo-400',
    borderClass: 'border-l-indigo-500/70 dark:border-l-indigo-400/60',
    softClass:
      'bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300',
    swatchClass: 'bg-indigo-500',
    ringClass: 'ring-indigo-500 dark:ring-indigo-400'
  },
  violet: {
    key: 'violet',
    label: 'Violet',
    dotClass: 'bg-violet-500 dark:bg-violet-400',
    barClass: 'bg-violet-500 dark:bg-violet-400',
    borderClass: 'border-l-violet-500/70 dark:border-l-violet-400/60',
    softClass:
      'bg-violet-500/15 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
    swatchClass: 'bg-violet-500',
    ringClass: 'ring-violet-500 dark:ring-violet-400'
  },
  pink: {
    key: 'pink',
    label: 'Pink',
    dotClass: 'bg-pink-500 dark:bg-pink-400',
    barClass: 'bg-pink-500 dark:bg-pink-400',
    borderClass: 'border-l-pink-500/70 dark:border-l-pink-400/60',
    softClass: 'bg-pink-500/15 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300',
    swatchClass: 'bg-pink-500',
    ringClass: 'ring-pink-500 dark:ring-pink-400'
  }
};

export function categoryColorMeta(color: CategoryColor): CategoryColorMeta {
  return CATEGORY_COLOR_META[color];
}

export function hashCategoryColor(key: string): CategoryColor {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return CATEGORY_COLOR_KEYS[(hash >>> 0) % CATEGORY_COLOR_KEYS.length]!;
}

export function buildCategoryColorMap(
  categories: readonly Category[]
): ReadonlyMap<CategoryId, CategoryColor> {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const resolved = new Map<CategoryId, CategoryColor>();

  for (const category of categories) {
    if (resolved.has(category.id)) continue;

    const path: Category[] = [];
    const seen = new Set<string>();
    let current: Category | undefined = category;
    let explicit: CategoryColor | null = null;

    while (current !== undefined && !seen.has(current.id)) {
      seen.add(current.id);
      path.push(current);
      if (current.color !== null) {
        explicit = current.color;
        break;
      }
      current = current.parentId === null ? undefined : byId.get(current.parentId);
    }

    const root = path[path.length - 1];
    const color = explicit ?? hashCategoryColor(root?.id ?? category.id);
    for (const item of path) resolved.set(item.id, color);
  }

  return resolved;
}

export function resolveCategoryColor(
  categoryId: CategoryId | null,
  categories: readonly Category[]
): CategoryColor {
  if (categoryId === null) return hashCategoryColor('');
  return (
    buildCategoryColorMap(categories).get(categoryId) ?? hashCategoryColor(categoryId)
  );
}

export function suggestCategoryColor(categories: readonly Category[]): CategoryColor {
  const used = new Set<CategoryColor>();
  for (const category of categories) {
    if (category.parentId === null && category.color !== null) used.add(category.color);
  }
  return CATEGORY_COLOR_KEYS.find((color) => !used.has(color)) ?? CATEGORY_COLOR_KEYS[0];
}
