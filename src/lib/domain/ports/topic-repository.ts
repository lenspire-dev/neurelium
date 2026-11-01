import type { Topic } from '../models/hierarchy';
import type { CategoryId, TopicId, WorkspaceId } from '../models/identifiers';

export interface TopicRepository {
  findById(workspaceId: WorkspaceId, topicId: TopicId): Promise<Topic | null>;
  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Topic[]>;
  listByCategory(
    workspaceId: WorkspaceId,
    categoryId: CategoryId
  ): Promise<readonly Topic[]>;
  save(topic: Topic): Promise<Topic>;
  delete(workspaceId: WorkspaceId, topicId: TopicId): Promise<void>;
}
