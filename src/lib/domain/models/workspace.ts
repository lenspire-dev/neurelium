import type { Timestamps } from './common';
import type { CategoryOverrideMode } from './category-status';
import type { UserId, WorkspaceId } from './identifiers';

export type WorkspaceDefaultView = 'day' | 'week';
export type WorkspaceWeekStart = 'monday' | 'sunday';

/**
 * Tenant boundary. Every other entity carries `workspaceId`, so team
 * membership can be introduced later without migrating existing rows.
 */
export interface Workspace extends Timestamps {
  readonly id: WorkspaceId;
  readonly name: string;
  readonly ownerId: UserId;
  readonly defaultView?: WorkspaceDefaultView;
  readonly weekStartsOn?: WorkspaceWeekStart;
  readonly categoryOverrideMode?: CategoryOverrideMode;
}
