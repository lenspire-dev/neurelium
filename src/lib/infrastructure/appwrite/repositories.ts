import { Query, type TablesDB } from 'appwrite';
import type { ActivityEvent } from '../../domain/models/activity';
import type { Milestone } from '../../domain/models/analytics';
import type { IsoDate, WeekStart } from '../../domain/models/common';
import type { ActivityLog } from '../../domain/models/execution';
import type { Category, Task, Topic } from '../../domain/models/hierarchy';
import type {
  CategoryId,
  MilestoneId,
  TaskId,
  TopicId,
  UserId,
  WeeklyPoolEntryId,
  WorkspaceId
} from '../../domain/models/identifiers';
import type { WeeklyPoolEntry } from '../../domain/models/planning';
import type { Workspace } from '../../domain/models/workspace';
import type { ActivityEventRepository } from '../../domain/ports/activity-event-repository';
import type { ActivityLogRepository } from '../../domain/ports/activity-log-repository';
import type { CategoryRepository } from '../../domain/ports/category-repository';
import type { MilestoneRepository } from '../../domain/ports/milestone-repository';
import type { TaskRepository } from '../../domain/ports/task-repository';
import type { TopicRepository } from '../../domain/ports/topic-repository';
import type { WeeklyPoolRepository } from '../../domain/ports/weekly-pool-repository';
import type { WorkspaceRepository } from '../../domain/ports/workspace-repository';
import {
  AppwriteRepository,
  workspacePermissions,
  workspaceRowPermissions
} from './base-repository';
import type { CurrentUserIdProvider } from './auth-adapter';
import { isNotFoundError } from './errors';
import {
  activityEventToData,
  activityLogToData,
  categoryToData,
  milestoneToData,
  rowToActivityEvent,
  rowToActivityLog,
  rowToCategory,
  rowToMilestone,
  rowToTask,
  rowToTopic,
  rowToWeeklyPoolEntry,
  rowToWorkspace,
  taskToData,
  topicToData,
  weeklyPoolEntryToData,
  workspaceToData,
  type StoredRow
} from './mappers';
import { APPWRITE_TABLES } from './schema';

const PAGE_SIZE = 100;

export class AppwriteCategoryRepository
  extends AppwriteRepository<Category>
  implements CategoryRepository
{
  constructor(
    tables: TablesDB,
    databaseId: string,
    currentUser: CurrentUserIdProvider
  ) {
    super(tables, databaseId, APPWRITE_TABLES.categories, currentUser);
  }

  protected rowId(category: Category): string {
    return category.id;
  }

  protected fromRow(row: StoredRow): Category {
    return rowToCategory(row);
  }

  protected toData(category: Category): Record<string, unknown> {
    return categoryToData(category);
  }

  findById(workspaceId: WorkspaceId, categoryId: CategoryId): Promise<Category | null> {
    return this.findEntity(workspaceId, categoryId);
  }

  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Category[]> {
    return this.listEntities(workspaceId);
  }

  listChildren(
    workspaceId: WorkspaceId,
    parentId: CategoryId | null
  ): Promise<readonly Category[]> {
    return this.listEntities(workspaceId, [
      parentId === null ? Query.isNull('parentId') : Query.equal('parentId', parentId)
    ]);
  }

  save(category: Category): Promise<Category> {
    return this.saveEntity(category);
  }

  delete(workspaceId: WorkspaceId, categoryId: CategoryId): Promise<void> {
    return this.deleteEntity(workspaceId, categoryId);
  }
}

export class AppwriteTopicRepository
  extends AppwriteRepository<Topic>
  implements TopicRepository
{
  constructor(
    tables: TablesDB,
    databaseId: string,
    currentUser: CurrentUserIdProvider
  ) {
    super(tables, databaseId, APPWRITE_TABLES.topics, currentUser);
  }

  protected rowId(topic: Topic): string {
    return topic.id;
  }

  protected fromRow(row: StoredRow): Topic {
    return rowToTopic(row);
  }

  protected toData(topic: Topic): Record<string, unknown> {
    return topicToData(topic);
  }

  findById(workspaceId: WorkspaceId, topicId: TopicId): Promise<Topic | null> {
    return this.findEntity(workspaceId, topicId);
  }

  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Topic[]> {
    return this.listEntities(workspaceId);
  }

  listByCategory(
    workspaceId: WorkspaceId,
    categoryId: CategoryId
  ): Promise<readonly Topic[]> {
    return this.listEntities(workspaceId, [Query.equal('categoryId', categoryId)]);
  }

  save(topic: Topic): Promise<Topic> {
    return this.saveEntity(topic);
  }

  delete(workspaceId: WorkspaceId, topicId: TopicId): Promise<void> {
    return this.deleteEntity(workspaceId, topicId);
  }
}

