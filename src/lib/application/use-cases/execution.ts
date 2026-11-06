import { endOfWeek, isWithinDateRange } from '../../domain/algorithms/week';
import type { IsoDate, WeekStart } from '../../domain/models/common';
import type { ActivityLog } from '../../domain/models/execution';
import type { Task } from '../../domain/models/hierarchy';
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
import { setTaskStatus } from './hierarchy';

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

  const log = await saveCompletionLog(deps, {
    workspaceId: input.workspaceId,
    task,
    entryId: entry.id,
    completedDate,
    note: input.note,
  });

  await deps.weeklyPool.save({
    ...entry,
    status: 'done',
    completedDate,
  });

  await setTaskStatus(deps, {
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    status: 'done',
    doneDate: completedDate,
  });

  return log;
}

async function saveCompletionLog(
  deps: ExecutionDependencies,
  input: {
    readonly workspaceId: WorkspaceId;
    readonly task: Task;
    readonly entryId: WeeklyPoolEntryId;
    readonly completedDate: IsoDate;
    readonly note?: string | undefined;
  }
): Promise<ActivityLog> {
  const topic =
    deps.topics === undefined
      ? null
      : await deps.topics.findById(input.workspaceId, input.task.topicId);
  const category =
    topic === null || deps.categories === undefined
      ? null
      : await deps.categories.findById(input.workspaceId, topic.categoryId);

  return deps.activityLogs.save({
    id: asActivityLogId(deps.ids.next()),
    workspaceId: input.workspaceId,
    taskId: input.task.id,
    entryId: input.entryId,
    completedDate: input.completedDate,
    taskName: input.task.title,
    topicName: topic?.name ?? null,
    categoryName: category?.name ?? null,
    note: optionalNote(input.note),
    createdAt: deps.clock.now().toISOString(),
  });
}

export interface RepeatTaskCompletionInput {
  readonly workspaceId: WorkspaceId;
  readonly entryId: WeeklyPoolEntryId;
  readonly completedDate?: IsoDate;
  readonly note?: string;
}

/** Logs another completion of the same weekly occurrence on the same day. */
export async function repeatTaskCompletion(
  deps: ExecutionDependencies,
  input: RepeatTaskCompletionInput
): Promise<ActivityLog> {
  const entry = await deps.weeklyPool.findById(input.workspaceId, input.entryId);
  if (entry === null) throw new NotFoundError('Weekly pool entry not found.');
  if (entry.status !== 'done' || entry.completedDate === null) {
    throw new ValidationError('Complete this occurrence before adding repeats.');
  }

  const completedDate = requireIsoDate(
    input.completedDate ?? entry.completedDate,
    'Completed date'
  );
  if (!isWithinDateRange(completedDate, entry.weekStart, endOfWeek(entry.weekStart))) {
    throw new ValidationError('Completed date must fall inside the planned week.');
  }

  const task = await deps.tasks.findById(input.workspaceId, entry.taskId);
  if (task === null) throw new NotFoundError('Task not found.');

  return saveCompletionLog(deps, {
    workspaceId: input.workspaceId,
    task,
    entryId: entry.id,
    completedDate,
    note: input.note,
  });
}

export interface RemoveRepeatedCompletionInput {
  readonly workspaceId: WorkspaceId;
  readonly entryId: WeeklyPoolEntryId;
}

/** Removes the newest repeat, keeping the occurrence itself completed. */
export async function removeRepeatedCompletion(
  deps: Pick<ExecutionDependencies, 'weeklyPool' | 'activityLogs'>,
  input: RemoveRepeatedCompletionInput
): Promise<ActivityLog> {
  const entry = await deps.weeklyPool.findById(input.workspaceId, input.entryId);
  if (entry === null) throw new NotFoundError('Weekly pool entry not found.');

  const logs = (await deps.activityLogs.listByTask(input.workspaceId, entry.taskId))
    .filter((log) => log.entryId === entry.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const latest = logs.at(-1);
  if (logs.length <= 1 || latest === undefined) {
    throw new ValidationError('Change the status instead of removing the only completion.');
  }

  await deps.activityLogs.delete(input.workspaceId, latest.id);
  return latest;
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
): Promise<{ entry: WeeklyPoolEntry; log: ActivityLog | null; task: Task | null }> {
  const entry = await deps.weeklyPool.findById(input.workspaceId, input.entryId);
  if (entry === null) throw new NotFoundError('Weekly pool entry not found.');

  if (input.status === 'done') {
    if (entry.status === 'done') {
      return {
        entry,
        log: null,
        task: await deps.tasks.findById(input.workspaceId, entry.taskId)
      };
    }
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
      log,
      task: await deps.tasks.findById(input.workspaceId, entry.taskId)
    };
  }

  const wasCompleted = entry.status === 'done' || entry.completedDate !== null;
  await removeEntryCompletion(deps, input.workspaceId, entry);
  const remainingLogs = await deps.activityLogs.listByTask(
    input.workspaceId,
    entry.taskId
  );
  const task = await deps.tasks.findById(input.workspaceId, entry.taskId);
  const updatedTask =
    wasCompleted &&
    remainingLogs.length === 0 &&
    task !== null &&
    task.status === 'done'
      ? await setTaskStatus(deps, {
          workspaceId: input.workspaceId,
          taskId: entry.taskId,
          status: 'todo',
        })
      : task;

  return {
    entry: await deps.weeklyPool.save({
      ...entry,
      status: input.status,
      completedDate: null
    }),
    log: null,
    task: updatedTask
  };
}

export interface RemoveWeekCompletionInput {
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly weekStart: WeekStart;
}

export async function removeWeekCompletion(
  deps: Pick<ExecutionDependencies, 'activityLogs' | 'tasks' | 'clock'>,
  input: RemoveWeekCompletionInput
): Promise<void> {
  const end = endOfWeek(input.weekStart);
  const logs = await deps.activityLogs.listByTask(input.workspaceId, input.taskId);
  let removed = false;
  for (const log of logs) {
    if (isWithinDateRange(log.completedDate, input.weekStart, end)) {
      await deps.activityLogs.delete(input.workspaceId, log.id);
      removed = true;
    }
  }
  if (!removed) return;

  const remaining = await deps.activityLogs.listByTask(
    input.workspaceId,
    input.taskId
  );
  const task = await deps.tasks.findById(input.workspaceId, input.taskId);
  if (remaining.length === 0 && task !== null && task.status === 'done') {
    await setTaskStatus(deps, {
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      status: 'todo',
    });
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
