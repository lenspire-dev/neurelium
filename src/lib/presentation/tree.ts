import type { Category } from '#lib/domain/models/hierarchy.js';
import type { CategoryId } from '#lib/domain/models/identifiers.js';

export interface CategoryRow {
  category: Category;
  depth: number;
}

export type CategoryComparator = (a: Category, b: Category) => number;

const byName: CategoryComparator = (a, b) => a.name.localeCompare(b.name);

export function categoryRows(
  categories: readonly Category[],
  parentId: CategoryId | null = null,
  depth = 0,
  compare: CategoryComparator = byName
): CategoryRow[] {
  return categories
    .filter((category) => category.parentId === parentId)
    .sort(compare)
    .flatMap((category) => [
      { category, depth },
      ...categoryRows(categories, category.id, depth + 1, compare)
    ]);
}

export function categoryPath(
  categoryId: CategoryId | null,
  categories: readonly Category[]
): readonly Category[] {
  if (categoryId === null) return [];
  const byId = new Map(categories.map((category) => [category.id, category]));
  const path: Category[] = [];
  const visited = new Set<CategoryId>();
  let current = byId.get(categoryId);

  while (current !== undefined && !visited.has(current.id)) {
    path.unshift(current);
    visited.add(current.id);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }

  return path;
}

export function visibleCategoryRows(
  categories: readonly Category[],
  collapsedIds: ReadonlySet<string>,
  compare: CategoryComparator = byName
): CategoryRow[] {
  const byId = new Map(categories.map((category) => [category.id, category]));

  return categoryRows(categories, null, 0, compare).filter((row) => {
    let parentId = row.category.parentId;
    while (parentId !== null) {
      if (collapsedIds.has(parentId)) return false;
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return true;
  });
}

export function categoryChildIds(categories: readonly Category[]): ReadonlySet<CategoryId> {
  return new Set(
    categories.flatMap((category) => (category.parentId === null ? [] : [category.parentId]))
  );
}


export function categoryDescendantIds(
  categories: readonly Category[],
  categoryId: CategoryId
): ReadonlySet<CategoryId> {
  const children = new Map<CategoryId, CategoryId[]>();
  for (const category of categories) {
    if (category.parentId === null) continue;
    const siblings = children.get(category.parentId) ?? [];
    siblings.push(category.id);
    children.set(category.parentId, siblings);
  }

  const ids = new Set<CategoryId>([categoryId]);
  const stack = [categoryId];
  while (stack.length > 0) {
    for (const childId of children.get(stack.pop()!) ?? []) {
      if (ids.has(childId)) continue;
      ids.add(childId);
      stack.push(childId);
    }
  }
  return ids;
}
