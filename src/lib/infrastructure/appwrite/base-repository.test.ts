import { describe, expect, test } from 'bun:test';
import { AppwriteException, Permission, Role, type TablesDB } from 'appwrite';
import type { Category } from '../../domain/models/hierarchy';
import {
  asCategoryId,
  asUserId,
  asWorkspaceId
} from '../../domain/models/identifiers';
import { AppwriteRepository } from './base-repository';
import type { CurrentUserIdProvider } from './auth-adapter';
import {
  categoryToData,
  rowToCategory,
  type StoredRow
} from './mappers';

const workspace = asWorkspaceId('workspace-a');
const otherWorkspace = asWorkspaceId('workspace-b');
const user = asUserId('user-a');

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
  savedPermissions: string[] = [];
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

  async upsertRow({
    rowId,
    data,
    permissions
  }: {
    rowId: string;
    data: Record<string, unknown>;
    permissions: string[];
  }): Promise<StoredRow> {
    this.savedData = data;
    this.savedPermissions = permissions;
    const row = { ...categoryRow(rowId, String(data.workspaceId)), ...data } as StoredRow;
    this.rows.set(rowId, row);
    return row;
  }

  async deleteRow({ rowId }: { rowId: string }): Promise<void> {
    this.deleted.push(rowId);
    this.rows.delete(rowId);
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
  const currentUser: CurrentUserIdProvider = {
    async currentUserId() {
      return user;
    }
  };
  const repository = new TestCategoryRepository(
    tables as unknown as TablesDB,
    'test',
    'categories',
    currentUser
  );
  return { tables, repository };
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

  test('saves with owner and team row permissions', async () => {
    const { tables, repository } = setup();

    const saved = await repository.save(category('category-a'));

    expect(saved.id).toBe(asCategoryId('category-a'));
    expect(tables.savedData.workspaceId).toBe(workspace);
    expect(tables.savedPermissions).toEqual([
      Permission.read(Role.user(user)),
      Permission.update(Role.user(user)),
      Permission.delete(Role.user(user)),
      Permission.read(Role.team(workspace)),
      Permission.update(Role.team(workspace, 'owner')),
      Permission.update(Role.team(workspace, 'admin')),
      Permission.update(Role.team(workspace, 'member')),
      Permission.delete(Role.team(workspace, 'owner')),
      Permission.delete(Role.team(workspace, 'admin'))
    ]);
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
