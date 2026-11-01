import { wouldCreateCategoryCycle } from '../../domain/algorithms/hierarchy';
import type {
  CategoryId,
  TaskId,
  TopicId,
  WorkspaceId,
} from '../../domain/models/identifiers';
import type { CategoryColor } from '../../domain/models/category-color';
import type { Category, Task, Topic } from '../../domain/models/hierarchy';
import { DEFAULT_TASK_STATUS, type TaskStatus } from '../../domain/models/task-status';
import {
  asCategoryId,
  asTaskId,
  asTopicId,
} from '../../domain/models/identifiers';
import type { CategoryRepository } from '../../domain/ports/category-repository';
import type { ClockPort } from '../../domain/ports/clock-port';
import type { IdGeneratorPort } from '../../domain/ports/id-generator-port';
import type { TaskRepository } from '../../domain/ports/task-repository';
import type { TopicRepository } from '../../domain/ports/topic-repository';
import { NotFoundError, ValidationError } from '../errors';
import {
  optionalCategoryColor,
  optionalIcon,
  optionalIsoDate,
  requireNonEmpty,
  requireTaskStatus,
  requireWeightGrade,
} from '../validation';

export interface HierarchyDependencies {
  readonly categories: CategoryRepository;
  readonly topics: TopicRepository;
  readonly tasks: TaskRepository;
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
}

export interface CreateCategoryInput {
  readonly workspaceId: WorkspaceId;
  readonly parentId: CategoryId | null;
  readonly name: string;
  readonly icon?: string | null;
  readonly color?: CategoryColor | null;
  readonly importanceWeight: number;
}

export async function createCategory(
  deps: HierarchyDependencies,
  input: CreateCategoryInput
): Promise<Category> {
  const name = requireNonEmpty(input.name, 'Category name');
  const icon = optionalIcon(input.icon, 'Category icon');
  const color = optionalCategoryColor(input.color, 'Category color');
  const importanceWeight = requireWeightGrade(
    input.importanceWeight,
    'Category importance weight'
  );

  if (input.parentId !== null) {
    const parent = await deps.categories.findById(input.workspaceId, input.parentId);
    if (parent === null) throw new NotFoundError('Parent category not found.');
  }

  const now = deps.clock.now().toISOString();
  return deps.categories.save({
    id: asCategoryId(deps.ids.next()),
    workspaceId: input.workspaceId,
    parentId: input.parentId,
    name,
    icon,
    color,
    importanceWeight,
    createdAt: now,
    updatedAt: now,
  });
}

export interface UpdateCategoryInput {
  readonly workspaceId: WorkspaceId;
  readonly categoryId: CategoryId;
  readonly name?: string;
  readonly icon?: string | null;
  readonly color?: CategoryColor | null | undefined;
  readonly importanceWeight?: number;
  readonly parentId?: CategoryId | null;
}

export async function updateCategory(
  deps: HierarchyDependencies,
  input: UpdateCategoryInput
): Promise<Category> {
  const existing = await deps.categories.findById(input.workspaceId, input.categoryId);
  if (existing === null) throw new NotFoundError('Category not found.');

  const name =
    input.name === undefined
      ? existing.name
      : requireNonEmpty(input.name, 'Category name');
  const icon =
    input.icon === undefined ? existing.icon : optionalIcon(input.icon, 'Category icon');
  const color =
    input.color === undefined
      ? existing.color
      : optionalCategoryColor(input.color, 'Category color');
  const importanceWeight =
    input.importanceWeight === undefined
      ? existing.importanceWeight
      : requireWeightGrade(input.importanceWeight, 'Category importance weight');

  let parentId = existing.parentId;
  if (input.parentId !== undefined) {
    if (input.parentId === existing.id) {
      throw new ValidationError('A category cannot be its own parent.');
    }

    if (input.parentId !== null) {
      const parent = await deps.categories.findById(input.workspaceId, input.parentId);
      if (parent === null) throw new NotFoundError('Parent category not found.');

      if (input.parentId !== existing.parentId) {
        const all = await deps.categories.listByWorkspace(input.workspaceId);
        if (wouldCreateCategoryCycle(existing.id, input.parentId, all)) {
          throw new ValidationError('Moving this category would create a cycle.');
        }
      }
    }

    parentId = input.parentId;
  }

  return deps.categories.save({
    ...existing,
    parentId,
    name,
    icon,
    color,
    importanceWeight,
    updatedAt: deps.clock.now().toISOString(),
  });
}

export interface CreateTopicInput {
  readonly workspaceId: WorkspaceId;
  readonly categoryId: CategoryId;
  readonly name: string;
}

