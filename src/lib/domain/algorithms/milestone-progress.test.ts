import { describe, expect, test } from 'bun:test';
import type { Milestone, MilestoneScope } from '../models/analytics';
import type { ActivityLog } from '../models/execution';
import type { Category, Task, Topic } from '../models/hierarchy';
import {
  asActivityLogId,
  asCategoryId,
  asMilestoneId,
  asTaskId,
  asTopicId,
  asWorkspaceId,
} from '../models/identifiers';
import {
  calculateMilestoneProgress,
  type MilestoneProgressContext,
} from './milestone-progress';

const workspaceId = asWorkspaceId('workspace');
const timestamp = '2026-10-01T00:00:00.000Z';
const dueDate = '2026-10-31';

function category(id: string, parentId: string | null = null): Category {
  return {
    id: asCategoryId(id),
    workspaceId,
    parentId: parentId === null ? null : asCategoryId(parentId),
    name: id,
    icon: null,
    color: null,
    importanceWeight: 5,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function topic(id: string, categoryId: string): Topic {
  return {
    id: asTopicId(id),
    workspaceId,
    categoryId: asCategoryId(categoryId),
    name: id,
    createdAt: timestamp,
    updatedAt: timestamp,
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
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function log(id: string, taskId: string, completedDate: string): ActivityLog {
  return {
    id: asActivityLogId(id),
    workspaceId,
    taskId: asTaskId(taskId),
    completedDate,
    note: null,
    createdAt: timestamp,
  };
}

function milestone(
  scope: MilestoneScope,
  createdAt = timestamp,
  due = dueDate
): Milestone {
  return {
    id: asMilestoneId('milestone'),
    workspaceId,
    title: 'Milestone',
    scope,
    targetPercentage: 100,
    dueDate: due,
    createdAt,
    updatedAt: timestamp,
  };
}

function context(overrides: Partial<MilestoneProgressContext> = {}): MilestoneProgressContext {
  return {
    milestone: milestone({
      kind: 'category',
      categoryId: asCategoryId('Math'),
    }),
    today: dueDate,
    categories: [],
    topics: [],
    tasks: [],
    activityLogs: [],
    ...overrides,
  };
}

const mathScope: MilestoneScope = {
  kind: 'category',
  categoryId: asCategoryId('Math'),
};

describe('calculateMilestoneProgress', () => {
  test('calculates progress by task weight, not task count', () => {
    const progress = calculateMilestoneProgress(
      context({
        categories: [category('Math')],
        topics: [topic('math-topic', 'Math')],
        tasks: [
          task('light', 'math-topic', 1),
          task('heavy', 'math-topic', 9),
        ],
        activityLogs: [log('log-light', 'light', '2026-10-30')],
      })
    );

    expect(progress.completedWeight).toBe(1);
    expect(progress.totalWeight).toBe(10);
    expect(progress.completedTaskCount).toBe(1);
    expect(progress.totalTaskCount).toBe(2);
    expect(progress.completionPercentage).toBe(10);
    expect(progress.pace).toBe('behind');
  });

  test('includes nested category descendants for a category milestone', () => {
    const progress = calculateMilestoneProgress(
      context({
        categories: [
          category('Math'),
          category('Algebra', 'Math'),
          category('Physics'),
        ],
        topics: [
          topic('algebra-topic', 'Algebra'),
          topic('physics-topic', 'Physics'),
        ],
        tasks: [
          task('algebra-a', 'algebra-topic', 9),
          task('algebra-b', 'algebra-topic', 1),
          task('physics-a', 'physics-topic', 100),
        ],
        activityLogs: [log('log-algebra', 'algebra-a', '2026-10-30')],
      })
    );

    expect(progress.totalWeight).toBe(10);
    expect(progress.totalTaskCount).toBe(2);
    expect(progress.completedWeight).toBe(9);
    expect(progress.completionPercentage).toBe(90);
  });

  test('limits a topic milestone to that topic', () => {
    const progress = calculateMilestoneProgress(
      context({
        milestone: milestone({
          kind: 'topic',
          topicId: asTopicId('algebra-topic'),
        }),
        categories: [category('Math')],
        topics: [topic('algebra-topic', 'Math'), topic('geometry-topic', 'Math')],
        tasks: [
          task('algebra-a', 'algebra-topic', 5),
          task('geometry-a', 'geometry-topic', 5),
        ],
        activityLogs: [log('log-geometry', 'geometry-a', '2026-10-30')],
      })
    );

    expect(progress.totalWeight).toBe(5);
    expect(progress.completedWeight).toBe(0);
    expect(progress.completionPercentage).toBe(0);
  });

  test('counts a task once even with duplicate completion logs', () => {
    const progress = calculateMilestoneProgress(
      context({
        categories: [category('Math')],
        topics: [topic('math-topic', 'Math')],
        tasks: [task('math-task', 'math-topic', 10)],
        activityLogs: [
          log('log-1', 'math-task', '2026-10-20'),
          log('log-2', 'math-task', '2026-10-21'),
        ],
      })
    );

    expect(progress.completedWeight).toBe(10);
    expect(progress.completedTaskCount).toBe(1);
    expect(progress.completionPercentage).toBe(100);
  });

  test('ignores activity logged after today', () => {
    const progress = calculateMilestoneProgress(
      context({
        today: '2026-10-31',
        categories: [category('Math')],
        topics: [topic('math-topic', 'Math')],
        tasks: [task('math-task', 'math-topic', 10)],
        activityLogs: [log('future', 'math-task', '2026-11-01')],
      })
    );

    expect(progress.completedWeight).toBe(0);
    expect(progress.completedTaskCount).toBe(0);
  });

  test('measures pace against a target below one hundred percent', () => {
    const progress = calculateMilestoneProgress(
      context({
        milestone: { ...milestone(mathScope), targetPercentage: 50 },
        today: '2026-10-16',
        categories: [category('Math')],
        topics: [topic('math-topic', 'Math')],
        tasks: [task('done', 'math-topic', 25), task('remaining', 'math-topic', 75)],
        activityLogs: [log('log-done', 'done', '2026-10-15')],
      })
    );

    expect(progress.completionPercentage).toBe(25);
    expect(progress.targetPercentage).toBe(50);
    expect(progress.targetProgressPercentage).toBe(50);
    expect(progress.elapsedPercentage).toBe(50);
    expect(progress.pace).toBe('on-track');
  });

  test('reports ahead of a target below one hundred percent', () => {
    const progress = calculateMilestoneProgress(
      context({
        milestone: { ...milestone(mathScope), targetPercentage: 50 },
        today: '2026-10-16',
        categories: [category('Math')],
        topics: [topic('math-topic', 'Math')],
        tasks: [task('done', 'math-topic', 40), task('remaining', 'math-topic', 60)],
        activityLogs: [log('log-done', 'done', '2026-10-15')],
      })
    );

    expect(progress.completionPercentage).toBe(40);
    expect(progress.targetProgressPercentage).toBe(80);
    expect(progress.elapsedPercentage).toBe(50);
    expect(progress.pace).toBe('ahead');
  });

  test('reports ahead when completion exceeds elapsed time', () => {
    const progress = calculateMilestoneProgress(
      context({
        milestone: milestone(mathScope),
        today: '2026-10-16',
        categories: [category('Math')],
        topics: [topic('math-topic', 'Math')],
        tasks: [task('done', 'math-topic', 60), task('remaining', 'math-topic', 40)],
        activityLogs: [log('log-done', 'done', '2026-10-15')],
      })
    );

    expect(progress.elapsedPercentage).toBe(50);
    expect(progress.completionPercentage).toBe(60);
    expect(progress.pace).toBe('ahead');
  });

  test('reports ahead at the positive tolerance boundary', () => {
    const progress = calculateMilestoneProgress(
      context({
        today: '2026-10-16',
        categories: [category('Math')],
        topics: [topic('math-topic', 'Math')],
        tasks: [task('done', 'math-topic', 55), task('remaining', 'math-topic', 45)],
        activityLogs: [log('log-done', 'done', '2026-10-15')],
      })
    );

    expect(progress.completionPercentage).toBeCloseTo(55);
    expect(progress.pace).toBe('ahead');
  });

  test('reports behind when completion lags elapsed time', () => {
    const progress = calculateMilestoneProgress(
      context({
        today: '2026-10-16',
        categories: [category('Math')],
        topics: [topic('math-topic', 'Math')],
        tasks: [task('done', 'math-topic', 40), task('remaining', 'math-topic', 60)],
        activityLogs: [log('log-done', 'done', '2026-10-15')],
      })
    );

    expect(progress.completionPercentage).toBe(40);
    expect(progress.elapsedPercentage).toBe(50);
    expect(progress.pace).toBe('behind');
  });

  test('reports on track when within five percentage points', () => {
    const progress = calculateMilestoneProgress(
      context({
        today: '2026-10-16',
        categories: [category('Math')],
        topics: [topic('math-topic', 'Math')],
        tasks: [task('done', 'math-topic', 46), task('remaining', 'math-topic', 54)],
        activityLogs: [log('log-done', 'done', '2026-10-15')],
      })
    );

    expect(progress.completionPercentage).toBe(46);
    expect(progress.elapsedPercentage).toBe(50);
    expect(progress.pace).toBe('on-track');
  });

  test('clamps elapsed time before the start and after the due date', () => {
    const before = calculateMilestoneProgress(
      context({ today: '2026-09-30' })
    );
    const after = calculateMilestoneProgress(
      context({ today: '2026-11-10' })
    );

    expect(before.elapsedPercentage).toBe(0);
    expect(after.elapsedPercentage).toBe(100);
  });

  test('handles an empty scope without dividing by zero', () => {
    const progress = calculateMilestoneProgress(
      context({
        today: '2026-10-31',
        categories: [category('Math')],
      })
    );

    expect(progress.totalWeight).toBe(0);
    expect(progress.completionPercentage).toBe(0);
    expect(progress.pace).toBe('behind');
  });

  test('never reports more than one hundred percent completion', () => {
    const progress = calculateMilestoneProgress(
      context({
        categories: [category('Math')],
        topics: [topic('math-topic', 'Math')],
        tasks: [task('a', 'math-topic', 5), task('b', 'math-topic', 5)],
        activityLogs: [
          log('log-a', 'a', '2026-10-20'),
          log('log-b', 'b', '2026-10-21'),
        ],
      })
    );

    expect(progress.completionPercentage).toBe(100);
    expect(progress.completedWeight).toBe(10);
  });
});
