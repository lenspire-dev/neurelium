import type { Category } from '../models/hierarchy';
import type { CategoryId } from '../models/identifiers';

export function collectCategorySubtreeIds(
  rootId: CategoryId,
  categories: readonly Category[]
): ReadonlySet<CategoryId> {
  const childrenByParent = new Map<CategoryId, CategoryId[]>();
  for (const category of categories) {
    if (category.parentId === null) continue;
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category.id);
    childrenByParent.set(category.parentId, siblings);
  }

  const visited = new Set<CategoryId>();
  const pending: CategoryId[] = [rootId];

  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || visited.has(current)) continue;
    visited.add(current);

    const children = childrenByParent.get(current);
    if (children === undefined) continue;
    for (const child of children) pending.push(child);
  }

  return visited;
}

export function wouldCreateCategoryCycle(
  categoryId: CategoryId,
  newParentId: CategoryId | null,
  categories: readonly Category[]
): boolean {
  if (newParentId === null) return false;
  if (newParentId === categoryId) return true;

  const byId = new Map(categories.map((category) => [category.id, category]));
  const visited = new Set<CategoryId>();
  let current: CategoryId | null = newParentId;

  while (current !== null && !visited.has(current)) {
    if (current === categoryId) return true;
    visited.add(current);
    current = byId.get(current)?.parentId ?? null;
  }

  return false;
}
