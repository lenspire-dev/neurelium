import type { IsoDateTime, WorkspaceScoped } from './common';
import type { ActivityEventId, UserId } from './identifiers';

export const ACTIVITY_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'scheduled',
  'unscheduled',
  'moved',
  'completed',
  'uncompleted',
  'status_changed',
  'imported',
  'member_invited',
  'member_joined',
  'member_removed',
  'role_changed'
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ACTIVITY_ENTITY_TYPES = [
  'workspace',
  'category',
  'topic',
  'task',
  'weekly_entry',
  'completion',
  'milestone',
  'import',
  'member',
  'invitation'
] as const;

export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

/** Immutable workspace event with names captured at the time it happened. */
export interface ActivityEvent extends WorkspaceScoped {
  readonly id: ActivityEventId;
  readonly actorId: UserId;
  readonly actorName: string;
  readonly action: ActivityAction;
  readonly entityType: ActivityEntityType;
  readonly entityId: string;
  readonly entityName: string;
  readonly contextName: string | null;
  readonly detail: string | null;
  readonly createdAt: IsoDateTime;
}

export function isActivityAction(value: unknown): value is ActivityAction {
  return typeof value === 'string' && (ACTIVITY_ACTIONS as readonly string[]).includes(value);
}

export function isActivityEntityType(value: unknown): value is ActivityEntityType {
  return (
    typeof value === 'string' &&
    (ACTIVITY_ENTITY_TYPES as readonly string[]).includes(value)
  );
}