export class AppwriteTaskRepository
  extends AppwriteRepository<Task>
  implements TaskRepository
{
  constructor(
    tables: TablesDB,
    databaseId: string,
    currentUser: CurrentUserIdProvider
  ) {
    super(tables, databaseId, APPWRITE_TABLES.tasks, currentUser);
  }

  protected rowId(task: Task): string {
    return task.id;
  }

  protected fromRow(row: StoredRow): Task {
    return rowToTask(row);
  }

  protected toData(task: Task): Record<string, unknown> {
    return taskToData(task);
  }

  findById(workspaceId: WorkspaceId, taskId: TaskId): Promise<Task | null> {
    return this.findEntity(workspaceId, taskId);
  }

  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Task[]> {
    return this.listEntities(workspaceId);
  }

  listByTopic(workspaceId: WorkspaceId, topicId: TopicId): Promise<readonly Task[]> {
    return this.listEntities(workspaceId, [Query.equal('topicId', topicId)]);
  }

  save(task: Task): Promise<Task> {
    return this.saveEntity(task);
  }

  delete(workspaceId: WorkspaceId, taskId: TaskId): Promise<void> {
    return this.deleteEntity(workspaceId, taskId);
  }
}

export class AppwriteWeeklyPoolRepository
  extends AppwriteRepository<WeeklyPoolEntry>
  implements WeeklyPoolRepository
{
  constructor(
    tables: TablesDB,
    databaseId: string,
    currentUser: CurrentUserIdProvider
  ) {
    super(tables, databaseId, APPWRITE_TABLES.weeklyPoolEntries, currentUser);
  }

  protected rowId(entry: WeeklyPoolEntry): string {
    return entry.id;
  }

  protected fromRow(row: StoredRow): WeeklyPoolEntry {
    return rowToWeeklyPoolEntry(row);
  }

  protected toData(entry: WeeklyPoolEntry): Record<string, unknown> {
    return weeklyPoolEntryToData(entry);
  }

  findById(
    workspaceId: WorkspaceId,
    entryId: WeeklyPoolEntryId
  ): Promise<WeeklyPoolEntry | null> {
    return this.findEntity(workspaceId, entryId);
  }

  listByWeek(
    workspaceId: WorkspaceId,
    weekStart: WeekStart
  ): Promise<readonly WeeklyPoolEntry[]> {
    return this.listEntities(workspaceId, [Query.equal('weekStart', weekStart)]);
  }

  listByTask(
    workspaceId: WorkspaceId,
    taskId: TaskId
  ): Promise<readonly WeeklyPoolEntry[]> {
    return this.listEntities(workspaceId, [Query.equal('taskId', taskId)]);
  }

  save(entry: WeeklyPoolEntry): Promise<WeeklyPoolEntry> {
    return this.saveEntity(entry);
  }

  delete(workspaceId: WorkspaceId, entryId: WeeklyPoolEntryId): Promise<void> {
    return this.deleteEntity(workspaceId, entryId);
  }
}

export class AppwriteActivityLogRepository
  extends AppwriteRepository<ActivityLog>
  implements ActivityLogRepository
{
  constructor(
    tables: TablesDB,
    databaseId: string,
    currentUser: CurrentUserIdProvider
  ) {
    super(tables, databaseId, APPWRITE_TABLES.activityLogs, currentUser);
  }

  protected rowId(log: ActivityLog): string {
    return log.id;
  }

  protected fromRow(row: StoredRow): ActivityLog {
    return rowToActivityLog(row);
  }

  protected toData(log: ActivityLog): Record<string, unknown> {
    return activityLogToData(log);
  }

  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly ActivityLog[]> {
    return this.listEntities(workspaceId);
  }

  listByDateRange(
    workspaceId: WorkspaceId,
    from: IsoDate,
    to: IsoDate
  ): Promise<readonly ActivityLog[]> {
    return this.listEntities(workspaceId, [
      Query.greaterThanEqual('completedDate', from),
      Query.lessThanEqual('completedDate', to)
    ]);
  }

  listByTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<readonly ActivityLog[]> {
    return this.listEntities(workspaceId, [Query.equal('taskId', taskId)]);
  }

  save(log: ActivityLog): Promise<ActivityLog> {
    return this.saveEntity(log);
  }

  delete(workspaceId: WorkspaceId, logId: ActivityLog['id']): Promise<void> {
    return this.deleteEntity(workspaceId, logId);
  }
}

