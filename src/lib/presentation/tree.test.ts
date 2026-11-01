import { describe, expect, test } from 'bun:test';
import type { Category } from '#lib/domain/models/hierarchy.js';
import { asCategoryId, asWorkspaceId } from '#lib/domain/models/identifiers.js';
import { categoryChildIds, categoryDescendantIds, categoryPath, categoryRows, visibleCategoryRows } from './tree';

const workspaceId = asWorkspaceId('workspace');

function category(id: string, parentId: string | null = null): Category {
  return {
    id: asCategoryId(id),
    workspaceId,
    parentId: parentId === null ? null : asCategoryId(parentId),
    name: id,
    icon: null,
    color: null,
    importanceWeight: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z'
  };
}

describe('categoryRows', () => {
  test('flattens depth-first and ignores orphans', () => {
    const rows = categoryRows([
      category('Physics'),
      category('Algebra', 'Math'),
      category('Math'),
      category('Linear', 'Algebra'),
      category('Orphan', 'Missing')
    ]);

    expect(rows.map((row) => `${row.depth}:${row.category.name}`)).toEqual([
      '0:Math',
      '1:Algebra',
      '2:Linear',
      '0:Physics'
    ]);
  });
});

describe('categoryPath', () => {
  test('returns root-to-category order', () => {
    const path = categoryPath(asCategoryId('Linear'), [
      category('Math'),
      category('Algebra', 'Math'),
      category('Linear', 'Algebra')
    ]);
    expect(path.map((item) => item.name)).toEqual(['Math', 'Algebra', 'Linear']);
  });
});

describe('visibleCategoryRows', () => {
  test('hides descendants of collapsed categories', () => {
    const rows = visibleCategoryRows(
      [category('Math'), category('Algebra', 'Math'), category('Physics')],
      new Set(['Math'])
    );
    expect(rows.map((row) => row.category.name)).toEqual(['Math', 'Physics']);
  });
});

describe('categoryChildIds', () => {
  test('marks categories that have children', () => {
    const ids = categoryChildIds([category('Math'), category('Algebra', 'Math')]);
    expect([...ids]).toEqual([asCategoryId('Math')]);
  });
});


describe('categoryDescendantIds', () => {
  test('includes the root and every nested category', () => {
    const ids = categoryDescendantIds(
      [category('Math'), category('Algebra', 'Math'), category('Linear', 'Algebra'), category('Physics')],
      asCategoryId('Math')
    );
    expect([...ids]).toEqual([
      asCategoryId('Math'),
      asCategoryId('Algebra'),
      asCategoryId('Linear')
    ]);
  });
});
