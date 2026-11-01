import { describe, expect, test } from 'bun:test';
import type { Milestone, MilestoneProgress } from '#lib/domain/models/analytics.js';
import type { ActivityLog } from '#lib/domain/models/execution.js';
import type { Category, Task, Topic } from '#lib/domain/models/hierarchy.js';
import {
  asActivityLogId,
  asCategoryId,
  asMilestoneId,
  asTaskId,
  asTopicId,
  asWorkspaceId
} from '#lib/domain/models/identifiers.js';
import {
  buildMilestoneView,
  buildMilestoneViews,
  milestoneDueLabel,
  milestoneMomentum,
  milestoneProjection,
  milestoneStatusCounts,
  sortMilestoneViews,
  type MilestoneContext,
  type MilestoneView
} from './milestones';

const workspaceId = asWorkspaceId('workspace');
const createdAt = '2026-10-01T00:00:00.000Z';
const today = '2026-10-31';

const category: Category = {
  id: asCategoryId('category'),
  workspaceId,
  parentId: null,
  name: 'Math',
  icon: null,
  color: null,
  importanceWeight: 3,
  createdAt,
  updatedAt: createdAt
};

const topic: Topic = {
  id: asTopicId('topic'),
  workspaceId,
  categoryId: category.id,
  name: 'Algebra',
  createdAt,
  updatedAt: createdAt
};

function task(id: string, weight: number, status: Task['status'] = 'todo'): Task {
  return {
    id: asTaskId(id),
    workspaceId,
    topicId: topic.id,
    title: id,
    icon: null,
    taskWeight: weight,
    status,
    statusChangedAt: null,
    doneDate: status === 'done' ? '2026-10-20' : null,
    createdAt,
    updatedAt: createdAt
  };
}

function log(id: string, taskId: string, completedDate: string): ActivityLog {
  return {
    id: asActivityLogId(id),
    workspaceId,
    taskId: asTaskId(taskId),
    completedDate,
    note: null,
    createdAt
  };
}

function milestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: asMilestoneId('milestone'),
    workspaceId,
    title: 'Finish algebra',
    scope: { kind: 'category', categoryId: category.id },
    targetPercentage: 100,
    dueDate: '2026-11-30',
    createdAt,
    updatedAt: createdAt,
    ...overrides
  };
}

function context(activityLogs: readonly ActivityLog[] = []): MilestoneContext {
  return {
    today,
    categories: [category],
    topics: [topic],
    tasks: [task('a', 4), task('b', 2, 'done')],
    activityLogs
  };
}

describe('buildMilestoneView', () => {
  test('derives pace, days left, and the remaining tasks', () => {
    const view = buildMilestoneView(milestone(), undefined, context([log('l', 'b', '2026-10-20')]));

    expect(view.status).toBe('behind');
    expect(view.reached).toBe(false);
    expect(view.daysRemaining).toBe(30);
    expect(view.progress.completionPercentage).toBeCloseTo(33.33, 1);
    expect(view.progress.elapsedPercentage).toBe(50);
    expect(view.remainingTasks.map((item) => item.id)).toEqual([asTaskId('a')]);
    expect(view.nextTasks.map((item) => item.id)).toEqual([asTaskId('a')]);
  });

  test('marks a milestone reached when completion meets the target', () => {
    const view = buildMilestoneView(
      milestone({ targetPercentage: 30 }),
      undefined,
      context([log('l', 'b', '2026-10-20')])
    );

    expect(view.reached).toBe(true);
    expect(view.status).toBe('reached');
    expect(view.progress.targetProgressPercentage).toBe(100);
  });

  test('builds views for every milestone and tolerates missing progress rows', () => {
    const views = buildMilestoneViews([milestone()], [], context());
    expect(views).toHaveLength(1);
    expect(views[0]?.progress.totalWeight).toBe(6);
  });
});

describe('milestoneMomentum', () => {
  test('buckets completed weight into the last six weeks', () => {
    const weeks = milestoneMomentum(milestone(), context([log('l', 'b', '2026-10-20')]));

    expect(weeks).toHaveLength(6);
    expect(weeks[weeks.length - 1]?.weekStart).toBe('2026-10-26');
    expect(weeks.find((week) => week.weekStart === '2026-10-19')).toEqual({
      weekStart: '2026-10-19',
      weight: 2,
      count: 1
    });
  });
});

describe('milestoneProjection', () => {
  test('projects the target date from recent completion weight', () => {
    const progress = buildMilestoneView(
      milestone(),
      undefined,
      context([log('l', 'b', '2026-10-20')])
    );
    const projection = milestoneProjection(progress, context([log('l', 'b', '2026-10-20')]));

    expect(projection.recentWeeklyWeight).toBeCloseTo(0.5, 5);
    expect(projection.remainingToTarget).toBe(4);
    expect(projection.projectedDate).toBe('2026-12-26');
    expect(projection.daysLate).toBe(26);
    expect(projection.requiredWeeklyWeight).toBeCloseTo(0.933, 3);
  });

  test('returns no projected date without completion history', () => {
    const view = buildMilestoneView(milestone(), undefined, context());
    const projection = milestoneProjection(view, context());

    expect(projection.recentWeeklyWeight).toBe(0);
    expect(projection.projectedDate).toBeNull();
    expect(projection.daysLate).toBeNull();
  });

  test('returns no projection for a scope without tasks', () => {
    const empty = { ...context(), tasks: [] };
    const view = buildMilestoneView(milestone(), undefined, empty);
    const projection = milestoneProjection(view, empty);

    expect(view.progress.totalWeight).toBe(0);
    expect(projection.remainingToTarget).toBe(0);
    expect(projection.projectedDate).toBeNull();
  });
});

describe('status ordering and labels', () => {
  function view(status: MilestoneView['status'], daysRemaining: number): MilestoneView {
    const achieved = status === 'reached';
    const progress: MilestoneProgress = {
      milestoneId: asMilestoneId(status),
      completedWeight: achieved ? 6 : 3,
      totalWeight: 6,
      completedTaskCount: achieved ? 2 : 1,
      totalTaskCount: 2,
      completionPercentage: achieved ? 100 : 50,
      targetProgressPercentage: achieved ? 100 : 50,
      targetPercentage: 100,
      elapsedPercentage: 50,
      pace: status === 'reached' ? 'ahead' : status
    };
    return {
      milestone: milestone({ id: asMilestoneId(status), title: status, dueDate: '2026-11-30' }),
      progress,
      status,
      reached: achieved,
      daysRemaining,
      remainingTasks: [],
      nextTasks: []
    };
  }

  test('puts behind milestones first and reached milestones last', () => {
    const views = [
      view('reached', 30),
      view('ahead', 30),
      view('on-track', 30),
      view('behind', 30)
    ];

    expect(sortMilestoneViews(views, 'risk').map((item) => item.status)).toEqual([
      'behind',
      'on-track',
      'ahead',
      'reached'
    ]);
  });

  test('counts active, due soon, and reached milestones', () => {
    const counts = milestoneStatusCounts([
      view('behind', 3),
      view('ahead', 20),
      view('reached', 10)
    ]);

    expect(counts).toEqual({
      total: 3,
      active: 2,
      onTrack: 0,
      behind: 1,
      ahead: 1,
      reached: 1,
      dueSoon: 1
    });
  });

  test('formats relative due labels', () => {
    expect(milestoneDueLabel(0)).toBe('Due today');
    expect(milestoneDueLabel(1)).toBe('1 day left');
    expect(milestoneDueLabel(-2)).toBe('2 days overdue');
  });
});
