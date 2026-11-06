import { collectCategorySubtreeIds } from '../../domain/algorithms/hierarchy';
import type { CategoryId, TaskId, WorkspaceId } from '../../domain/models/identifiers';
import type { ActivityLogRepository } from '../../domain/ports/activity-log-repository';
import type { CategoryRepository } from '../../domain/ports/category-repository';
import type { TaskRepository } from '../../domain/ports/task-repository';
import type { TopicRepository } from '../../domain/ports/topic-repository';
import type { WeeklyPoolRepository } from '../../domain/ports/weekly-pool-repository';
import { NotFoundError } from '../errors';

export interface DeletionDependencies {
  readonly categories: CategoryRepository;
  readonly topics: TopicRepository;
  readonly tasks: TaskRepository;
  readonly weeklyPool: WeeklyPoolRepository;
  readonly activityLogs: ActivityLogRepository;
}

export interface DeleteTaskInput {
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
}

export async function deleteTask(
  deps: DeletionDependencies,
  input: DeleteTaskInput
): Promise<void> {
  const task = await deps.tasks.findById(input.workspaceId, input.taskId);
  if (task === null) throw new NotFoundError('Task not found.');

  await deleteTaskContent(
    deps,
    input.workspaceId,
    new Set<TaskId>([input.taskId])
  );
  await deps.tasks.delete(input.workspaceId, input.taskId);
}

export interface DeleteCategoryInput {
  readonly workspaceId: WorkspaceId;
  readonly categoryId: CategoryId;
}

export async function deleteCategorySubtree(
  deps: DeletionDependencies,
  input: DeleteCategoryInput
): Promise<void> {
  const category = await deps.categories.findById(
    input.workspaceId,
    input.categoryId
  );
  if (category === null) throw new NotFoundError('Category not found.');

  const categories = await deps.categories.listByWorkspace(input.workspaceId);
  const categoryIds = collectCategorySubtreeIds(input.categoryId, categories);

  const topics = await deps.topics.listByWorkspace(input.workspaceId);
  const topicIds = new Set(
    topics
      .filter((topic) => categoryIds.has(topic.categoryId))
      .map((topic) => topic.id)
  );

  const tasks = await deps.tasks.listByWorkspace(input.workspaceId);
  const taskIds = new Set(
    tasks
      .filter((task) => topicIds.has(task.topicId))
      .map((task) => task.id)
  );

  await deleteTaskContent(deps, input.workspaceId, taskIds);

  for (const taskId of taskIds) {
    await deps.tasks.delete(input.workspaceId, taskId);
  }
  for (const topicId of topicIds) {
    await deps.topics.delete(input.workspaceId, topicId);
  }
  for (const categoryId of categoryIds) {
    await deps.categories.delete(input.workspaceId, categoryId);
  }
}

async function deleteTaskContent(
  deps: DeletionDependencies,
  workspaceId: WorkspaceId,
  taskIds: ReadonlySet<TaskId>
): Promise<void> {
  if (taskIds.size === 0) return;

  const entries = await deps.weeklyPool.listByWorkspace(workspaceId);
  const entryIds = new Set(
    entries
      .filter((entry) => taskIds.has(entry.taskId))
      .map((entry) => entry.id)
  );

  const logs = await deps.activityLogs.listByWorkspace(workspaceId);
  for (const log of logs) {
    if (
      taskIds.has(log.taskId) ||
      (log.entryId !== null && entryIds.has(log.entryId))
    ) {
      await deps.activityLogs.delete(workspaceId, log.id);
    }
  }

  for (const entry of entries) {
    if (entryIds.has(entry.id)) {
      await deps.weeklyPool.delete(workspaceId, entry.id);
    }
  }
}
