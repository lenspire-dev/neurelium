import type { Models } from 'appwrite';
import {
  isActivityAction,
  isActivityEntityType,
  type ActivityEvent
} from '../../domain/models/activity';
import type { Milestone } from '../../domain/models/analytics';
import { isCategoryColor, type CategoryColor } from '../../domain/models/category-color';
import type { ActivityLog } from '../../domain/models/execution';
import type { Category, Task, Topic } from '../../domain/models/hierarchy';
import { DEFAULT_TASK_STATUS, isTaskStatus } from '../../domain/models/task-status';
import {
  asActivityEventId,
  asActivityLogId,
  asCategoryId,
  asMilestoneId,
  asTaskId,
  asTopicId,
  asUserId,
  asWeeklyPoolEntryId,
  asWorkspaceId
} from '../../domain/models/identifiers';
import type { WeeklyPoolEntry } from '../../domain/models/planning';
import type { Workspace } from '../../domain/models/workspace';
import { normalizeWeightGrade } from '../../domain/models/weight';

export type StoredRow = Models.Row & Record<string, unknown>;
export type RowData = Record<string, unknown>;

function requiredString(row: StoredRow, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') {
    throw new Error(`Appwrite row ${row.$id} has no string column "${key}".`);
  }
  return value;
}

function nullableString(row: StoredRow, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new Error(`Appwrite row ${row.$id} has a non-string column "${key}".`);
  }
  return value;
}

function nullableCategoryColor(row: StoredRow, key: string): CategoryColor | null {
  const value = nullableString(row, key);
  return isCategoryColor(value) ? value : null;
}

