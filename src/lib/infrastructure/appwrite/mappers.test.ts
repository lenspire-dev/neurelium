import { describe, expect, test } from 'bun:test';
import type { ActivityEvent } from '../../domain/models/activity';
import type { Milestone } from '../../domain/models/analytics';
import type { ActivityLog } from '../../domain/models/execution';
import type { Category, Task, Topic } from '../../domain/models/hierarchy';
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
import { APPWRITE_SCHEMA } from './schema';

const workspaceId = asWorkspaceId('workspace-a');
const createdAt = '2026-10-30T12:00:00.000Z';

function row(id: string, data: Record<string, unknown>): StoredRow {
  return {
    $id: id,
    $sequence: '1',
    $tableId: 'table',
    $databaseId: 'test',
    $createdAt: createdAt,
    $updatedAt: createdAt,
    $permissions: [],
    ...data
  };
}

describe('row mappers', () => {
  test('round-trips a workspace', () => {
    const workspace: Workspace = {
      id: workspaceId,
      name: 'Study',
      ownerId: asUserId('user-a'),
      createdAt,
      updatedAt: createdAt
    };
    expect(rowToWorkspace(row(workspace.id, workspaceToData(workspace)))).toEqual(
      workspace
    );
  });

  test('round-trips root and child categories', () => {
    const root: Category = {
      id: asCategoryId('category-a'),
      workspaceId,
      parentId: null,
      name: 'Math',
      icon: '📐',
      color: 'teal',
      importanceWeight: 5,
      createdAt,
      updatedAt: createdAt
    };
    const child: Category = { ...root, parentId: root.id };

    expect(rowToCategory(row(root.id, categoryToData(root)))).toEqual(root);
    expect(rowToCategory(row(child.id, categoryToData(child)))).toEqual(child);
  });

  test('round-trips topics, tasks, and weekly pool entries', () => {
    const topic: Topic = {
      id: asTopicId('topic-a'),
      workspaceId,
      categoryId: asCategoryId('category-a'),
      name: 'Algebra',
      createdAt,
      updatedAt: createdAt
    };
    const task: Task = {
      id: asTaskId('task-a'),
      workspaceId,
      topicId: topic.id,
      title: 'Solve exercises',
      icon: '🧮',
      taskWeight: 3,
      status: 'todo',
      statusChangedAt: null,
      doneDate: null,
      createdAt,
      updatedAt: createdAt
    };
    const entry: WeeklyPoolEntry = {
      id: asWeeklyPoolEntryId('entry-a'),
      workspaceId,
      taskId: task.id,
      weekStart: '2026-10-26',
      plannedDate: '2026-10-28',
      createdAt
    };

    expect(rowToTopic(row(topic.id, topicToData(topic)))).toEqual(topic);
    expect(rowToTask(row(task.id, taskToData(task)))).toEqual(task);
    expect(
      rowToWeeklyPoolEntry(row(entry.id, weeklyPoolEntryToData(entry)))
    ).toEqual(entry);
  });

  test('round-trips an activity log with and without a note', () => {
    const log: ActivityLog = {
      id: asActivityLogId('log-a'),
      workspaceId,
      taskId: asTaskId('task-a'),
      completedDate: '2026-10-30',
      note: null,
      createdAt
    };
    const noted: ActivityLog = { ...log, note: 'finished chapter 3' };

    expect(rowToActivityLog(row(log.id, activityLogToData(log)))).toEqual(log);
    expect(rowToActivityLog(row(noted.id, activityLogToData(noted)))).toEqual(noted);
  });

  test('round-trips an activity event with snapshots', () => {
    const event: ActivityEvent = {
      id: asActivityEventId('event-a'),
      workspaceId,
      actorId: asUserId('user-a'),
      actorName: 'Ada',
      action: 'moved',
      entityType: 'task',
      entityId: 'task-a',
      entityName: 'Solve exercises',
      contextName: 'Math · Algebra',
      detail: 'Week of 2026-11-02',
      createdAt
    };

    expect(rowToActivityEvent(row(event.id, activityEventToData(event)))).toEqual(event);
  });

  test('rejects unknown activity actions instead of guessing', () => {
    expect(() =>
      rowToActivityEvent(
        row('event-a', {
          workspaceId,
          actorId: 'user-a',
          actorName: 'Ada',
          action: 'exploded',
          entityType: 'task',
          entityId: 'task-a',
          entityName: 'Task',
          createdAt
        })
      )
    ).toThrow('unknown activity action');
  });

  test('round-trips both milestone scopes', () => {
    const base: Milestone = {
      id: asMilestoneId('milestone-a'),
      workspaceId,
      title: 'Finish Math',
      scope: { kind: 'category', categoryId: asCategoryId('category-a') },
      targetPercentage: 80,
      dueDate: '2026-12-31',
      createdAt,
      updatedAt: createdAt
    };
    const topicScoped: Milestone = {
      ...base,
      scope: { kind: 'topic', topicId: asTopicId('topic-a') }
    };

    expect(rowToMilestone(row(base.id, milestoneToData(base)))).toEqual(base);
    expect(
      rowToMilestone(row(topicScoped.id, milestoneToData(topicScoped)))
    ).toEqual(topicScoped);
  });

  test('rejects unknown milestone scopes instead of guessing', () => {
    expect(() =>
      rowToMilestone(
        row('milestone-a', {
          workspaceId,
          title: 'Bad',
          scopeKind: 'workspace',
          scopeId: 'other',
          targetPercentage: 50,
          dueDate: '2026-12-31',
          createdAt,
          updatedAt: createdAt
        })
      )
    ).toThrow('unknown milestone scope');
  });
});

describe('Appwrite schema', () => {
  test('uses unique table and column keys with workspace scoping', () => {
    const tableIds = APPWRITE_SCHEMA.map((table) => table.id);
    expect(new Set(tableIds).size).toBe(tableIds.length);

    for (const table of APPWRITE_SCHEMA) {
      const keys = table.columns.map((column) => column.key);
      expect(new Set(keys).size).toBe(keys.length);
      if (table.id !== 'workspaces') expect(keys).toContain('workspaceId');
    }
  });

  test('creates indexes only on existing columns', () => {
    for (const table of APPWRITE_SCHEMA) {
      const keys = new Set(table.columns.map((column) => column.key));
      for (const index of table.indexes) {
        for (const attribute of index.attributes) expect(keys.has(attribute)).toBe(true);
      }
    }
  });
});
