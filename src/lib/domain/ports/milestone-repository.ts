import type { Milestone } from '../models/analytics';
import type { MilestoneId, WorkspaceId } from '../models/identifiers';

export interface MilestoneRepository {
  findById(
    workspaceId: WorkspaceId,
    milestoneId: MilestoneId
  ): Promise<Milestone | null>;
  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Milestone[]>;
  save(milestone: Milestone): Promise<Milestone>;
  delete(workspaceId: WorkspaceId, milestoneId: MilestoneId): Promise<void>;
}
