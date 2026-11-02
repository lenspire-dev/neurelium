import { describe, expect, test } from 'bun:test';
import type { ActivityLog } from '../models/execution';
import type { Category, Task, Topic } from '../models/hierarchy';
import {
  asActivityLogId,
  asCategoryId,
  asTaskId,
  asTopicId,
  asWeeklyPoolEntryId,
  asWorkspaceId,
} from '../models/identifiers';
import type { WeeklyPoolEntry } from '../models/planning';
import {
  recommendStudyTasks,
  type RecommendationContext,
} from './recommendation';

const workspaceId = asWorkspaceId('workspace');
const createdAt = '2026-10-01T00:00:00.000Z';
const weekStart = '2026-10-26';
const today = '2026-10-28';

function category(
  id: string,
  importanceWeight: number,
  parentId: string | null = null
): Category {
  return {
    id: asCategoryId(id),
    workspaceId,
    parentId: parentId === null ? null : asCategoryId(parentId),
    name: id,
    icon: null,
    color: null,
    importanceWeight,
    createdAt,
    updatedAt: createdAt,
  };
}

function topic(id: string, categoryId: string): Topic {
  return {
    id: asTopicId(id),
    workspaceId,
    categoryId: asCategoryId(categoryId),
    name: id,
    createdAt,
    updatedAt: createdAt,
  };
}

