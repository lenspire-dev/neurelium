import type { IsoDate, IsoDateTime, WorkspaceScoped } from './common';
import type { ActivityLogId, TaskId, WeeklyPoolEntryId } from './identifiers';

/** Immutable record that a task was completed. */
export interface ActivityLog extends WorkspaceScoped {
  readonly id: ActivityLogId;
  readonly taskId: TaskId;
  /** The weekly occurrence this completion belongs to, when known. */
  readonly entryId: WeeklyPoolEntryId | null;
  readonly completedDate: IsoDate;
  readonly note: string | null;
  /** Names captured so history survives edits and deletion. */
  readonly taskName: string | null;
  readonly topicName: string | null;
  readonly categoryName: string | null;
  readonly createdAt: IsoDateTime;
}