function requiredNumber(row: StoredRow, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Appwrite row ${row.$id} has no finite number column "${key}".`);
  }
  return value;
}

export function rowToWorkspace(row: StoredRow): Workspace {
  return {
    id: asWorkspaceId(row.$id),
    name: requiredString(row, 'name'),
    ownerId: asUserId(requiredString(row, 'ownerId')),
    createdAt: requiredString(row, 'createdAt'),
    updatedAt: requiredString(row, 'updatedAt')
  };
}

export function workspaceToData(workspace: Workspace): RowData {
  return {
    name: workspace.name,
    ownerId: workspace.ownerId,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt
  };
}

export function rowToCategory(row: StoredRow): Category {
  const parentId = nullableString(row, 'parentId');
  return {
    id: asCategoryId(row.$id),
    workspaceId: asWorkspaceId(requiredString(row, 'workspaceId')),
    parentId: parentId === null ? null : asCategoryId(parentId),
    name: requiredString(row, 'name'),
    icon: nullableString(row, 'icon'),
    color: nullableCategoryColor(row, 'color'),
    importanceWeight: normalizeWeightGrade(requiredNumber(row, 'importanceWeight')),
    createdAt: requiredString(row, 'createdAt'),
    updatedAt: requiredString(row, 'updatedAt')
  };
}

export function categoryToData(category: Category): RowData {
  return {
    workspaceId: category.workspaceId,
    parentId: category.parentId,
    name: category.name,
    icon: category.icon,
    color: category.color,
    importanceWeight: category.importanceWeight,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt
  };
}

export function rowToTopic(row: StoredRow): Topic {
  return {
    id: asTopicId(row.$id),
    workspaceId: asWorkspaceId(requiredString(row, 'workspaceId')),
    categoryId: asCategoryId(requiredString(row, 'categoryId')),
    name: requiredString(row, 'name'),
    createdAt: requiredString(row, 'createdAt'),
    updatedAt: requiredString(row, 'updatedAt')
  };
}

export function topicToData(topic: Topic): RowData {
  return {
    workspaceId: topic.workspaceId,
    categoryId: topic.categoryId,
    name: topic.name,
    createdAt: topic.createdAt,
    updatedAt: topic.updatedAt
  };
}

export function rowToTask(row: StoredRow): Task {
  const status = nullableString(row, 'status');
  return {
    id: asTaskId(row.$id),
    workspaceId: asWorkspaceId(requiredString(row, 'workspaceId')),
    topicId: asTopicId(requiredString(row, 'topicId')),
    title: requiredString(row, 'title'),
    icon: nullableString(row, 'icon'),
    taskWeight: normalizeWeightGrade(requiredNumber(row, 'taskWeight')),
    status: isTaskStatus(status) ? status : DEFAULT_TASK_STATUS,
    statusChangedAt: nullableString(row, 'statusChangedAt'),
    doneDate: nullableString(row, 'doneDate'),
    createdAt: requiredString(row, 'createdAt'),
    updatedAt: requiredString(row, 'updatedAt')
  };
}

export function taskToData(task: Task): RowData {
  return {
    workspaceId: task.workspaceId,
    topicId: task.topicId,
    title: task.title,
    icon: task.icon,
    taskWeight: task.taskWeight,
    status: task.status,
    statusChangedAt: task.statusChangedAt,
    doneDate: task.doneDate,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

export function rowToWeeklyPoolEntry(row: StoredRow): WeeklyPoolEntry {
  const status = nullableString(row, 'status');
  return {
    id: asWeeklyPoolEntryId(row.$id),
    workspaceId: asWorkspaceId(requiredString(row, 'workspaceId')),
    taskId: asTaskId(requiredString(row, 'taskId')),
    weekStart: requiredString(row, 'weekStart'),
    plannedDate: nullableString(row, 'plannedDate'),
    status: isTaskStatus(status) ? status : DEFAULT_TASK_STATUS,
    completedDate: nullableString(row, 'completedDate'),
    createdAt: requiredString(row, 'createdAt')
  };
}

export function weeklyPoolEntryToData(entry: WeeklyPoolEntry): RowData {
  return {
    workspaceId: entry.workspaceId,
    taskId: entry.taskId,
    weekStart: entry.weekStart,
    plannedDate: entry.plannedDate,
    status: entry.status,
    completedDate: entry.completedDate,
    createdAt: entry.createdAt
  };
}

export function rowToActivityLog(row: StoredRow): ActivityLog {
  const entryId = nullableString(row, 'entryId');
  return {
    id: asActivityLogId(row.$id),
    workspaceId: asWorkspaceId(requiredString(row, 'workspaceId')),
    taskId: asTaskId(requiredString(row, 'taskId')),
    entryId: entryId === null ? null : asWeeklyPoolEntryId(entryId),
    completedDate: requiredString(row, 'completedDate'),
    note: nullableString(row, 'note'),
    taskName: nullableString(row, 'taskName'),
    topicName: nullableString(row, 'topicName'),
    categoryName: nullableString(row, 'categoryName'),
    createdAt: requiredString(row, 'createdAt')
  };
}

export function activityLogToData(log: ActivityLog): RowData {
  return {
    workspaceId: log.workspaceId,
    taskId: log.taskId,
    entryId: log.entryId,
    completedDate: log.completedDate,
    note: log.note,
    taskName: log.taskName,
    topicName: log.topicName,
    categoryName: log.categoryName,
    createdAt: log.createdAt
  };
}

export function rowToActivityEvent(row: StoredRow): ActivityEvent {
  const action = requiredString(row, 'action');
  const entityType = requiredString(row, 'entityType');
  if (!isActivityAction(action)) {
    throw new Error(`Appwrite row ${row.$id} has an unknown activity action.`);
  }
  if (!isActivityEntityType(entityType)) {
    throw new Error(`Appwrite row ${row.$id} has an unknown activity entity type.`);
  }

  return {
    id: asActivityEventId(row.$id),
    workspaceId: asWorkspaceId(requiredString(row, 'workspaceId')),
    actorId: asUserId(requiredString(row, 'actorId')),
    actorName: requiredString(row, 'actorName'),
    action,
    entityType,
    entityId: requiredString(row, 'entityId'),
    entityName: requiredString(row, 'entityName'),
    contextName: nullableString(row, 'contextName'),
    detail: nullableString(row, 'detail'),
    createdAt: requiredString(row, 'createdAt')
  };
}

export function activityEventToData(event: ActivityEvent): RowData {
  return {
    workspaceId: event.workspaceId,
    actorId: event.actorId,
    actorName: event.actorName,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    entityName: event.entityName,
    contextName: event.contextName,
    detail: event.detail,
    createdAt: event.createdAt
  };
}

export function rowToMilestone(row: StoredRow): Milestone {
  const scopeKind = requiredString(row, 'scopeKind');
  const scopeId = requiredString(row, 'scopeId');

  if (scopeKind !== 'category' && scopeKind !== 'topic') {
    throw new Error(`Appwrite row ${row.$id} has an unknown milestone scope.`);
  }

  return {
    id: asMilestoneId(row.$id),
    workspaceId: asWorkspaceId(requiredString(row, 'workspaceId')),
    title: requiredString(row, 'title'),
    scope:
      scopeKind === 'category'
        ? { kind: 'category', categoryId: asCategoryId(scopeId) }
        : { kind: 'topic', topicId: asTopicId(scopeId) },
    targetPercentage: requiredNumber(row, 'targetPercentage'),
    dueDate: requiredString(row, 'dueDate'),
    createdAt: requiredString(row, 'createdAt'),
    updatedAt: requiredString(row, 'updatedAt')
  };
}

export function milestoneToData(milestone: Milestone): RowData {
  return {
    workspaceId: milestone.workspaceId,
    title: milestone.title,
    scopeKind: milestone.scope.kind,
    scopeId:
      milestone.scope.kind === 'category'
        ? milestone.scope.categoryId
        : milestone.scope.topicId,
    targetPercentage: milestone.targetPercentage,
    dueDate: milestone.dueDate,
    createdAt: milestone.createdAt,
    updatedAt: milestone.updatedAt
  };
}
