import type { IsoDate, IsoDateTime, WeekStart, WorkspaceScoped } from './common';
import type { TaskId, WeeklyPoolEntryId } from './identifiers';

export interface WeeklyPoolEntry extends WorkspaceScoped {
  readonly id: WeeklyPoolEntryId;
  readonly taskId: TaskId;
  readonly weekStart: WeekStart;
  /** Optional day within the week; null means the task is unscheduled. */
  readonly plannedDate: IsoDate | null;
  readonly createdAt: IsoDateTime;
}
