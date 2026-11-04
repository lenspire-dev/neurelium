import { describe, expect, test } from 'bun:test';
import { AppwriteException, type TablesDB } from 'appwrite';
import type { Category } from '../../domain/models/hierarchy';
import { asCategoryId, asWorkspaceId } from '../../domain/models/identifiers';
import { AppwriteRepository } from './base-repository';
import {
  categoryToData,
  rowToCategory,
  type StoredRow
} from './mappers';
import type { RowWriter } from './trusted-writer';

const workspace = asWorkspaceId('workspace-a');
const otherWorkspace = asWorkspaceId('workspace-b');

function categoryRow(id: string, workspaceId: string): StoredRow {
  return {
    $id: id,
    $sequence: '1',
    $tableId: 'categories',
    $databaseId: 'test',
    $createdAt: '2026-10-30T00:00:00.000Z',
    $updatedAt: '2026-10-30T00:00:00.000Z',
    $permissions: [],
    workspaceId,
    parentId: null,
    name: 'Math',
    icon: null,
    color: null,
    importanceWeight: 5,
    statusOverride: null,
    createdAt: '2026-10-30T00:00:00.000Z',
    updatedAt: '2026-10-30T00:00:00.000Z'
  };
}

function category(id: string, workspaceId = workspace): Category {
  return {
    id: asCategoryId(id),
    workspaceId,
    parentId: null,
    name: 'Math',
    icon: null,
    color: null,
    importanceWeight: 5,
    statusOverride: null,
    createdAt: '2026-10-30T00:00:00.000Z',
    updatedAt: '2026-10-30T00:00:00.000Z'
  };
}

class FakeTables {
  readonly rows = new Map<string, StoredRow>();
  readonly pages: StoredRow[][] = [];
  readonly deleted: string[] = [];
  savedData: Record<string, unknown> = {};

  async getRow({ rowId }: { rowId: string }): Promise<StoredRow> {
    const row = this.rows.get(rowId);
    if (row === undefined) throw new AppwriteException('Not found', 404);
    return row;
  }

  async listRows(): Promise<{ total: number; rows: StoredRow[] }> {
    const rows = this.pages.shift() ?? [];
    return { total: rows.length, rows };
  }

  async updateRow({
    rowId,
    data
  }: {
    rowId: string;
    data: Record<string, unknown>;
  }): Promise<StoredRow> {
    const existing = this.rows.get(rowId);
    if (existing === undefined) throw new AppwriteException('Not found', 404);
    this.savedData = data;
    const row = { ...existing, ...data } as StoredRow;
    this.rows.set(rowId, row);
    return row;
  }

  async deleteRow({ rowId }: { rowId: string }): Promise<void> {
    this.deleted.push(rowId);
    this.rows.delete(rowId);
  }
}

class FakeWriter implements RowWriter {
  readonly created: StoredRow[] = [];

  async createRow(
    _tableId: string,
    rowId: string,
    data: Record<string, unknown>
  ): Promise<StoredRow> {
    const row = { ...categoryRow(rowId, String(data.workspaceId)), ...data } as StoredRow;
    this.created.push(row);
    return row;
  }
}

class TestCategoryRepository extends AppwriteRepository<Category> {
  protected rowId(entity: Category): string {
    return entity.id;
  }

  protected fromRow(row: StoredRow): Category {
    return rowToCategory(row);
  }

  protected toData(entity: Category): Record<string, unknown> {
    return categoryToData(entity);
  }

  find(workspaceId = workspace, id = 'category-a') {
    return this.findEntity(workspaceId, id);
  }

  list() {
    return this.listEntities(workspace);
  }

  save(entity: Category) {
    return this.saveEntity(entity);
  }

  remove(workspaceId = workspace, id = 'category-a') {
    return this.deleteEntity(workspaceId, id);
  }
}

function setup() {
  const tables = new FakeTables();
  const writer = new FakeWriter();
  const repository = new TestCategoryRepository(
    tables as unknown as TablesDB,
    'test',
    'categories',
    writer
  );
  return { tables, writer, repository };
}

describe('AppwriteRepository', () => {
  test('returns null for missing rows and rows from another workspace', async () => {
    const { tables, repository } = setup();

    expect(await repository.find()).toBeNull();

    tables.rows.set('category-a', categoryRow('category-a', otherWorkspace));
    expect(await repository.find()).toBeNull();
  });

  test('reads a row scoped to the workspace', async () => {
    const { tables, repository } = setup();
    tables.rows.set('category-a', categoryRow('category-a', workspace));

    expect(await repository.find()).toEqual(category('category-a'));
  });

  test('loads every page instead of stopping at the first page', async () => {
    const { tables, repository } = setup();
    tables.pages.push(
      Array.from({ length: 100 }, (_, index) =>
        categoryRow(`category-${index}`, workspace)
      ),
      [categoryRow('category-100', workspace)]
    );

    const result = await repository.list();

    expect(result).toHaveLength(101);
    expect(tables.pages).toHaveLength(0);
  });

  test('updates existing rows directly', async () => {
    const { tables, writer, repository } = setup();
    tables.rows.set('category-a', categoryRow('category-a', workspace));

    const saved = await repository.save(category('category-a'));

    expect(saved.id).toBe(asCategoryId('category-a'));
    expect(tables.savedData.workspaceId).toBe(workspace);
    expect(writer.created).toHaveLength(0);
  });

  test('creates missing rows through the trusted writer', async () => {
    const { writer, repository } = setup();

    const saved = await repository.save(category('category-a'));

    expect(saved.id).toBe(asCategoryId('category-a'));
    expect(writer.created).toHaveLength(1);
    expect(writer.created[0]?.$id).toBe('category-a');
  });

  test('deletes only rows owned by the requested workspace', async () => {
    const { tables, repository } = setup();
    tables.rows.set('category-a', categoryRow('category-a', otherWorkspace));

    await repository.remove();
    expect(tables.deleted).toEqual([]);

    tables.rows.set('category-a', categoryRow('category-a', workspace));
    await repository.remove();
    expect(tables.deleted).toEqual(['category-a']);
  });
});
