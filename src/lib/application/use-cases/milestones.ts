import type { Milestone, MilestoneScope } from '../../domain/models/analytics';
import type { MilestoneId, WorkspaceId } from '../../domain/models/identifiers';
import { asMilestoneId } from '../../domain/models/identifiers';
import type { CategoryRepository } from '../../domain/ports/category-repository';
import type { ClockPort } from '../../domain/ports/clock-port';
import type { IdGeneratorPort } from '../../domain/ports/id-generator-port';
import type { MilestoneRepository } from '../../domain/ports/milestone-repository';
import type { TopicRepository } from '../../domain/ports/topic-repository';
import { NotFoundError } from '../errors';
import {
  requireIsoDate,
  requireNonEmpty,
  requirePercentage,
} from '../validation';

export interface MilestoneDependencies {
  readonly milestones: MilestoneRepository;
  readonly categories: CategoryRepository;
  readonly topics: TopicRepository;
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
}

export interface CreateMilestoneInput {
  readonly workspaceId: WorkspaceId;
  readonly title: string;
  readonly scope: MilestoneScope;
  readonly targetPercentage: number;
  readonly dueDate: string;
}

export async function createMilestone(
  deps: MilestoneDependencies,
  input: CreateMilestoneInput
): Promise<Milestone> {
  const title = requireNonEmpty(input.title, 'Milestone title');
  const targetPercentage = requirePercentage(
    input.targetPercentage,
    'Milestone target percentage'
  );
  const dueDate = requireIsoDate(input.dueDate, 'Milestone due date');

  if (input.scope.kind === 'category') {
    const category = await deps.categories.findById(
      input.workspaceId,
      input.scope.categoryId
    );
    if (category === null) throw new NotFoundError('Milestone category not found.');
  } else {
    const topic = await deps.topics.findById(input.workspaceId, input.scope.topicId);
    if (topic === null) throw new NotFoundError('Milestone topic not found.');
  }

  const now = deps.clock.now().toISOString();
  return deps.milestones.save({
    id: asMilestoneId(deps.ids.next()),
    workspaceId: input.workspaceId,
    title,
    scope: input.scope,
    targetPercentage,
    dueDate,
    createdAt: now,
    updatedAt: now,
  });
}

export interface UpdateMilestoneInput {
  readonly workspaceId: WorkspaceId;
  readonly milestoneId: MilestoneId;
  readonly title?: string;
  readonly targetPercentage?: number;
  readonly dueDate?: string;
}

export async function updateMilestone(
  deps: MilestoneDependencies,
  input: UpdateMilestoneInput
): Promise<Milestone> {
  const existing = await deps.milestones.findById(
    input.workspaceId,
    input.milestoneId
  );
  if (existing === null) throw new NotFoundError('Milestone not found.');

  return deps.milestones.save({
    ...existing,
    title:
      input.title === undefined
        ? existing.title
        : requireNonEmpty(input.title, 'Milestone title'),
    targetPercentage:
      input.targetPercentage === undefined
        ? existing.targetPercentage
        : requirePercentage(input.targetPercentage, 'Milestone target percentage'),
    dueDate:
      input.dueDate === undefined
        ? existing.dueDate
        : requireIsoDate(input.dueDate, 'Milestone due date'),
    updatedAt: deps.clock.now().toISOString(),
  });
}

export async function deleteMilestone(
  deps: MilestoneDependencies,
  input: { readonly workspaceId: WorkspaceId; readonly milestoneId: MilestoneId }
): Promise<void> {
  const existing = await deps.milestones.findById(
    input.workspaceId,
    input.milestoneId
  );
  if (existing === null) throw new NotFoundError('Milestone not found.');
  await deps.milestones.delete(input.workspaceId, input.milestoneId);
}