export async function createTopic(
  deps: HierarchyDependencies,
  input: CreateTopicInput
): Promise<Topic> {
  const name = requireNonEmpty(input.name, 'Topic name');
  const category = await deps.categories.findById(input.workspaceId, input.categoryId);
  if (category === null) throw new NotFoundError('Category not found.');

  const now = deps.clock.now().toISOString();
  return deps.topics.save({
    id: asTopicId(deps.ids.next()),
    workspaceId: input.workspaceId,
    categoryId: input.categoryId,
    name,
    createdAt: now,
    updatedAt: now,
  });
}

export interface UpdateTopicInput {
  readonly workspaceId: WorkspaceId;
  readonly topicId: TopicId;
  readonly name?: string;
  readonly categoryId?: CategoryId;
}

export async function updateTopic(
  deps: HierarchyDependencies,
  input: UpdateTopicInput
): Promise<Topic> {
  const existing = await deps.topics.findById(input.workspaceId, input.topicId);
  if (existing === null) throw new NotFoundError('Topic not found.');

  const name =
    input.name === undefined ? existing.name : requireNonEmpty(input.name, 'Topic name');

  let categoryId = existing.categoryId;
  if (input.categoryId !== undefined && input.categoryId !== existing.categoryId) {
    const category = await deps.categories.findById(input.workspaceId, input.categoryId);
    if (category === null) throw new NotFoundError('Category not found.');
    categoryId = input.categoryId;
  }

  return deps.topics.save({
    ...existing,
    name,
    categoryId,
    updatedAt: deps.clock.now().toISOString(),
  });
}

export interface CreateTaskInput {
  readonly workspaceId: WorkspaceId;
  readonly topicId: TopicId;
  readonly title: string;
  readonly icon?: string | null;
  readonly taskWeight: number;
}

export async function createTask(
  deps: HierarchyDependencies,
  input: CreateTaskInput
): Promise<Task> {
  const title = requireNonEmpty(input.title, 'Task title');
  const icon = optionalIcon(input.icon, 'Task icon');
  const taskWeight = requireWeightGrade(input.taskWeight, 'Task weight');
  const topic = await deps.topics.findById(input.workspaceId, input.topicId);
  if (topic === null) throw new NotFoundError('Topic not found.');

  const now = deps.clock.now().toISOString();
  return deps.tasks.save({
    id: asTaskId(deps.ids.next()),
    workspaceId: input.workspaceId,
    topicId: input.topicId,
    title,
    icon,
    taskWeight,
    status: DEFAULT_TASK_STATUS,
    statusChangedAt: null,
    doneDate: null,
    createdAt: now,
    updatedAt: now,
  });
}

export interface SetTaskStatusInput {
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly status: TaskStatus;
  readonly doneDate?: string | null;
}

export type TaskStatusDependencies = Pick<HierarchyDependencies, 'tasks' | 'clock'>;

export async function setTaskStatus(
  deps: TaskStatusDependencies,
  input: SetTaskStatusInput
): Promise<Task> {
  const existing = await deps.tasks.findById(input.workspaceId, input.taskId);
  if (existing === null) throw new NotFoundError('Task not found.');

  const status = requireTaskStatus(input.status, 'Task status');
  const requestedDoneDate = optionalIsoDate(input.doneDate, 'Done date');
  if (requestedDoneDate !== null && status !== 'done') {
    throw new ValidationError('Done date is only available for done tasks.');
  }

  const now = deps.clock.now();
  const nowIso = now.toISOString();
  const doneDate =
    status === 'done'
      ? requestedDoneDate ?? existing.doneDate ?? nowIso.slice(0, 10)
      : null;

  return deps.tasks.save({
    ...existing,
    status,
    statusChangedAt:
      status === existing.status ? existing.statusChangedAt : nowIso,
    doneDate,
    updatedAt: nowIso,
  });
}

export interface UpdateTaskInput {
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly title?: string;
  readonly icon?: string | null;
  readonly taskWeight?: number;
  readonly topicId?: TopicId;
}

export async function updateTask(
  deps: HierarchyDependencies,
  input: UpdateTaskInput
): Promise<Task> {
  const existing = await deps.tasks.findById(input.workspaceId, input.taskId);
  if (existing === null) throw new NotFoundError('Task not found.');

  const title =
    input.title === undefined ? existing.title : requireNonEmpty(input.title, 'Task title');
  const icon =
    input.icon === undefined ? existing.icon : optionalIcon(input.icon, 'Task icon');
  const taskWeight =
    input.taskWeight === undefined
      ? existing.taskWeight
      : requireWeightGrade(input.taskWeight, 'Task weight');

  let topicId = existing.topicId;
  if (input.topicId !== undefined && input.topicId !== existing.topicId) {
    const topic = await deps.topics.findById(input.workspaceId, input.topicId);
    if (topic === null) throw new NotFoundError('Topic not found.');
    topicId = input.topicId;
  }

  return deps.tasks.save({
    ...existing,
    title,
    icon,
    taskWeight,
    topicId,
    updatedAt: deps.clock.now().toISOString(),
  });
}
