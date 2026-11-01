import { describe, expect, test } from 'bun:test';
import type { CategoryColor } from '#lib/domain/models/category-color.js';
import type { Category } from '#lib/domain/models/hierarchy.js';
import { asCategoryId, asWorkspaceId } from '#lib/domain/models/identifiers.js';
import {
  CATEGORY_COLOR_META,
  buildCategoryColorMap,
  hashCategoryColor,
  resolveCategoryColor,
  suggestCategoryColor
} from './category-color';

const workspaceId = asWorkspaceId('workspace');

function category(
  id: string,
  parentId: string | null = null,
  color: CategoryColor | null = null
): Category {
  return {
    id: asCategoryId(id),
    workspaceId,
    parentId: parentId === null ? null : asCategoryId(parentId),
    name: id,
    icon: null,
    importanceWeight: 3,
    color,
    createdAt: '',
    updatedAt: ''
  };
}

describe('category colors', () => {
  test('explicit colors are used and children inherit them', () => {
    const root = category('root', null, 'teal');
    const child = category('child', 'root');
    const colors = buildCategoryColorMap([root, child]);

    expect(colors.get(root.id)).toBe('teal');
    expect(colors.get(child.id)).toBe('teal');
  });

  test('a child can override its parent color', () => {
    const root = category('root', null, 'teal');
    const child = category('child', 'root', 'violet');
    const colors = buildCategoryColorMap([root, child]);

    expect(colors.get(root.id)).toBe('teal');
    expect(colors.get(child.id)).toBe('violet');
  });

  test('uncolored categories get a stable fallback from their root id', () => {
    const root = category('root');
    const child = category('child', 'root');
    const colors = buildCategoryColorMap([root, child]);

    expect(colors.get(root.id)).toBe(hashCategoryColor('root'));
    expect(colors.get(child.id)).toBe(hashCategoryColor('root'));
    expect(resolveCategoryColor(root.id, [root, child])).toBe(hashCategoryColor('root'));
  });

  test('cycles do not recurse forever', () => {
    const first = category('first', 'second');
    const second = category('second', 'first');
    const colors = buildCategoryColorMap([first, second]);

    expect(colors.get(first.id)).toBeDefined();
    expect(colors.get(second.id)).toBeDefined();
  });

  test('suggests the first unused root color', () => {
    const categories = [category('one', null, 'amber'), category('two', null, 'lime')];
    expect(suggestCategoryColor(categories)).toBe('emerald');
  });

  test('every palette color has presentation classes', () => {
    for (const meta of Object.values(CATEGORY_COLOR_META)) {
      expect(meta.dotClass.length).toBeGreaterThan(0);
      expect(meta.barClass.length).toBeGreaterThan(0);
      expect(meta.borderClass.length).toBeGreaterThan(0);
      expect(meta.softClass.length).toBeGreaterThan(0);
      expect(meta.swatchClass.length).toBeGreaterThan(0);
      expect(meta.ringClass.length).toBeGreaterThan(0);
    }
  });
});
