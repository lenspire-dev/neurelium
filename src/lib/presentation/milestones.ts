import { collectCategorySubtreeIds } from '#lib/domain/algorithms/hierarchy.js';
import { calculateMilestoneProgress } from '#lib/domain/algorithms/milestone-progress.js';
import { addDays, daysBetween, startOfWeek } from '#lib/domain/algorithms/week.js';
import type {
  Milestone,
  MilestoneProgress,
  PaceStatus
} from '#lib/domain/models/analytics.js';
import type { IsoDate } from '#lib/domain/models/common.js';
import type { ActivityLog } from '#lib/domain/models/execution.js';
import type { Category, Task, Topic } from '#lib/domain/models/hierarchy.js';
import type { TaskId, TopicId } from '#lib/domain/models/identifiers.js';
import type { TaskStatus } from '#lib/domain/models/task-status.js';

export type MilestoneStatus = PaceStatus | 'reached';
export type MilestoneFilter = 'all' | MilestoneStatus;
export type MilestoneSort = 'risk' | 'due' | 'progress' | 'title';

export interface MilestoneContext {
  readonly today: IsoDate;
  readonly categories: readonly Category[];
  readonly topics: readonly Topic[];
  readonly tasks: readonly Task[];
  readonly activityLogs: readonly ActivityLog[];
}

export interface MilestoneView {
  readonly milestone: Milestone;
  readonly progress: MilestoneProgress;
  readonly status: MilestoneStatus;
  readonly reached: boolean;
  /** Positive means days left, negative means days overdue. */
  readonly daysRemaining: number;
  readonly remainingTasks: readonly Task[];
  readonly nextTasks: readonly Task[];
}

export interface MilestoneCounts {
  readonly total: number;
  readonly active: number;
  readonly onTrack: number;
  readonly behind: number;
  readonly ahead: number;
  readonly reached: number;
  readonly dueSoon: number;
}

export interface MilestoneMomentumWeek {
  readonly weekStart: IsoDate;
  readonly weight: number;
  readonly count: number;
}

export interface MilestoneProjection {
  readonly recentWeeklyWeight: number;
  readonly remainingToTarget: number;
  readonly requiredWeeklyWeight: number;
  readonly projectedDate: IsoDate | null;
  /** Positive means the projection lands after the deadline. */
  readonly daysLate: number | null;
}

export interface MilestoneTopicProgress {
  readonly topic: Topic;
  readonly completedWeight: number;
  readonly totalWeight: number;
  readonly completedTaskCount: number;
  readonly totalTaskCount: number;
  readonly completionPercentage: number;
}

export const MILESTONE_STATUS_META: Record<
  MilestoneStatus,
  { readonly label: string; readonly badgeClass: string; readonly indicatorClass: string }
> = {
  reached: {
    label: 'Reached',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    indicatorClass: 'bg-emerald-500'
  },
  ahead: {
    label: 'Ahead',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    indicatorClass: 'bg-emerald-500'
  },
  'on-track': {
    label: 'On track',
    badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    indicatorClass: 'bg-sky-500'
  },
  behind: {
    label: 'Behind',
    badgeClass: 'bg-destructive/10 text-destructive',
    indicatorClass: 'bg-destructive'
  }
};

const STATUS_RANK: Record<MilestoneStatus, number> = {
  behind: 0,
  'on-track': 1,
  ahead: 2,
  reached: 3
};

const NEXT_TASK_RANK: Record<TaskStatus, number> = {
  in_progress: 0,
  todo: 1,
  skipped: 2,
  done: 3
};

interface MilestoneScopeData {
  readonly tasks: readonly Task[];
  readonly taskIds: ReadonlySet<TaskId>;
  readonly completedTaskIds: ReadonlySet<TaskId>;
}

export function buildMilestoneViews(
  milestones: readonly Milestone[],
  progressRows: readonly MilestoneProgress[],
  context: MilestoneContext
): readonly MilestoneView[] {
  const progressById = new Map(
    progressRows.map((progress) => [progress.milestoneId, progress])
  );
  return milestones.map((milestone) =>
    buildMilestoneView(milestone, progressById.get(milestone.id), context)
  );
}

