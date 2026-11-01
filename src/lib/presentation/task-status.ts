import type { TaskStatus } from '#lib/domain/models/task-status.js';
import type { IsoDate } from '#lib/domain/models/common.js';
import type { Task } from '#lib/domain/models/hierarchy.js';

export interface TaskStatusMeta {
  readonly value: TaskStatus;
  readonly label: string;
  readonly badgeClass: string;
}

export const TASK_STATUS_META: readonly TaskStatusMeta[] = [
  {
    value: 'todo',
    label: 'To do',
    badgeClass: 'bg-muted text-muted-foreground'
  },
  {
    value: 'in_progress',
    label: 'In progress',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
  },
  {
    value: 'done',
    label: 'Done',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
  },
  {
    value: 'skipped',
    label: 'Skipped',
    badgeClass: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
  }
];

const byStatus = new Map(TASK_STATUS_META.map((item) => [item.value, item]));

export function taskStatusMeta(status: TaskStatus): TaskStatusMeta {
  return byStatus.get(status) ?? TASK_STATUS_META[0]!;
}

export function applyTaskStatus(
  tasks: readonly Task[],
  taskId: Task['id'],
  status: TaskStatus,
  today: IsoDate,
  now: string
): readonly Task[] {
  return tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          status,
          statusChangedAt: status === task.status ? task.statusChangedAt : now,
          doneDate: status === 'done' ? (task.doneDate ?? today) : null,
          updatedAt: now
        }
      : task
  );
}
