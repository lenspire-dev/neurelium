import type { IsoDate, Timestamps, WorkspaceScoped } from './common';
import type { Category, Task, Topic } from './hierarchy';
import type { CategoryId, MilestoneId, TaskId, TopicId } from './identifiers';

export type MilestoneScope =
  | { readonly kind: 'category'; readonly categoryId: CategoryId }
  | { readonly kind: 'topic'; readonly topicId: TopicId };

/** Long-term goal. Progress is weighted by task weight, never raw task count. */
export interface Milestone extends WorkspaceScoped, Timestamps {
  readonly id: MilestoneId;
  readonly title: string;
  readonly scope: MilestoneScope;
  /** Target completion of the scope, between 0 and 100. */
  readonly targetPercentage: number;
  readonly dueDate: IsoDate;
}

export type PaceStatus = 'ahead' | 'on-track' | 'behind';

export interface MilestoneProgress {
  readonly milestoneId: MilestoneId;
  readonly completedWeight: number;
  readonly totalWeight: number;
  readonly completedTaskCount: number;
  readonly totalTaskCount: number;
  /** Raw weight completed in the scope, independent of the milestone target. */
  readonly completionPercentage: number;
  /** Completion measured against the milestone target, e.g. 25% out of 50%. */
  readonly targetProgressPercentage: number;
  readonly targetPercentage: number;
  readonly elapsedPercentage: number;
  readonly pace: PaceStatus;
}

export interface StudyRecommendation {
  readonly task: Task;
  readonly topic: Topic;
  readonly category: Category;
  readonly score: number;
  /** Human-readable reason, shown in the UI to keep the algorithm transparent. */
  readonly explanation: string;
}

export interface RecommendationResult {
  readonly primary: StudyRecommendation | null;
  readonly alternatives: readonly StudyRecommendation[];
}
