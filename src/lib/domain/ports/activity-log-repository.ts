import type { IsoDate } from '../models/common';
import type { ActivityLog } from '../models/execution';
import type { TaskId, WorkspaceId } from '../models/identifiers';

export interface ActivityLogRepository {
  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly ActivityLog[]>;
  listByDateRange(
    workspaceId: WorkspaceId,
    from: IsoDate,
    to: IsoDate
  ): Promise<readonly ActivityLog[]>;
  listByTask(
    workspaceId: WorkspaceId,
    taskId: TaskId
  ): Promise<readonly ActivityLog[]>;
  save(log: ActivityLog): Promise<ActivityLog>;
  delete(workspaceId: WorkspaceId, logId: ActivityLog['id']): Promise<void>;
}
