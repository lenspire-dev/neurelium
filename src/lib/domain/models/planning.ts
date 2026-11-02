import type { IsoDate, IsoDateTime, WeekStart, WorkspaceScoped } from './common';
import type { TaskId, WeeklyPoolEntryId } from './identifiers';
import type { TaskStatus } from './task-status';

export interface WeeklyPoolEntry extends WorkspaceScoped {
  readonly id: WeeklyPoolEntryId;
  readonly taskId: TaskId;
  readonly weekStart: WeekStart;
  /** Optional day within the week; null means the task is unscheduled. */
  readonly plannedDate: IsoDate | null;
  /** Status of this occurrence, independent of the task's own status. */
  readonly status: TaskStatus;
  readonly completedDate: IsoDate | null;
  readonly createdAt: IsoDateTime;
}
