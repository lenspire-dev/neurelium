import type { Timestamps } from './common';
import type { UserId, WorkspaceId } from './identifiers';

/**
 * Tenant boundary. Every other entity carries `workspaceId`, so team
 * membership can be introduced later without migrating existing rows.
 */
export interface Workspace extends Timestamps {
  readonly id: WorkspaceId;
  readonly name: string;
  readonly ownerId: UserId;
}
