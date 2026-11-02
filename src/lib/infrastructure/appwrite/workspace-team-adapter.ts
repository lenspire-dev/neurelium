import { Query, Teams, type Models } from 'appwrite';
import type { WorkspaceTeamPort } from '../../domain/ports/workspace-team-port';
import {
  workspaceRoleFromRoles,
  type WorkspaceMember,
  type WorkspaceRole
} from '../../domain/models/workspace-member';
import type { Workspace } from '../../domain/models/workspace';
import { isNotFoundError } from './errors';

const PAGE_SIZE = 100;
const CUSTOM_ROLES = ['admin', 'member', 'viewer'] as const;

export class AppwriteWorkspaceTeamAdapter implements WorkspaceTeamPort {
  constructor(private readonly teams: Teams) {}

  async ensureTeam(workspace: Workspace): Promise<boolean> {
    try {
      await this.teams.get({ teamId: workspace.id });
      return false;
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      await this.teams.create({
        teamId: workspace.id,
        name: workspace.name,
        roles: [...CUSTOM_ROLES]
      });
      return true;
    }
  }

  async renameTeam(workspace: Workspace): Promise<void> {
    await this.teams.updateName({ teamId: workspace.id, name: workspace.name });
  }

  async deleteTeam(workspace: Workspace): Promise<void> {
    await this.teams.delete({ teamId: workspace.id });
  }

  async listMembers(workspace: Workspace): Promise<readonly WorkspaceMember[]> {
    const members: WorkspaceMember[] = [];
    let offset = 0;

    while (true) {
      const page = await this.teams.listMemberships({
        teamId: workspace.id,
        queries: [Query.limit(PAGE_SIZE), Query.offset(offset)]
      });
      members.push(...page.memberships.map(toMember));
      if (page.memberships.length < PAGE_SIZE) return members;
      offset += PAGE_SIZE;
    }
  }

  async invite(
    workspace: Workspace,
    email: string,
    role: Exclude<WorkspaceRole, 'owner'>,
    redirectUrl: string
  ): Promise<void> {
    await this.teams.createMembership({
      teamId: workspace.id,
      roles: [role],
      email: email.trim(),
      url: redirectUrl
    });
  }

  async updateRole(
    workspace: Workspace,
    membershipId: string,
    role: Exclude<WorkspaceRole, 'owner'>
  ): Promise<void> {
    await this.teams.updateMembership({
      teamId: workspace.id,
      membershipId,
      roles: [role]
    });
  }

  async removeMember(workspace: Workspace, membershipId: string): Promise<void> {
    await this.teams.deleteMembership({ teamId: workspace.id, membershipId });
  }

  async acceptInvitation(input: {
    workspaceId: string;
    membershipId: string;
    userId: string;
    secret: string;
  }): Promise<void> {
    await this.teams.updateMembershipStatus({
      teamId: input.workspaceId,
      membershipId: input.membershipId,
      userId: input.userId,
      secret: input.secret
    });
  }
}

function toMember(membership: Models.Membership): WorkspaceMember {
  return {
    membershipId: membership.$id,
    userId: membership.userId,
    name: membership.userName || 'Pending invite',
    email: membership.userEmail,
    role: workspaceRoleFromRoles(membership.roles),
    joinedAt: membership.joined ?? null,
    invited: !membership.confirm
  };
}