export class AppwriteActivityEventRepository
  extends AppwriteRepository<ActivityEvent>
  implements ActivityEventRepository
{
  constructor(
    tables: TablesDB,
    databaseId: string,
    currentUser: CurrentUserIdProvider
  ) {
    super(tables, databaseId, APPWRITE_TABLES.activityEvents, currentUser);
  }

  protected rowId(event: ActivityEvent): string {
    return event.id;
  }

  protected fromRow(row: StoredRow): ActivityEvent {
    return rowToActivityEvent(row);
  }

  protected toData(event: ActivityEvent): Record<string, unknown> {
    return activityEventToData(event);
  }

  async listByWorkspace(workspaceId: WorkspaceId): Promise<readonly ActivityEvent[]> {
    const events = await this.listEntities(workspaceId);
    return events.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  save(event: ActivityEvent): Promise<ActivityEvent> {
    return this.saveEntity(event);
  }
}

export class AppwriteMilestoneRepository
  extends AppwriteRepository<Milestone>
  implements MilestoneRepository
{
  constructor(
    tables: TablesDB,
    databaseId: string,
    currentUser: CurrentUserIdProvider
  ) {
    super(tables, databaseId, APPWRITE_TABLES.milestones, currentUser);
  }

  protected rowId(milestone: Milestone): string {
    return milestone.id;
  }

  protected fromRow(row: StoredRow): Milestone {
    return rowToMilestone(row);
  }

  protected toData(milestone: Milestone): Record<string, unknown> {
    return milestoneToData(milestone);
  }

  findById(
    workspaceId: WorkspaceId,
    milestoneId: MilestoneId
  ): Promise<Milestone | null> {
    return this.findEntity(workspaceId, milestoneId);
  }

  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Milestone[]> {
    return this.listEntities(workspaceId);
  }

  save(milestone: Milestone): Promise<Milestone> {
    return this.saveEntity(milestone);
  }

  delete(workspaceId: WorkspaceId, milestoneId: MilestoneId): Promise<void> {
    return this.deleteEntity(workspaceId, milestoneId);
  }
}

export class AppwriteWorkspaceRepository implements WorkspaceRepository {
  constructor(
    private readonly tables: TablesDB,
    private readonly databaseId: string,
    private readonly currentUser: CurrentUserIdProvider
  ) {}

  async findById(workspaceId: WorkspaceId): Promise<Workspace | null> {
    try {
      const row = await this.tables.getRow<StoredRow>({
        databaseId: this.databaseId,
        tableId: APPWRITE_TABLES.workspaces,
        rowId: workspaceId
      });
      return rowToWorkspace(row);
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  }

  async listByOwner(ownerId: UserId): Promise<readonly Workspace[]> {
    return this.listRows([Query.equal('ownerId', ownerId)]);
  }

  async listAccessible(): Promise<readonly Workspace[]> {
    return this.listRows([]);
  }

  async save(workspace: Workspace): Promise<Workspace> {
    const userId = await this.currentUser.currentUserId();
    if (workspace.ownerId !== userId) {
      throw new Error('Only the workspace owner can save a workspace.');
    }

    const row = await this.tables.upsertRow<StoredRow>({
      databaseId: this.databaseId,
      tableId: APPWRITE_TABLES.workspaces,
      rowId: workspace.id,
      data: workspaceToData(workspace),
      permissions: workspaceRowPermissions(userId, workspace.id)
    });
    return rowToWorkspace(row);
  }

  async migratePermissions(workspace: Workspace): Promise<void> {
    const userId = await this.currentUser.currentUserId();
    if (workspace.ownerId !== userId) {
      throw new Error('Only the workspace owner can migrate permissions.');
    }
    const permissions = workspacePermissions(userId, workspace.id);
    const tableIds = Object.values(APPWRITE_TABLES).filter(
      (tableId) => tableId !== APPWRITE_TABLES.workspaces
    );

    for (const tableId of tableIds) {
      let offset = 0;
      while (true) {
        let rows: StoredRow[];
        try {
          const page = await this.tables.listRows<StoredRow>({
            databaseId: this.databaseId,
            tableId,
            queries: [
              Query.equal('workspaceId', workspace.id),
              Query.limit(PAGE_SIZE),
              Query.offset(offset)
            ]
          });
          rows = page.rows;
        } catch (error) {
          if (isNotFoundError(error)) break;
          throw error;
        }

        for (const row of rows) {
          await this.tables.updateRow({
            databaseId: this.databaseId,
            tableId,
            rowId: row.$id,
            data: {},
            permissions
          });
        }
        if (rows.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
    }
  }

  async transferOwnership(workspace: Workspace, newOwnerId: UserId): Promise<Workspace> {
    const userId = await this.currentUser.currentUserId();
    if (workspace.ownerId !== userId) {
      throw new Error('Only the workspace owner can transfer ownership.');
    }
    const now = new Date().toISOString();
    const row = await this.tables.updateRow<StoredRow>({
      databaseId: this.databaseId,
      tableId: APPWRITE_TABLES.workspaces,
      rowId: workspace.id,
      data: { ownerId: newOwnerId, updatedAt: now },
      permissions: workspaceRowPermissions(newOwnerId, workspace.id)
    });
    return rowToWorkspace(row);
  }

  async deleteWorkspace(workspace: Workspace): Promise<void> {
    const userId = await this.currentUser.currentUserId();
    if (workspace.ownerId !== userId) {
      throw new Error('Only the workspace owner can delete a workspace.');
    }
    const tableIds = Object.values(APPWRITE_TABLES).filter(
      (tableId) => tableId !== APPWRITE_TABLES.workspaces
    );

    for (const tableId of tableIds) {
      while (true) {
        let rows: StoredRow[];
        try {
          const page = await this.tables.listRows<StoredRow>({
            databaseId: this.databaseId,
            tableId,
            queries: [Query.equal('workspaceId', workspace.id), Query.limit(PAGE_SIZE)]
          });
          rows = page.rows;
        } catch (error) {
          if (isNotFoundError(error)) break;
          throw error;
        }
        if (rows.length === 0) break;

        for (const row of rows) {
          await this.tables.deleteRow({
            databaseId: this.databaseId,
            tableId,
            rowId: row.$id
          });
        }
        if (rows.length < PAGE_SIZE) break;
      }
    }

    await this.tables.deleteRow({
      databaseId: this.databaseId,
      tableId: APPWRITE_TABLES.workspaces,
      rowId: workspace.id
    });
  }

  private async listRows(filters: readonly string[]): Promise<readonly Workspace[]> {
    const rows: Workspace[] = [];
    let offset = 0;

    while (true) {
      const page = await this.tables.listRows<StoredRow>({
        databaseId: this.databaseId,
        tableId: APPWRITE_TABLES.workspaces,
        queries: [
          ...filters,
          Query.orderAsc('$id'),
          Query.limit(PAGE_SIZE),
          Query.offset(offset)
        ]
      });

      rows.push(...page.rows.map(rowToWorkspace));
      if (page.rows.length < PAGE_SIZE) return rows;
      offset += PAGE_SIZE;
    }
  }
}

export function createAppwriteRepositories(
  tables: TablesDB,
  databaseId: string,
  currentUser: CurrentUserIdProvider
) {
  return {
    workspaces: new AppwriteWorkspaceRepository(tables, databaseId, currentUser),
    categories: new AppwriteCategoryRepository(tables, databaseId, currentUser),
    topics: new AppwriteTopicRepository(tables, databaseId, currentUser),
    tasks: new AppwriteTaskRepository(tables, databaseId, currentUser),
    weeklyPool: new AppwriteWeeklyPoolRepository(tables, databaseId, currentUser),
    activityLogs: new AppwriteActivityLogRepository(tables, databaseId, currentUser),
    activityEvents: new AppwriteActivityEventRepository(tables, databaseId, currentUser),
    milestones: new AppwriteMilestoneRepository(tables, databaseId, currentUser)
  } as const;
}
