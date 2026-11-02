import type { WorkspaceMember, WorkspaceRole } from '../models/workspace-member';
import type { Workspace } from '../models/workspace';

export interface WorkspaceTeamPort {
  ensureTeam(workspace: Workspace): Promise<boolean>;
  renameTeam(workspace: Workspace): Promise<void>;
  deleteTeam(workspace: Workspace): Promise<void>;
  listMembers(workspace: Workspace): Promise<readonly WorkspaceMember[]>;
  invite(
    workspace: Workspace,
    email: string,
    role: Exclude<WorkspaceRole, 'owner'>,
    redirectUrl: string
  ): Promise<void>;
  updateRole(
    workspace: Workspace,
    membershipId: string,
    role: Exclude<WorkspaceRole, 'owner'>
  ): Promise<void>;
  removeMember(workspace: Workspace, membershipId: string): Promise<void>;
  acceptInvitation(input: {
    workspaceId: string;
    membershipId: string;
    userId: string;
    secret: string;
  }): Promise<void>;
}
