import type { Milestone, MilestoneProgress, PaceStatus } from '../models/analytics';
import type { IsoDate, IsoDateTime } from '../models/common';
import type { ActivityLog } from '../models/execution';
import type { Category, Task, Topic } from '../models/hierarchy';
import type { TaskId } from '../models/identifiers';
import { collectCategorySubtreeIds } from './hierarchy';
import { clampPercentage, daysBetween } from './week';

export const PACE_TOLERANCE_PERCENTAGE = 5;

export interface MilestoneProgressContext {
  readonly milestone: Milestone;
  readonly today: IsoDate;
  readonly categories: readonly Category[];
  readonly topics: readonly Topic[];
  readonly tasks: readonly Task[];
  readonly activityLogs: readonly ActivityLog[];
}

export function calculateMilestoneProgress(
  context: MilestoneProgressContext
): MilestoneProgress {
  const scopeCategoryIds =
    context.milestone.scope.kind === 'category'
      ? collectCategorySubtreeIds(context.milestone.scope.categoryId, context.categories)
      : null;

  const scopeTopicIds = new Set(
    context.topics
      .filter((topic) =>
        scopeCategoryIds === null
          ? context.milestone.scope.kind === 'topic' &&
            topic.id === context.milestone.scope.topicId
          : scopeCategoryIds.has(topic.categoryId)
      )
      .map((topic) => topic.id)
  );

  const scopeTasks = context.tasks.filter((task) => scopeTopicIds.has(task.topicId));
  const taskIds = new Set<TaskId>(scopeTasks.map((task) => task.id));
  const completedTaskIds = new Set<TaskId>();

  for (const log of context.activityLogs) {
    if (!taskIds.has(log.taskId)) continue;
    if (log.completedDate > context.today) continue;
    completedTaskIds.add(log.taskId);
  }

  const totalWeight = sumWeights(scopeTasks);
  const completedWeight = sumWeights(
    scopeTasks.filter((task) => completedTaskIds.has(task.id))
  );
  const completionPercentage =
    totalWeight > 0 ? clampPercentage((completedWeight / totalWeight) * 100) : 0;
  const targetProgressPercentage =
    context.milestone.targetPercentage > 0
      ? clampPercentage(
          (completionPercentage / context.milestone.targetPercentage) * 100
        )
      : 0;
  const elapsedPercentage = calculateElapsedPercentage(
    context.milestone.createdAt,
    context.milestone.dueDate,
    context.today
  );

  return {
    milestoneId: context.milestone.id,
    completedWeight,
    totalWeight,
    completedTaskCount: completedTaskIds.size,
    totalTaskCount: scopeTasks.length,
    completionPercentage,
    targetProgressPercentage,
    targetPercentage: context.milestone.targetPercentage,
    elapsedPercentage,
    pace: paceFor(targetProgressPercentage, elapsedPercentage),
  };
}

function calculateElapsedPercentage(
  createdAt: IsoDateTime,
  dueDate: IsoDate,
  today: IsoDate
): number {
  const startDate = createdAt.slice(0, 10);
  const totalDays = daysBetween(startDate, dueDate);
  if (totalDays <= 0) return today >= dueDate ? 100 : 0;
  return clampPercentage((daysBetween(startDate, today) / totalDays) * 100);
}

function paceFor(completionPercentage: number, elapsedPercentage: number): PaceStatus {
  const difference = completionPercentage - elapsedPercentage;
  if (difference >= PACE_TOLERANCE_PERCENTAGE) return 'ahead';
  if (difference <= -PACE_TOLERANCE_PERCENTAGE) return 'behind';
  return 'on-track';
}

function sumWeights(tasks: readonly Task[]): number {
  return tasks.reduce((sum, task) => sum + task.taskWeight, 0);
}
