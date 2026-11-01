/**
 * Branded IDs keep entity identifiers from being mixed up at compile time.
 * The value is opaque: Appwrite uses `$id`, a future backend may use UUIDs.
 */
declare const idBrand: unique symbol;

type BrandedId<T extends string> = string & { readonly [idBrand]: T };

export type UserId = BrandedId<'UserId'>;
export type WorkspaceId = BrandedId<'WorkspaceId'>;
export type CategoryId = BrandedId<'CategoryId'>;
export type TopicId = BrandedId<'TopicId'>;
export type TaskId = BrandedId<'TaskId'>;
export type WeeklyPoolEntryId = BrandedId<'WeeklyPoolEntryId'>;
export type ActivityLogId = BrandedId<'ActivityLogId'>;
export type MilestoneId = BrandedId<'MilestoneId'>;

export const asUserId = (value: string): UserId => value as UserId;
export const asWorkspaceId = (value: string): WorkspaceId => value as WorkspaceId;
export const asCategoryId = (value: string): CategoryId => value as CategoryId;
export const asTopicId = (value: string): TopicId => value as TopicId;
export const asTaskId = (value: string): TaskId => value as TaskId;
export const asWeeklyPoolEntryId = (value: string): WeeklyPoolEntryId =>
  value as WeeklyPoolEntryId;
export const asActivityLogId = (value: string): ActivityLogId => value as ActivityLogId;
export const asMilestoneId = (value: string): MilestoneId => value as MilestoneId;
