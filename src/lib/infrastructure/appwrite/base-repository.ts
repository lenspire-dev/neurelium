import { Permission, Query, Role, type TablesDB } from 'appwrite';
import type { WorkspaceId } from '../../domain/models/identifiers';
import type { CurrentUserIdProvider } from './auth-adapter';
import { isNotFoundError } from './errors';
import type { RowData, StoredRow } from './mappers';

const PAGE_SIZE = 100;

export abstract class AppwriteRepository<TEntity> {
  constructor(
    protected readonly tables: TablesDB,
    protected readonly databaseId: string,
    protected readonly tableId: string,
    private readonly currentUser: CurrentUserIdProvider
  ) {}

  protected abstract rowId(entity: TEntity): string;
  protected abstract fromRow(row: StoredRow): TEntity;
  protected abstract toData(entity: TEntity): RowData;

  protected async findEntity(
    workspaceId: WorkspaceId,
    entityId: string
  ): Promise<TEntity | null> {
    try {
      const row = await this.tables.getRow<StoredRow>({
        databaseId: this.databaseId,
        tableId: this.tableId,
        rowId: entityId
      });
      return this.belongsTo(row, workspaceId) ? this.fromRow(row) : null;
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  }

  protected async listEntities(
    workspaceId: WorkspaceId,
    filters: readonly string[] = []
  ): Promise<readonly TEntity[]> {
    const rows = await this.listRows(workspaceId, filters);
    return rows.map((row) => this.fromRow(row));
  }

  protected async saveEntity(entity: TEntity): Promise<TEntity> {
    const userId = await this.currentUser.currentUserId();
    const row = await this.tables.upsertRow<StoredRow>({
      databaseId: this.databaseId,
      tableId: this.tableId,
      rowId: this.rowId(entity),
      data: this.toData(entity),
      permissions: workspacePermissions(userId, workspaceOf(entity))
    });
    return this.fromRow(row);
  }

  protected async deleteEntity(
    workspaceId: WorkspaceId,
    entityId: string
  ): Promise<void> {
    const existing = await this.findEntity(workspaceId, entityId);
    if (existing === null) return;

    try {
      await this.tables.deleteRow({
        databaseId: this.databaseId,
        tableId: this.tableId,
        rowId: entityId
      });
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }
  }

  private async listRows(
    workspaceId: WorkspaceId,
    filters: readonly string[]
  ): Promise<readonly StoredRow[]> {
    const rows: StoredRow[] = [];
    let offset = 0;

    while (true) {
      const page = await this.tables.listRows<StoredRow>({
        databaseId: this.databaseId,
        tableId: this.tableId,
        queries: [
          Query.equal('workspaceId', workspaceId),
          ...filters,
          Query.orderAsc('$id'),
          Query.limit(PAGE_SIZE),
          Query.offset(offset)
        ]
      });

      rows.push(...page.rows);
      if (page.rows.length < PAGE_SIZE) return rows;
      offset += PAGE_SIZE;
    }
  }

  private belongsTo(row: StoredRow, workspaceId: string): boolean {
    return row.workspaceId === workspaceId;
  }
}

export function workspaceOf(entity: unknown): string {
  if (
    typeof entity === 'object' &&
    entity !== null &&
    'workspaceId' in entity &&
    typeof entity.workspaceId === 'string'
  ) {
    return entity.workspaceId;
  }
  return '';
}

export function ownerPermissions(userId: string): string[] {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId))
  ];
}

export function workspaceRowPermissions(userId: string, workspaceId: string): string[] {
  return [
    ...ownerPermissions(userId),
    Permission.read(Role.team(workspaceId)),
    Permission.update(Role.team(workspaceId, 'owner')),
    Permission.update(Role.team(workspaceId, 'admin')),
    Permission.delete(Role.team(workspaceId, 'owner'))
  ];
}

export function workspacePermissions(userId: string, workspaceId: string): string[] {
  if (workspaceId === '') return ownerPermissions(userId);
  return [
    ...ownerPermissions(userId),
    Permission.read(Role.team(workspaceId)),
    ...['owner', 'admin', 'member'].map((role) =>
      Permission.update(Role.team(workspaceId, role))
    ),
    ...['owner', 'admin'].map((role) => Permission.delete(Role.team(workspaceId, role)))
  ];
}
