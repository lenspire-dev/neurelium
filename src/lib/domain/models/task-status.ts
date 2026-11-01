export const TASK_STATUSES = ['todo', 'in_progress', 'done', 'skipped'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const DEFAULT_TASK_STATUS: TaskStatus = 'todo';

export function isTaskStatus(value: unknown): value is TaskStatus {
  return value === 'todo' || value === 'in_progress' || value === 'done' || value === 'skipped';
}
