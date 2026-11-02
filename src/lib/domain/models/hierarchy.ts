import type { IsoDate, IsoDateTime, Timestamps, WorkspaceScoped } from './common';
import type { CategoryColor } from './category-color';
import type { CategoryStatus } from './category-status';
import type { CategoryId, TaskId, TopicId } from './identifiers';
import type { TaskStatus } from './task-status';

/** Self-referencing tree. `parentId: null` marks a root category. */
export interface Category extends WorkspaceScoped, Timestamps {
  readonly id: CategoryId;
  readonly parentId: CategoryId | null;
  readonly name: string;
  /** Optional emoji shown beside the category name. */
  readonly icon: string | null;
  /** Relative importance, used by the recommendation algorithm. */
  readonly importanceWeight: number;
  /** Manual status override; `null` uses the automatic task-derived status. */
  readonly statusOverride?: CategoryStatus | null;
  /** Picked accent color. `null` inherits the nearest ancestor, or a stable fallback. */
  readonly color: CategoryColor | null;
}

export interface Topic extends WorkspaceScoped, Timestamps {
  readonly id: TopicId;
  readonly categoryId: CategoryId;
  readonly name: string;
}

export interface Task extends WorkspaceScoped, Timestamps {
  readonly id: TaskId;
  readonly topicId: TopicId;
  readonly title: string;
  /** Optional emoji shown beside the task title. */
  readonly icon: string | null;
  /** Effort/weight of the task, used for progress and recommendations. */
  readonly taskWeight: number;
  readonly status: TaskStatus;
  readonly statusChangedAt: IsoDateTime | null;
  /** Calendar date the task was last marked done. */
  readonly doneDate: IsoDate | null;
}
