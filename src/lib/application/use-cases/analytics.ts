import { calculateMilestoneProgress } from '../../domain/algorithms/milestone-progress';
import { recommendStudyTasks } from '../../domain/algorithms/recommendation';
import { endOfWeek } from '../../domain/algorithms/week';
import type {
  MilestoneProgress,
  RecommendationResult,
} from '../../domain/models/analytics';
import type { IsoDate, WeekStart } from '../../domain/models/common';
import type { MilestoneId, WorkspaceId } from '../../domain/models/identifiers';
import type { ActivityLogRepository } from '../../domain/ports/activity-log-repository';
import type { CategoryRepository } from '../../domain/ports/category-repository';
import type { MilestoneRepository } from '../../domain/ports/milestone-repository';
import type { TaskRepository } from '../../domain/ports/task-repository';
import type { TopicRepository } from '../../domain/ports/topic-repository';
import type { WeeklyPoolRepository } from '../../domain/ports/weekly-pool-repository';
import { NotFoundError } from '../errors';
import { requireIsoDate, requireWeekStart } from '../validation';

export interface RecommendationDependencies {
  readonly weeklyPool: WeeklyPoolRepository;
  readonly tasks: TaskRepository;
  readonly topics: TopicRepository;
  readonly categories: CategoryRepository;
  readonly activityLogs: ActivityLogRepository;
}

export interface GetStudyRecommendationInput {
  readonly workspaceId: WorkspaceId;
  readonly weekStart: WeekStart;
  readonly today: IsoDate;
  readonly limit?: number;
}

export async function getStudyRecommendation(
  deps: RecommendationDependencies,
  input: GetStudyRecommendationInput
): Promise<RecommendationResult> {
  const weekStart = requireWeekStart(input.weekStart, 'Week start');
  const today = requireIsoDate(input.today, 'Today');

  const [poolEntries, tasks, topics, categories, activityLogs] = await Promise.all([
    deps.weeklyPool.listByWeek(input.workspaceId, weekStart),
    deps.tasks.listByWorkspace(input.workspaceId),
    deps.topics.listByWorkspace(input.workspaceId),
    deps.categories.listByWorkspace(input.workspaceId),
    deps.activityLogs.listByDateRange(
      input.workspaceId,
      weekStart,
      endOfWeek(weekStart)
    ),
  ]);

  return recommendStudyTasks(
    {
      weekStart,
      today,
      poolEntries,
      tasks,
      topics,
      categories,
      activityLogs,
    },
    input.limit
  );
}

export interface MilestoneProgressDependencies {
  readonly milestones: MilestoneRepository;
  readonly categories: CategoryRepository;
  readonly topics: TopicRepository;
  readonly tasks: TaskRepository;
  readonly activityLogs: ActivityLogRepository;
}

export interface GetMilestoneProgressInput {
  readonly workspaceId: WorkspaceId;
  readonly milestoneId: MilestoneId;
  readonly today: IsoDate;
}

export async function getMilestoneProgress(
  deps: MilestoneProgressDependencies,
  input: GetMilestoneProgressInput
): Promise<MilestoneProgress> {
  const today = requireIsoDate(input.today, 'Today');

  const [milestone, categories, topics, tasks, activityLogs] = await Promise.all([
    deps.milestones.findById(input.workspaceId, input.milestoneId),
    deps.categories.listByWorkspace(input.workspaceId),
    deps.topics.listByWorkspace(input.workspaceId),
    deps.tasks.listByWorkspace(input.workspaceId),
    deps.activityLogs.listByWorkspace(input.workspaceId),
  ]);

  if (milestone === null) throw new NotFoundError('Milestone not found.');

  return calculateMilestoneProgress({
    milestone,
    today,
    categories,
    topics,
    tasks,
    activityLogs,
  });
}
