import { addDays, daysBetween } from '#lib/domain/algorithms/week.js';
import type { IsoDate, WeekStart } from '#lib/domain/models/common.js';
import type { ActivityLog } from '#lib/domain/models/execution.js';
import type { Category, Task, Topic } from '#lib/domain/models/hierarchy.js';
import type { CategoryId } from '#lib/domain/models/identifiers.js';
import type { WeeklyPoolEntry } from '#lib/domain/models/planning.js';

export interface DailyCompletion {
  readonly date: IsoDate;
  readonly count: number;
}

export interface CategoryBalance {
  readonly category: Category;
  readonly completedWeight: number;
  readonly plannedWeight: number;
}

export function dailyCompletion(
  logs: readonly ActivityLog[],
  weekStart: WeekStart
): DailyCompletion[] {
  const counts = new Map<IsoDate, number>();
  for (const log of logs) {
    const offset = daysBetween(weekStart, log.completedDate);
    if (offset < 0 || offset > 6) continue;
    counts.set(log.completedDate, (counts.get(log.completedDate) ?? 0) + 1);
  }

  return Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(weekStart, offset);
    return { date, count: counts.get(date) ?? 0 };
  });
}

export function categoryBalance(
  categories: readonly Category[],
  topics: readonly Topic[],
  tasks: readonly Task[],
  entries: readonly WeeklyPoolEntry[]
): CategoryBalance[] {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const roots = new Map<CategoryId, Category>();
  const balances = new Map<CategoryId, { completedWeight: number; plannedWeight: number }>();

  function rootOf(category: Category): Category {
    const cached = roots.get(category.id);
    if (cached !== undefined) return cached;

    const visited = new Set<CategoryId>();
    let current = category;
    while (current.parentId !== null && !visited.has(current.id)) {
      visited.add(current.id);
      current = categoriesById.get(current.parentId) ?? current;
    }
    roots.set(category.id, current);
    return current;
  }

  for (const entry of entries) {
    const task = tasksById.get(entry.taskId);
    const topic = task === undefined ? undefined : topicsById.get(task.topicId);
    const category = topic === undefined ? undefined : categoriesById.get(topic.categoryId);
    if (task === undefined || category === undefined) continue;

    const root = rootOf(category);
    const balance = balances.get(root.id) ?? { completedWeight: 0, plannedWeight: 0 };
    balance.plannedWeight += task.taskWeight;
    if (entry.status === 'done') balance.completedWeight += task.taskWeight;
    balances.set(root.id, balance);
  }

  return [...balances.entries()]
    .map(([categoryId, balance]) => ({
      category: roots.get(categoryId) ?? categoriesById.get(categoryId)!,
      ...balance
    }))
    .sort((a, b) => b.plannedWeight - a.plannedWeight || a.category.name.localeCompare(b.category.name));
}
