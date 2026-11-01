import { endOfWeek, isWithinDateRange } from '../../domain/algorithms/week';
import type { IsoDate, WeekStart } from '../../domain/models/common';
import type { ActivityLog } from '../../domain/models/execution';
import type { TaskId, WorkspaceId } from '../../domain/models/identifiers';
import { asActivityLogId } from '../../domain/models/identifiers';
import type { ActivityLogRepository } from '../../domain/ports/activity-log-repository';
import type { ClockPort } from '../../domain/ports/clock-port';
import type { IdGeneratorPort } from '../../domain/ports/id-generator-port';
import type { TaskRepository } from '../../domain/ports/task-repository';
import type { WeeklyPoolRepository } from '../../domain/ports/weekly-pool-repository';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import { setTaskStatus } from './hierarchy';
import {
  optionalNote,
  requireIsoDate,
  requireWeekStart,
} from '../validation';

export interface ExecutionDependencies {
  readonly tasks: TaskRepository;
  readonly weeklyPool: WeeklyPoolRepository;
  readonly activityLogs: ActivityLogRepository;
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
}

export interface CompleteTaskInput {
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly weekStart: WeekStart;
  readonly completedDate: IsoDate;
  readonly note?: string;
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

  const entries = await deps.weeklyPool.listByTask(input.workspaceId, input.taskId);
  if (!entries.some((entry) => entry.weekStart === weekStart)) {
    throw new ValidationError('Task is not in the selected week pool.');
  }

  const existingLogs = await deps.activityLogs.listByTask(
    input.workspaceId,
    input.taskId
  );
  if (
    existingLogs.some((log) =>
      isWithinDateRange(log.completedDate, weekStart, endOfWeek(weekStart))
    )
  ) {
    throw new ConflictError('Task is already completed for this week.');
  }

  const log = await deps.activityLogs.save({
    id: asActivityLogId(deps.ids.next()),
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    completedDate,
    note: optionalNote(input.note),
    createdAt: deps.clock.now().toISOString(),
  });

  await setTaskStatus(deps, {
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    status: 'done',
    doneDate: completedDate,
  });

  return log;
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
