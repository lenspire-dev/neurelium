import type { Category, Task, Topic } from '../models/hierarchy';
import type {
  CategoryOverrideMode,
  CategoryStatus
} from '../models/category-status';
import type { CategoryId } from '../models/identifiers';
import { collectCategorySubtreeIds } from './hierarchy';

export interface CategoryStatusContext {
  readonly categoryId: CategoryId;
  readonly categories: readonly Category[];
  readonly topics: readonly Topic[];
  readonly tasks: readonly Task[];
  readonly overrideMode?: CategoryOverrideMode;
}

export interface CategoryStatusResult {
  readonly status: CategoryStatus;
  readonly completedWeight: number;
  readonly totalWeight: number;
  readonly completedTasks: number;
  readonly totalTasks: number;
  readonly completionPercentage: number;
  readonly overridden: boolean;
}

export function calculateCategoryStatus(
  context: CategoryStatusContext
): CategoryStatusResult {
  const category =
    context.categories.find((item) => item.id === context.categoryId) ?? null;
  const categoryIds = collectCategorySubtreeIds(context.categoryId, context.categories);
  const topicIds = new Set(
    context.topics
      .filter((topic) => categoryIds.has(topic.categoryId))
      .map((topic) => topic.id)
  );
  const tasks = context.tasks.filter(
    (task) => topicIds.has(task.topicId) && task.status !== 'skipped'
  );
  const totalWeight = tasks.reduce((sum, task) => sum + task.taskWeight, 0);
  const completed = tasks.filter((task) => task.status === 'done');
  const completedWeight = completed.reduce((sum, task) => sum + task.taskWeight, 0);
  const completionPercentage =
    totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

  const override =
    context.overrideMode === 'done_only'
      ? category?.statusOverride === 'done'
        ? 'done'
        : null
      : (category?.statusOverride ?? null);
  if (override !== null) {
    return {
      status: override,
      completedWeight,
      totalWeight,
      completedTasks: completed.length,
      totalTasks: tasks.length,
      completionPercentage,
      overridden: true
    };
  }

  return {
    status:
      tasks.length > 0 && completed.length === tasks.length
        ? 'done'
        : completed.length > 0
          ? 'in_progress'
          : 'todo',
    completedWeight,
    totalWeight,
    completedTasks: completed.length,
    totalTasks: tasks.length,
    completionPercentage,
    overridden: false
  };
}
