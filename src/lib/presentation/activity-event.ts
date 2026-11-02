import type { ActivityAction, ActivityEntityType } from '../domain/models/activity';

const ACTION_LABELS: Record<ActivityAction, string> = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  scheduled: 'Scheduled',
  unscheduled: 'Moved to to-do',
  moved: 'Moved to another week',
  completed: 'Completed',
  uncompleted: 'Completion removed',
  status_changed: 'Changed status',
  imported: 'Imported',
  member_invited: 'Invited member',
  member_joined: 'Joined workspace',
  member_removed: 'Removed member',
  role_changed: 'Changed role'
};

const ENTITY_LABELS: Record<ActivityEntityType, string> = {
  workspace: 'workspace',
  category: 'category',
  topic: 'topic',
  task: 'task',
  weekly_entry: 'week entry',
  completion: 'completion',
  milestone: 'milestone',
  import: 'import',
  member: 'member',
  invitation: 'invitation'
};

export function activityActionLabel(action: ActivityAction): string {
  return ACTION_LABELS[action];
}

export function activityEntityLabel(type: ActivityEntityType): string {
  return ENTITY_LABELS[type];
}

export function activityActionTone(action: ActivityAction): string {
  if (action === 'deleted' || action === 'uncompleted' || action === 'member_removed') {
    return 'text-destructive';
  }
  if (action === 'completed' || action === 'created') return 'text-emerald-600 dark:text-emerald-400';
  if (action === 'scheduled' || action === 'moved') return 'text-sky-600 dark:text-sky-400';
  return 'text-muted-foreground';
}
