import { describe, expect, test } from 'bun:test';
import type { Category } from '../models/hierarchy';
import { asCategoryId, asWorkspaceId } from '../models/identifiers';
import {
  collectCategorySubtreeIds,
  wouldCreateCategoryCycle,
} from './hierarchy';

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
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

describe('category hierarchy', () => {
  test('collects nested descendants and excludes other branches', () => {
    const categories = [
      category('Math'),
      category('Algebra', 'Math'),
      category('Linear', 'Algebra'),
      category('Geometry', 'Math'),
      category('Physics'),
    ];

    const ids = collectCategorySubtreeIds(asCategoryId('Math'), categories);

    expect([...ids].map(String).sort()).toEqual([
      'Algebra',
      'Geometry',
      'Linear',
      'Math',
    ]);
  });

  test('handles a cycle in stored data without looping forever', () => {
    const categories = [
      category('A', 'C'),
      category('B', 'A'),
      category('C', 'B'),
    ];

    const ids = collectCategorySubtreeIds(asCategoryId('A'), categories);

    expect([...ids].map(String).sort()).toEqual(['A', 'B', 'C']);
  });

  test('detects direct and indirect cycles', () => {
    const categories = [
      category('Math'),
      category('Algebra', 'Math'),
      category('Linear', 'Algebra'),
      category('Physics'),
    ];

    expect(
      wouldCreateCategoryCycle(asCategoryId('Math'), asCategoryId('Linear'), categories)
    ).toBe(true);
    expect(
      wouldCreateCategoryCycle(asCategoryId('Math'), asCategoryId('Algebra'), categories)
    ).toBe(true);
    expect(
      wouldCreateCategoryCycle(asCategoryId('Math'), asCategoryId('Math'), categories)
    ).toBe(true);
    expect(
      wouldCreateCategoryCycle(asCategoryId('Math'), asCategoryId('Physics'), categories)
    ).toBe(false);
    expect(wouldCreateCategoryCycle(asCategoryId('Math'), null, categories)).toBe(false);
  });
});
