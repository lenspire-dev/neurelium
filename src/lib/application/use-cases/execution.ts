import { endOfWeek, isWithinDateRange } from '../../domain/algorithms/week';
import type { IsoDate, WeekStart } from '../../domain/models/common';
import type { ActivityLog } from '../../domain/models/execution';
import type { TaskId, WeeklyPoolEntryId, WorkspaceId } from '../../domain/models/identifiers';
import { asActivityLogId } from '../../domain/models/identifiers';
import type { WeeklyPoolEntry } from '../../domain/models/planning';
import type { TaskStatus } from '../../domain/models/task-status';
import type { ActivityLogRepository } from '../../domain/ports/activity-log-repository';
import type { CategoryRepository } from '../../domain/ports/category-repository';
import type { ClockPort } from '../../domain/ports/clock-port';
import type { IdGeneratorPort } from '../../domain/ports/id-generator-port';
import type { TaskRepository } from '../../domain/ports/task-repository';
import type { TopicRepository } from '../../domain/ports/topic-repository';
import type { WeeklyPoolRepository } from '../../domain/ports/weekly-pool-repository';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import { optionalNote, requireIsoDate, requireWeekStart } from '../validation';

export interface ExecutionDependencies {
  readonly tasks: TaskRepository;
  readonly weeklyPool: WeeklyPoolRepository;
  readonly activityLogs: ActivityLogRepository;
  readonly topics?: TopicRepository;
  readonly categories?: CategoryRepository;
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
}

export interface CompleteTaskInput {
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly weekStart: WeekStart;
  readonly completedDate: IsoDate;
  readonly note?: string;
  readonly entryId?: WeeklyPoolEntryId;
}

export async function completeTask(
  deps: ExecutionDependencies,
  input: CompleteTaskInput
): Promise<ActivityLog> {
  const weekStart = requireWeekStart(input.weekStart, 'Week start');
  const completedDate = requireIsoDate(input.completedDate, 'Completed date');

  if (!isWithinDateRange(completedDate, weekStart, endOfWeek(weekStart))) {
    throw new ValidationError('Completed date must fall inside the planned week.');
  }

  const task = await deps.tasks.findById(input.workspaceId, input.taskId);
  if (task === null) throw new NotFoundError('Task not found.');

  const entry = await resolveEntry(deps, input, weekStart);
  if (entry.completedDate !== null) {
    throw new ConflictError('This task occurrence is already completed.');
  }

  const existingLogs = await deps.activityLogs.listByTask(
    input.workspaceId,
    input.taskId
  );
  if (
    existingLogs.some(
      (log) =>
        log.entryId === entry.id ||
        (log.entryId === null &&
          isWithinDateRange(log.completedDate, weekStart, endOfWeek(weekStart)))
    )
  ) {
    throw new ConflictError('This task occurrence is already completed.');
  }

  const topic =
    deps.topics === undefined
      ? null
      : await deps.topics.findById(input.workspaceId, task.topicId);
  const category =
    topic === null || deps.categories === undefined
      ? null
      : await deps.categories.findById(input.workspaceId, topic.categoryId);

  const log = await deps.activityLogs.save({
    id: asActivityLogId(deps.ids.next()),
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    entryId: entry.id,
    completedDate,
    taskName: task.title,
    topicName: topic?.name ?? null,
    categoryName: category?.name ?? null,
    note: optionalNote(input.note),
    createdAt: deps.clock.now().toISOString(),
  });

  await deps.weeklyPool.save({
    ...entry,
    status: 'done',
    completedDate,
  });

  return log;
}

async function resolveEntry(
  deps: Pick<ExecutionDependencies, 'weeklyPool'>,
  input: CompleteTaskInput,
  weekStart: WeekStart
): Promise<WeeklyPoolEntry> {
  if (input.entryId !== undefined) {
    const entry = await deps.weeklyPool.findById(input.workspaceId, input.entryId);
    if (entry === null || entry.taskId !== input.taskId) {
      throw new NotFoundError('Weekly pool entry not found.');
    }
    if (entry.weekStart !== weekStart) {
      throw new ValidationError('Weekly pool entry is not in the selected week.');
    }
    return entry;
  }

  const entries = await deps.weeklyPool.listByTask(input.workspaceId, input.taskId);
  const entry =
    entries.find((item) => item.weekStart === weekStart && item.completedDate === null) ??
    entries.find((item) => item.weekStart === weekStart);
  if (entry === undefined) {
    throw new ValidationError('Task is not in the selected week pool.');
  }
  return entry;
}

export interface SetWeeklyEntryStatusInput {
  readonly workspaceId: WorkspaceId;
  readonly entryId: WeeklyPoolEntryId;
  readonly status: TaskStatus;
  readonly completedDate?: IsoDate;
}

/** Changes one occurrence without touching the task's own lifecycle status. */
export async function setWeeklyEntryStatus(
  deps: ExecutionDependencies,
  input: SetWeeklyEntryStatusInput
): Promise<{ entry: WeeklyPoolEntry; log: ActivityLog | null }> {
  const entry = await deps.weeklyPool.findById(input.workspaceId, input.entryId);
  if (entry === null) throw new NotFoundError('Weekly pool entry not found.');

  if (input.status === 'done') {
    if (entry.status === 'done') return { entry, log: null };
    const completedDate =
      input.completedDate ?? deps.clock.now().toISOString().slice(0, 10);
    const log = await completeTask(deps, {
      workspaceId: input.workspaceId,
      taskId: entry.taskId,
      weekStart: entry.weekStart,
      completedDate,
      entryId: entry.id,
    });
    return {
      entry: { ...entry, status: 'done', completedDate },
      log
    };
  }

  await removeEntryCompletion(deps, input.workspaceId, entry);
  return {
    entry: await deps.weeklyPool.save({
      ...entry,
      status: input.status,
      completedDate: null
    }),
    log: null
  };
}

export interface RemoveWeekCompletionInput {
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly weekStart: WeekStart;
}

export async function removeWeekCompletion(
  deps: Pick<ExecutionDependencies, 'activityLogs'>,
  input: RemoveWeekCompletionInput
): Promise<void> {
  const end = endOfWeek(input.weekStart);
  const logs = await deps.activityLogs.listByTask(input.workspaceId, input.taskId);
  for (const log of logs) {
    if (isWithinDateRange(log.completedDate, input.weekStart, end)) {
      await deps.activityLogs.delete(input.workspaceId, log.id);
    }
  }
}

async function removeEntryCompletion(
  deps: Pick<ExecutionDependencies, 'activityLogs'>,
  workspaceId: WorkspaceId,
  entry: WeeklyPoolEntry
): Promise<void> {
  const logs = await deps.activityLogs.listByTask(workspaceId, entry.taskId);
  for (const log of logs) {
    if (log.entryId === entry.id) {
      await deps.activityLogs.delete(workspaceId, log.id);
    }
  }
}
