import { addDays, daysBetween, endOfWeek, isWithinDateRange } from '../../domain/algorithms/week';
import type { IsoDate, WeekStart } from '../../domain/models/common';
import type { TaskId, WeeklyPoolEntryId, WorkspaceId } from '../../domain/models/identifiers';
import { asWeeklyPoolEntryId } from '../../domain/models/identifiers';
import type { WeeklyPoolEntry } from '../../domain/models/planning';
import type { Task } from '../../domain/models/hierarchy';
import type { ActivityLogRepository } from '../../domain/ports/activity-log-repository';
import type { ClockPort } from '../../domain/ports/clock-port';
import type { IdGeneratorPort } from '../../domain/ports/id-generator-port';
import type { TaskRepository } from '../../domain/ports/task-repository';
import type { WeeklyPoolRepository } from '../../domain/ports/weekly-pool-repository';
import { NotFoundError, ValidationError } from '../errors';
import { requireIsoDate, requireWeekStart } from '../validation';
import { setTaskStatus } from './hierarchy';

export interface PlanningDependencies {
  readonly weeklyPool: WeeklyPoolRepository;
  readonly tasks: TaskRepository;
  readonly activityLogs: ActivityLogRepository;
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
}

export interface AddTaskToWeekInput {
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly weekStart: WeekStart;
  readonly plannedDate?: IsoDate | null;
}

export async function addTaskToWeek(
  deps: PlanningDependencies,
  input: AddTaskToWeekInput
): Promise<WeeklyPoolEntry> {
  const weekStart = requireWeekStart(input.weekStart, 'Week start');
  const plannedDate = input.plannedDate ?? null;
  if (plannedDate !== null) requireDateInWeek(plannedDate, weekStart);

  const task = await deps.tasks.findById(input.workspaceId, input.taskId);
  if (task === null) throw new NotFoundError('Task not found.');

  return deps.weeklyPool.save({
    id: asWeeklyPoolEntryId(deps.ids.next()),
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    weekStart,
    plannedDate,
    status: 'todo',
    completedDate: null,
    createdAt: deps.clock.now().toISOString(),
  });
}

export interface MoveWeeklyPoolEntryInput {
  readonly workspaceId: WorkspaceId;
  readonly entryId: WeeklyPoolEntryId;
  readonly weekStart: WeekStart;
}

export async function moveWeeklyPoolEntry(
  deps: PlanningDependencies,
  input: MoveWeeklyPoolEntryInput
): Promise<WeeklyPoolEntry> {
  const weekStart = requireWeekStart(input.weekStart, 'Week start');

  const entry = await deps.weeklyPool.findById(input.workspaceId, input.entryId);
  if (entry === null) throw new NotFoundError('Weekly pool entry not found.');
  if (entry.weekStart === weekStart) return entry;

  return deps.weeklyPool.save({
    ...entry,
    weekStart,
    plannedDate:
      entry.plannedDate === null
        ? null
        : addDays(entry.plannedDate, daysBetween(entry.weekStart, weekStart))
  });
}

export interface ScheduleWeeklyPoolEntryInput {
  readonly workspaceId: WorkspaceId;
  readonly entryId: WeeklyPoolEntryId;
  readonly plannedDate: IsoDate | null;
}

export async function scheduleWeeklyPoolEntry(
  deps: PlanningDependencies,
  input: ScheduleWeeklyPoolEntryInput
): Promise<WeeklyPoolEntry> {
  const entry = await deps.weeklyPool.findById(input.workspaceId, input.entryId);
  if (entry === null) throw new NotFoundError('Weekly pool entry not found.');
  if (input.plannedDate !== null) requireDateInWeek(input.plannedDate, entry.weekStart);
  if (entry.plannedDate === input.plannedDate) return entry;
  return deps.weeklyPool.save({ ...entry, plannedDate: input.plannedDate });
}