export function buildMilestoneView(
  milestone: Milestone,
  progress: MilestoneProgress | undefined,
  context: MilestoneContext
): MilestoneView {
  const resolved = progress ?? calculateMilestoneProgress({ milestone, ...context });
  const scope = milestoneScope(milestone, context);
  const remainingTasks = scope.tasks
    .filter((task) => !scope.completedTaskIds.has(task.id))
    .slice()
    .sort(
      (a, b) =>
        NEXT_TASK_RANK[a.status] - NEXT_TASK_RANK[b.status] ||
        b.taskWeight - a.taskWeight ||
        a.title.localeCompare(b.title)
    );
  const reached =
    resolved.targetPercentage > 0 && resolved.targetProgressPercentage >= 100;

  return {
    milestone,
    progress: resolved,
    status: reached ? 'reached' : resolved.pace,
    reached,
    daysRemaining: daysBetween(context.today, milestone.dueDate),
    remainingTasks,
    nextTasks: remainingTasks.slice(0, 2)
  };
}

export function milestoneStatusCounts(
  views: readonly MilestoneView[]
): MilestoneCounts {
  const counts = {
    total: views.length,
    active: 0,
    onTrack: 0,
    behind: 0,
    ahead: 0,
    reached: 0,
    dueSoon: 0
  };

  for (const view of views) {
    if (view.reached) {
      counts.reached += 1;
      continue;
    }
    counts.active += 1;
    if (view.status === 'behind') counts.behind += 1;
    else if (view.status === 'ahead') counts.ahead += 1;
    else counts.onTrack += 1;
    if (view.daysRemaining <= 7) counts.dueSoon += 1;
  }

  return counts;
}

export function filterMilestoneViews(
  views: readonly MilestoneView[],
  filter: MilestoneFilter,
  query: string
): readonly MilestoneView[] {
  const needle = query.trim().toLocaleLowerCase();
  return views.filter((view) => {
    if (filter !== 'all' && view.status !== filter) return false;
    if (needle === '') return true;
    return view.milestone.title.toLocaleLowerCase().includes(needle);
  });
}

export function sortMilestoneViews(
  views: readonly MilestoneView[],
  sort: MilestoneSort
): readonly MilestoneView[] {
  const rows = [...views];

  if (sort === 'title') {
    return rows.sort((a, b) => a.milestone.title.localeCompare(b.milestone.title));
  }
  if (sort === 'progress') {
    return rows.sort(
      (a, b) =>
        b.progress.targetProgressPercentage - a.progress.targetProgressPercentage ||
        a.milestone.title.localeCompare(b.milestone.title)
    );
  }
  if (sort === 'due') {
    return rows.sort(
      (a, b) =>
        Number(a.reached) - Number(b.reached) ||
        a.milestone.dueDate.localeCompare(b.milestone.dueDate)
    );
  }
  return rows.sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      a.daysRemaining - b.daysRemaining ||
      a.progress.targetProgressPercentage - b.progress.targetProgressPercentage ||
      a.milestone.title.localeCompare(b.milestone.title)
  );
}

export function milestonePaceGap(progress: MilestoneProgress): number {
  return Math.round(progress.targetProgressPercentage - progress.elapsedPercentage);
}

