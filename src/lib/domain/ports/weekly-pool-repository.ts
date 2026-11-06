import type { WeekStart } from '../models/common';
import type { TaskId, WeeklyPoolEntryId, WorkspaceId } from '../models/identifiers';
import type { WeeklyPoolEntry } from '../models/planning';

export interface WeeklyPoolRepository {
  findById(
    workspaceId: WorkspaceId,
    entryId: WeeklyPoolEntryId
  ): Promise<WeeklyPoolEntry | null>;
  listByWorkspace(
    workspaceId: WorkspaceId
  ): Promise<readonly WeeklyPoolEntry[]>;
  listByWeek(
    workspaceId: WorkspaceId,
    weekStart: WeekStart
  ): Promise<readonly WeeklyPoolEntry[]>;
  listByTask(
    workspaceId: WorkspaceId,
    taskId: TaskId
  ): Promise<readonly WeeklyPoolEntry[]>;
  save(entry: WeeklyPoolEntry): Promise<WeeklyPoolEntry>;
  delete(workspaceId: WorkspaceId, entryId: WeeklyPoolEntryId): Promise<void>;
}