export interface RemoveWeeklyPoolEntryInput {
  readonly workspaceId: WorkspaceId;
  readonly entryId: WeeklyPoolEntryId;
}

export interface RemoveWeeklyPoolEntryResult {
  readonly task: Task | null;
}

export async function removeWeeklyPoolEntry(
  deps: PlanningDependencies,
  input: RemoveWeeklyPoolEntryInput
): Promise<RemoveWeeklyPoolEntryResult> {
  const entry = await deps.weeklyPool.findById(input.workspaceId, input.entryId);
  if (entry === null) throw new NotFoundError('Weekly pool entry not found.');

  const logs = await deps.activityLogs.listByTask(input.workspaceId, entry.taskId);
  for (const log of logs) {
    if (log.entryId === entry.id) {
      await deps.activityLogs.delete(input.workspaceId, log.id);
    }
  }

  const task = await deps.tasks.findById(input.workspaceId, entry.taskId);
  const resetTask =
    task === null || task.status === 'todo'
      ? task
      : await setTaskStatus(deps, {
          workspaceId: input.workspaceId,
          taskId: entry.taskId,
          status: 'todo',
        });

  await deps.weeklyPool.delete(input.workspaceId, input.entryId);
  return { task: resetTask };
}

export interface WeekRolloverPreview {
  readonly incomplete: readonly WeeklyPoolEntry[];
  readonly completed: readonly WeeklyPoolEntry[];
}

export async function previewWeekRollover(
  deps: PlanningDependencies,
  input: { readonly workspaceId: WorkspaceId; readonly weekStart: WeekStart }
): Promise<WeekRolloverPreview> {
  const weekStart = requireWeekStart(input.weekStart, 'Week start');
  const entries = await deps.weeklyPool.listByWeek(input.workspaceId, weekStart);
  const logs = await deps.activityLogs.listByDateRange(
    input.workspaceId,
    weekStart,
    endOfWeek(weekStart)
  );
  const completedTaskIds = new Set(logs.map((log) => log.taskId));
  const isDone = (entry: WeeklyPoolEntry) =>
    entry.status === 'done' ||
    (entry.status === 'todo' && completedTaskIds.has(entry.taskId));

  return {
    incomplete: entries.filter((entry) => !isDone(entry) && entry.status !== 'skipped'),
    completed: entries.filter(isDone),
  };
}

export interface RolloverWeekInput {
  readonly workspaceId: WorkspaceId;
  readonly fromWeekStart: WeekStart;
  readonly toWeekStart: WeekStart;
}

export async function rolloverWeek(
  deps: PlanningDependencies,
  input: RolloverWeekInput
): Promise<readonly WeeklyPoolEntry[]> {
  const fromWeekStart = requireWeekStart(input.fromWeekStart, 'Source week start');
  const toWeekStart = requireWeekStart(input.toWeekStart, 'Target week start');
  if (toWeekStart <= fromWeekStart) {
    throw new ValidationError('Tasks can only be rolled forward.');
  }

  const preview = await previewWeekRollover(deps, {
    workspaceId: input.workspaceId,
    weekStart: fromWeekStart,
  });
  const moved: WeeklyPoolEntry[] = [];
  // shortcut: moves are sequential; Phase 3 should wrap this in a backend transaction.
  const dayOffset = daysBetween(fromWeekStart, toWeekStart);
  for (const entry of preview.incomplete) {
    moved.push(
      await deps.weeklyPool.save({
        ...entry,
        weekStart: toWeekStart,
        plannedDate: entry.plannedDate === null ? null : addDays(entry.plannedDate, dayOffset)
      })
    );
  }

  return moved;
}

function requireDateInWeek(value: IsoDate, weekStart: WeekStart): IsoDate {
  const date = requireIsoDate(value, 'Planned date');
  if (!isWithinDateRange(date, weekStart, endOfWeek(weekStart))) {
    throw new ValidationError('Planned date must fall within the selected week.');
  }
  return date;
}
