import type { IsoDateTime } from './common';

export const WORKSPACE_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export interface WorkspaceMember {
  readonly membershipId: string;
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly role: WorkspaceRole;
  readonly joinedAt: IsoDateTime | null;
  readonly invited: boolean;
}

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return typeof value === 'string' && (WORKSPACE_ROLES as readonly string[]).includes(value);
}

export function workspaceRoleFromRoles(roles: readonly string[]): WorkspaceRole {
  if (roles.includes('owner')) return 'owner';
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('viewer')) return 'viewer';
  return 'member';
}
