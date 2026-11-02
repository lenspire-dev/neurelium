import type { ActivityEvent } from '../models/activity';
import type { WorkspaceId } from '../models/identifiers';

export interface ActivityEventRepository {
  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly ActivityEvent[]>;
  save(event: ActivityEvent): Promise<ActivityEvent>;
}
