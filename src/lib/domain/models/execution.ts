import type { IsoDate, IsoDateTime, WorkspaceScoped } from './common';
import type { ActivityLogId, TaskId } from './identifiers';

/** Immutable record that a task was completed. */
export interface ActivityLog extends WorkspaceScoped {
  readonly id: ActivityLogId;
  readonly taskId: TaskId;
  readonly completedDate: IsoDate;
  readonly note: string | null;
  readonly createdAt: IsoDateTime;
}
