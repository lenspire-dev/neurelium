import type { Category } from '../models/hierarchy';
import type { CategoryId, WorkspaceId } from '../models/identifiers';

export interface CategoryRepository {
  findById(workspaceId: WorkspaceId, categoryId: CategoryId): Promise<Category | null>;
  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Category[]>;
  listChildren(
    workspaceId: WorkspaceId,
    parentId: CategoryId | null
  ): Promise<readonly Category[]>;
  save(category: Category): Promise<Category>;
  delete(workspaceId: WorkspaceId, categoryId: CategoryId): Promise<void>;
}
