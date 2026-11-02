import type { UserId, WorkspaceId } from '../models/identifiers';
import type { Workspace } from '../models/workspace';

export interface WorkspaceRepository {
  findById(workspaceId: WorkspaceId): Promise<Workspace | null>;
  listByOwner(ownerId: UserId): Promise<readonly Workspace[]>;
  listAccessible(): Promise<readonly Workspace[]>;
  save(workspace: Workspace): Promise<Workspace>;
  migratePermissions(workspace: Workspace): Promise<void>;
  deleteWorkspace(workspace: Workspace): Promise<void>;
}