function task(id: string, topicId: string, taskWeight: number): Task {
  return {
    id: asTaskId(id),
    workspaceId,
    topicId: asTopicId(topicId),
    title: id,
    icon: null,
    taskWeight,
    status: 'todo',
    statusChangedAt: null,
    doneDate: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function entry(id: string, taskId: string, entryWeek = weekStart): WeeklyPoolEntry {
  return {
    id: asWeeklyPoolEntryId(id),
    workspaceId,
    taskId: asTaskId(taskId),
    weekStart: entryWeek,
    plannedDate: null,
    status: 'todo',
    completedDate: null,
    createdAt,
  };
}

function log(id: string, taskId: string, completedDate: string): ActivityLog {
  return {
    id: asActivityLogId(id),
    workspaceId,
    taskId: asTaskId(taskId),
    entryId: null,
    completedDate,
    note: null,
    taskName: null,
    topicName: null,
    categoryName: null,
    createdAt,
  };
}

function context(overrides: Partial<RecommendationContext> = {}): RecommendationContext {
  return {
    weekStart,
    today,
    poolEntries: [],
    tasks: [],
    topics: [],
    categories: [],
    activityLogs: [],
    ...overrides,
  };
}

describe('recommendStudyTasks', () => {
  test('returns no recommendation for an empty pool', () => {
    const result = recommendStudyTasks(context());

    expect(result.primary).toBeNull();
    expect(result.alternatives).toEqual([]);
  });

  test('with no activity, prefers the more important category', () => {
    const result = recommendStudyTasks(
      context({
        categories: [category('Math', 3), category('Physics', 8)],
        topics: [topic('math-topic', 'Math'), topic('physics-topic', 'Physics')],
        tasks: [
          task('math-task', 'math-topic', 5),
          task('physics-task', 'physics-topic', 5),
        ],
        poolEntries: [
          entry('entry-math', 'math-task'),
          entry('entry-physics', 'physics-task'),
        ],
      })
    );

    expect(result.primary?.task.id).toBe(asTaskId('physics-task'));
    expect(result.primary?.explanation).toContain('no tasks have been completed this week yet');
    expect(result.primary?.explanation).toContain('Physics has high importance');
  });

  test('lowers a heavily completed category and raises a neglected one', () => {
    const result = recommendStudyTasks(
      context({
        categories: [category('Math', 4), category('Physics', 8)],
        topics: [topic('math-topic', 'Math'), topic('physics-topic', 'Physics')],
        tasks: [
          task('math-done', 'math-topic', 20),
          task('math-remaining', 'math-topic', 5),
          task('physics-remaining', 'physics-topic', 5),
        ],
        poolEntries: [
          entry('entry-math-done', 'math-done'),
          entry('entry-math-remaining', 'math-remaining'),
          entry('entry-physics', 'physics-remaining'),
        ],
        activityLogs: [log('log-math', 'math-done', '2026-10-27')],
      })
    );

    expect(result.primary?.task.id).toBe(asTaskId('physics-remaining'));
    expect(result.primary?.explanation).toContain('focused heavily on Math this week (20 weight)');
    expect(result.primary?.explanation).toContain('Physics has high importance');
    expect(result.primary?.explanation).toContain('zero activity');
  });

  test('ignores activity before the week and after today', () => {
    const base = context({
      categories: [category('Math', 5), category('Physics', 5)],
      topics: [topic('math-topic', 'Math'), topic('physics-topic', 'Physics')],
      tasks: [
        task('math-task', 'math-topic', 8),
        task('physics-task', 'physics-topic', 5),
      ],
      poolEntries: [
        entry('entry-math', 'math-task'),
        entry('entry-physics', 'physics-task'),
      ],
    });
    const baseline = recommendStudyTasks(base);
    const withOutOfRangeLogs = recommendStudyTasks(
      context({
        ...base,
        activityLogs: [
          log('log-before', 'math-task', '2026-10-25'),
          log('log-future', 'math-task', '2026-10-29'),
        ],
      })
    );

    expect(withOutOfRangeLogs.primary?.task.id).toBe(baseline.primary?.task.id);
    expect(withOutOfRangeLogs.primary?.score).toBe(baseline.primary?.score);
  });

  test('excludes tasks already completed in the selected week', () => {
    const result = recommendStudyTasks(
      context({
        categories: [category('Math', 5)],
        topics: [topic('math-topic', 'Math')],
        tasks: [
          task('finished', 'math-topic', 5),
          task('remaining', 'math-topic', 8),
        ],
        poolEntries: [
          entry('entry-finished', 'finished'),
          entry('entry-remaining', 'remaining'),
        ],
        activityLogs: [log('log-finished', 'finished', '2026-10-27')],
      })
    );

    expect(result.primary?.task.id).toBe(asTaskId('remaining'));
    expect(result.alternatives).toEqual([]);
  });

  test('accumulates all activity log weights when measuring focus', () => {
    const result = recommendStudyTasks(
      context({
        categories: [category('Math', 5), category('Physics', 5)],
        topics: [topic('math-topic', 'Math'), topic('physics-topic', 'Physics')],
        tasks: [
          task('math-done-1', 'math-topic', 10),
          task('math-done-2', 'math-topic', 10),
          task('math-remaining', 'math-topic', 5),
          task('physics-remaining', 'physics-topic', 5),
        ],
        poolEntries: [
          entry('entry-math-done-1', 'math-done-1'),
          entry('entry-math-done-2', 'math-done-2'),
          entry('entry-math-remaining', 'math-remaining'),
          entry('entry-physics', 'physics-remaining'),
        ],
        activityLogs: [
          log('log-math-1', 'math-done-1', '2026-10-26'),
          log('log-math-2', 'math-done-2', '2026-10-27'),
        ],
      })
    );

    expect(result.primary?.task.id).toBe(asTaskId('physics-remaining'));
    expect(result.primary?.explanation).toContain('(20 weight)');
  });

  test('counts activity for tasks that are no longer in the pool', () => {
    const result = recommendStudyTasks(
      context({
        categories: [category('Math', 5), category('Physics', 5)],
        topics: [topic('math-topic', 'Math'), topic('physics-topic', 'Physics')],
        tasks: [
          task('math-done', 'math-topic', 20),
          task('math-remaining', 'math-topic', 5),
          task('physics-remaining', 'physics-topic', 5),
        ],
        poolEntries: [
          entry('entry-math-remaining', 'math-remaining'),
          entry('entry-physics', 'physics-remaining'),
        ],
        activityLogs: [log('log-math', 'math-done', '2026-10-27')],
      })
    );

    expect(result.primary?.task.id).toBe(asTaskId('physics-remaining'));
  });

  test('favours a category with more remaining weight', () => {
    const result = recommendStudyTasks(
      context({
        categories: [category('A', 5), category('B', 5)],
        topics: [topic('a-topic', 'A'), topic('b-topic', 'B')],
        tasks: [
          task('a-task', 'a-topic', 5),
          task('b-task-1', 'b-topic', 5),
          task('b-task-2', 'b-topic', 5),
        ],
        poolEntries: [
          entry('entry-a', 'a-task'),
          entry('entry-b-1', 'b-task-1'),
          entry('entry-b-2', 'b-task-2'),
        ],
      })
    );

    expect(result.primary?.category.id).toBe(asCategoryId('B'));
  });

  test('favours heavier tasks within the same category', () => {
    const result = recommendStudyTasks(
      context({
        categories: [category('Math', 5)],
        topics: [topic('math-topic', 'Math')],
        tasks: [
          task('light', 'math-topic', 3),
          task('heavy', 'math-topic', 9),
        ],
        poolEntries: [entry('entry-light', 'light'), entry('entry-heavy', 'heavy')],
      })
    );

    expect(result.primary?.task.id).toBe(asTaskId('heavy'));
  });

  test('breaks equal scores deterministically by task id', () => {
    const result = recommendStudyTasks(
      context({
        categories: [category('Math', 5)],
        topics: [topic('math-topic', 'Math')],
        tasks: [
          task('task-b', 'math-topic', 5),
          task('task-a', 'math-topic', 5),
        ],
        poolEntries: [entry('entry-b', 'task-b'), entry('entry-a', 'task-a')],
      })
    );

    expect(result.primary?.task.id).toBe(asTaskId('task-a'));
  });

  test('respects the result limit', () => {
    const full = context({
      categories: [category('A', 5), category('B', 5), category('C', 5)],
      topics: [topic('a-topic', 'A'), topic('b-topic', 'B'), topic('c-topic', 'C')],
      tasks: [
        task('a-task', 'a-topic', 5),
        task('b-task', 'b-topic', 4),
        task('c-task', 'c-topic', 3),
      ],
      poolEntries: [
        entry('entry-a', 'a-task'),
        entry('entry-b', 'b-task'),
        entry('entry-c', 'c-task'),
      ],
    });

    const two = recommendStudyTasks(full, 2);
    expect(two.primary).not.toBeNull();
    expect(two.alternatives).toHaveLength(1);

    const one = recommendStudyTasks(full, 1);
    expect(one.primary).not.toBeNull();
    expect(one.alternatives).toEqual([]);

    expect(recommendStudyTasks(full, 0).primary).toBeNull();
  });

  test('ignores pool entries from other weeks', () => {
    const result = recommendStudyTasks(
      context({
        categories: [category('Math', 5)],
        topics: [topic('math-topic', 'Math')],
        tasks: [task('math-task', 'math-topic', 5)],
        poolEntries: [entry('entry-next-week', 'math-task', '2026-11-02')],
      })
    );

    expect(result.primary).toBeNull();
  });

  test('deduplicates the same task in the pool', () => {
    const result = recommendStudyTasks(
      context({
        categories: [category('Math', 5)],
        topics: [topic('math-topic', 'Math')],
        tasks: [task('math-task', 'math-topic', 5)],
        poolEntries: [
          entry('entry-1', 'math-task'),
          entry('entry-2', 'math-task'),
        ],
      })
    );

    expect(result.primary?.task.id).toBe(asTaskId('math-task'));
    expect(result.alternatives).toEqual([]);
  });

  test('skips tasks with missing topic or category references', () => {
    const result = recommendStudyTasks(
      context({
        categories: [],
        topics: [],
        tasks: [task('orphan', 'missing-topic', 5)],
        poolEntries: [entry('entry-orphan', 'orphan')],
      })
    );

    expect(result.primary).toBeNull();
  });

  test('explains when the recommended category already received focus', () => {
    const result = recommendStudyTasks(
      context({
        categories: [category('Physics', 5)],
        topics: [topic('physics-topic', 'Physics')],
        tasks: [
          task('physics-done', 'physics-topic', 5),
          task('physics-remaining', 'physics-topic', 5),
        ],
        poolEntries: [
          entry('entry-physics-done', 'physics-done'),
          entry('entry-physics-remaining', 'physics-remaining'),
        ],
        activityLogs: [log('log-physics', 'physics-done', '2026-10-27')],
      })
    );

    expect(result.primary?.explanation).toContain('Physics has moderate importance');
    expect(result.primary?.explanation).toContain('5 weight remaining this week');
    expect(result.primary?.explanation).toContain('(5 completed)');
  });
});
