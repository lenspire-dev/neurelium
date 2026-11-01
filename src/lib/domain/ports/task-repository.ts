import type { Task } from '../models/hierarchy';
import type { TaskId, TopicId, WorkspaceId } from '../models/identifiers';

export interface TaskRepository {
  findById(workspaceId: WorkspaceId, taskId: TaskId): Promise<Task | null>;
  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Task[]>;
  listByTopic(workspaceId: WorkspaceId, topicId: TopicId): Promise<readonly Task[]>;
  save(task: Task): Promise<Task>;
  delete(workspaceId: WorkspaceId, taskId: TaskId): Promise<void>;
}
