import type { UserId, WorkspaceId } from '../models/identifiers';
import type { Workspace } from '../models/workspace';

export interface WorkspaceRepository {
  findById(workspaceId: WorkspaceId): Promise<Workspace | null>;
  listByOwner(ownerId: UserId): Promise<readonly Workspace[]>;
  save(workspace: Workspace): Promise<Workspace>;
}