export function milestoneDueLabel(daysRemaining: number): string {
  if (daysRemaining === 0) return 'Due today';
  if (daysRemaining > 0) {
    return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`;
  }
  const overdue = Math.abs(daysRemaining);
  return `${overdue} day${overdue === 1 ? '' : 's'} overdue`;
}

export function milestoneMomentum(
  milestone: Milestone,
  context: MilestoneContext,
  weeks = 6
): readonly MilestoneMomentumWeek[] {
  const scope = milestoneScope(milestone, context);
  const weightByTask = new Map(scope.tasks.map((task) => [task.id, task.taskWeight]));
  const currentWeek = startOfWeek(context.today);
  const starts = Array.from({ length: weeks }, (_, index) =>
    addDays(currentWeek, -7 * (weeks - 1 - index))
  );
  const byWeek = new Map(
    starts.map((weekStart) => [weekStart, { weekStart, weight: 0, count: 0 }])
  );

  for (const log of context.activityLogs) {
    if (!scope.taskIds.has(log.taskId)) continue;
    if (log.completedDate > context.today) continue;
    const bucket = byWeek.get(startOfWeek(log.completedDate));
    if (bucket === undefined) continue;
    bucket.weight += weightByTask.get(log.taskId) ?? 0;
    bucket.count += 1;
  }

  return starts.map((weekStart) => byWeek.get(weekStart)!);
}

export function milestoneProjection(
  view: MilestoneView,
  context: MilestoneContext
): MilestoneProjection {
  const progress = view.progress;
  if (progress.totalWeight <= 0) {
    return {
      recentWeeklyWeight: 0,
      remainingToTarget: 0,
      requiredWeeklyWeight: 0,
      projectedDate: null,
      daysLate: null
    };
  }
  const targetWeight = progress.totalWeight * (progress.targetPercentage / 100);
  const remainingToTarget = Math.max(0, targetWeight - progress.completedWeight);
  const weeksLeft = Math.max(0, view.daysRemaining) / 7;
  const requiredWeeklyWeight =
    remainingToTarget === 0
      ? 0
      : weeksLeft > 0
        ? remainingToTarget / weeksLeft
        : remainingToTarget;

  const scope = milestoneScope(view.milestone, context);
  const weightByTask = new Map(scope.tasks.map((task) => [task.id, task.taskWeight]));
  const createdDate = view.milestone.createdAt.slice(0, 10);
  const windowFloor = addDays(context.today, -27);
  const windowStart = createdDate > windowFloor ? createdDate : windowFloor;
  const windowDays = Math.max(1, daysBetween(windowStart, context.today) + 1);
  const windowWeeks = Math.max(1, windowDays / 7);

  let weightInWindow = 0;
  for (const log of context.activityLogs) {
    if (!scope.taskIds.has(log.taskId)) continue;
    if (log.completedDate < windowStart || log.completedDate > context.today) continue;
    weightInWindow += weightByTask.get(log.taskId) ?? 0;
  }
  const recentWeeklyWeight = weightInWindow / windowWeeks;

  let projectedDate: IsoDate | null = null;
  if (remainingToTarget === 0) {
    projectedDate = context.today;
  } else if (recentWeeklyWeight > 0) {
    const weeksNeeded = remainingToTarget / recentWeeklyWeight;
    projectedDate = addDays(context.today, Math.ceil(weeksNeeded * 7));
  }

  return {
    recentWeeklyWeight,
    remainingToTarget,
    requiredWeeklyWeight,
    projectedDate,
    daysLate:
      projectedDate === null
        ? null
        : daysBetween(view.milestone.dueDate, projectedDate)
  };
}

export function milestoneTopicProgress(
  view: MilestoneView,
  context: MilestoneContext
): readonly MilestoneTopicProgress[] {
  const scope = milestoneScope(view.milestone, context);
  const topicsById = new Map(context.topics.map((topic) => [topic.id, topic]));
  const tasksByTopic = new Map<TopicId, Task[]>();

  for (const task of scope.tasks) {
    const tasks = tasksByTopic.get(task.topicId) ?? [];
    tasks.push(task);
    tasksByTopic.set(task.topicId, tasks);
  }

  return [...tasksByTopic.entries()]
    .map(([topicId, tasks]): MilestoneTopicProgress | null => {
      const topic = topicsById.get(topicId);
      if (topic === undefined) return null;
      const completed = tasks.filter((task) => scope.completedTaskIds.has(task.id));
      const totalWeight = tasks.reduce((sum, task) => sum + task.taskWeight, 0);
      const completedWeight = completed.reduce((sum, task) => sum + task.taskWeight, 0);
      return {
        topic,
        completedWeight,
        totalWeight,
        completedTaskCount: completed.length,
        totalTaskCount: tasks.length,
        completionPercentage:
          totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0
      };
    })
    .filter((item): item is MilestoneTopicProgress => item !== null)
    .sort(
      (a, b) =>
        b.totalWeight - a.totalWeight || a.topic.name.localeCompare(b.topic.name)
    );
}

function milestoneScope(
  milestone: Milestone,
  context: MilestoneContext
): MilestoneScopeData {
  const categoryIds =
    milestone.scope.kind === 'category'
      ? collectCategorySubtreeIds(milestone.scope.categoryId, context.categories)
      : null;
  const topicIds = new Set<TopicId>(
    context.topics
      .filter((topic) =>
        categoryIds === null
          ? milestone.scope.kind === 'topic' &&
            topic.id === milestone.scope.topicId
          : categoryIds.has(topic.categoryId)
      )
      .map((topic) => topic.id)
  );
  const tasks = context.tasks.filter((task) => topicIds.has(task.topicId));
  const taskIds = new Set(tasks.map((task) => task.id));
  const completedTaskIds = new Set<TaskId>(
    tasks
      .filter(
        (task) =>
          task.status === 'done' &&
          (task.doneDate === null || task.doneDate <= context.today)
      )
      .map((task) => task.id)
  );

  return { tasks, taskIds, completedTaskIds };
}
