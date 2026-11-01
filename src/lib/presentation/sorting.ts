import type { Category, Task, Topic } from '#lib/domain/models/hierarchy.js';
import type { TaskStatus } from '#lib/domain/models/task-status.js';
import type { WeightGrade } from '#lib/domain/models/weight.js';

export type SortDirection = 'asc' | 'desc';
export type TaskSortKey = 'title' | 'created' | 'updated' | 'weight' | 'status' | 'done';
export type CategorySortKey = 'name' | 'created' | 'importance';
export type TopicSortKey = 'name' | 'created';
export type TaskFilterStatus = TaskStatus | 'all';
export type TaskFilterWeight = WeightGrade | 'all';

export interface TaskFilters {
  readonly status: TaskFilterStatus;
  readonly weight: TaskFilterWeight;
  readonly query: string;
}

const STATUS_ORDER: Record<TaskStatus, number> = {
  todo: 0,
  in_progress: 1,
  done: 2,
  skipped: 3
};

function directionFactor(direction: SortDirection): number {
  return direction === 'asc' ? 1 : -1;
}

function textCompare(a: string, b: string): number {
  return a.localeCompare(b);
}

export function taskComparator(
  key: TaskSortKey,
  direction: SortDirection = 'asc'
): (a: Task, b: Task) => number {
  const factor = directionFactor(direction);
  return (a, b) => {
    let result = 0;
    if (key === 'title') result = textCompare(a.title, b.title);
    else if (key === 'created') result = a.createdAt.localeCompare(b.createdAt);
    else if (key === 'updated') result = a.updatedAt.localeCompare(b.updatedAt);
    else if (key === 'weight') result = a.taskWeight - b.taskWeight;
    else if (key === 'status') result = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    else result = (a.doneDate ?? '').localeCompare(b.doneDate ?? '');
    return (result || textCompare(a.title, b.title)) * factor;
  };
}

export function sortTasks(
  tasks: readonly Task[],
  key: TaskSortKey,
  direction: SortDirection = 'asc'
): Task[] {
  return tasks.slice().sort(taskComparator(key, direction));
}

export function filterTasks(tasks: readonly Task[], filters: TaskFilters): Task[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return tasks.filter((task) => {
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (filters.weight !== 'all' && task.taskWeight !== filters.weight) return false;
    if (query !== '' && !task.title.toLocaleLowerCase().includes(query)) return false;
    return true;
  });
}

export function categoryComparator(
  key: CategorySortKey,
  direction: SortDirection = 'asc'
): (a: Category, b: Category) => number {
  const factor = directionFactor(direction);
  return (a, b) => {
    let result = 0;
    if (key === 'name') result = textCompare(a.name, b.name);
    else if (key === 'created') result = a.createdAt.localeCompare(b.createdAt);
    else result = a.importanceWeight - b.importanceWeight;
    return (result || textCompare(a.name, b.name)) * factor;
  };
}

export function topicComparator(
  key: TopicSortKey,
  direction: SortDirection = 'asc'
): (a: Topic, b: Topic) => number {
  const factor = directionFactor(direction);
  return (a, b) => {
    const result = key === 'created' ? a.createdAt.localeCompare(b.createdAt) : textCompare(a.name, b.name);
    return (result || textCompare(a.name, b.name)) * factor;
  };
}

export function sortTopics(
  topics: readonly Topic[],
  key: TopicSortKey,
  direction: SortDirection = 'asc'
): Topic[] {
  return topics.slice().sort(topicComparator(key, direction));
}
