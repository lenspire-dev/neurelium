export const DEFAULT_APPWRITE_DATABASE_ID = 'neurelium';

export const APPWRITE_TABLES = {
  workspaces: 'workspaces',
  categories: 'categories',
  topics: 'topics',
  tasks: 'tasks',
  weeklyPoolEntries: 'weekly_pool_entries',
  activityLogs: 'activity_logs',
  activityEvents: 'activity_events',
  milestones: 'milestones'
} as const;

export type AppwriteTableId = (typeof APPWRITE_TABLES)[keyof typeof APPWRITE_TABLES];

export interface AppwriteColumn {
  readonly key: string;
  readonly type: 'varchar' | 'text' | 'double' | 'datetime' | 'boolean' | 'integer';
  readonly size?: number;
  readonly required?: boolean;
  readonly array?: boolean;
}

export interface AppwriteIndex {
  readonly key: string;
  readonly type: 'key' | 'unique';
  readonly attributes: readonly string[];
}

export interface AppwriteTableDefinition {
  readonly id: AppwriteTableId;
  readonly name: string;
  readonly columns: readonly AppwriteColumn[];
  readonly indexes: readonly AppwriteIndex[];
}

const id = (key: string): AppwriteColumn => ({
  key,
  type: 'varchar',
  size: 64,
  required: true
});

const optionalId = (key: string): AppwriteColumn => ({
  key,
  type: 'varchar',
  size: 64,
  required: false
});

const name = (key: string, required = true): AppwriteColumn => ({
  key,
  type: 'varchar',
  size: 256,
  required
});

const timestamp = (key: string): AppwriteColumn => ({
  key,
  type: 'datetime',
  required: true
});

const optionalTimestamp = (key: string): AppwriteColumn => ({
  key,
  type: 'datetime',
  required: false
});

const date = (key: string): AppwriteColumn => ({
  key,
  type: 'varchar',
  size: 10,
  required: true
});

const optionalDate = (key: string): AppwriteColumn => ({
  key,
  type: 'varchar',
  size: 10,
  required: false
});

const optionalIcon = (key: string): AppwriteColumn => ({
  key,
  type: 'varchar',
  size: 32,
  required: false
});

const optionalColor = (key: string): AppwriteColumn => ({
  key,
  type: 'varchar',
  size: 24,
  required: false
});

const note = (key: string): AppwriteColumn => ({
  key,
  type: 'text',
  required: false
});

const number = (key: string): AppwriteColumn => ({
  key,
  type: 'double',
  required: true
});

const keyIndex = (key: string, ...attributes: string[]): AppwriteIndex => ({
  key,
  type: 'key',
  attributes
});

export const APPWRITE_SCHEMA: readonly AppwriteTableDefinition[] = [
  {
    id: APPWRITE_TABLES.workspaces,
    name: 'Workspaces',
    columns: [name('name'), id('ownerId'), timestamp('createdAt'), timestamp('updatedAt')],
    indexes: [keyIndex('idx_owner', 'ownerId')]
  },
  {
    id: APPWRITE_TABLES.categories,
    name: 'Categories',
    columns: [
      id('workspaceId'),
      optionalId('parentId'),
      name('name'),
      optionalIcon('icon'),
      optionalColor('color'),
      number('importanceWeight'),
      timestamp('createdAt'),
      timestamp('updatedAt')
    ],
    indexes: [
      keyIndex('idx_workspace', 'workspaceId'),
      keyIndex('idx_parent', 'parentId')
    ]
  },
  {
    id: APPWRITE_TABLES.topics,
    name: 'Topics',
    columns: [
      id('workspaceId'),
      id('categoryId'),
      name('name'),
      timestamp('createdAt'),
      timestamp('updatedAt')
    ],
    indexes: [
      keyIndex('idx_workspace', 'workspaceId'),
      keyIndex('idx_category', 'categoryId')
    ]
  },
  {
    id: APPWRITE_TABLES.tasks,
    name: 'Tasks',
    columns: [
      id('workspaceId'),
      id('topicId'),
      name('title'),
      optionalIcon('icon'),
      number('taskWeight'),
      { key: 'status', type: 'varchar', size: 16, required: false },
      optionalTimestamp('statusChangedAt'),
      optionalDate('doneDate'),
      timestamp('createdAt'),
      timestamp('updatedAt')
    ],
    indexes: [
      keyIndex('idx_workspace', 'workspaceId'),
      keyIndex('idx_topic', 'topicId')
    ]
  },
  {
    id: APPWRITE_TABLES.weeklyPoolEntries,
    name: 'Weekly pool entries',
    columns: [
      id('workspaceId'),
      id('taskId'),
      date('weekStart'),
      optionalDate('plannedDate'),
      timestamp('createdAt')
    ],
    indexes: [
      keyIndex('idx_workspace_week', 'workspaceId', 'weekStart'),
      keyIndex('idx_task', 'taskId')
    ]
  },
  {
    id: APPWRITE_TABLES.activityLogs,
    name: 'Activity logs',
    columns: [
      id('workspaceId'),
      id('taskId'),
      date('completedDate'),
      note('note'),
      timestamp('createdAt')
    ],
    indexes: [
      keyIndex('idx_workspace_date', 'workspaceId', 'completedDate'),
      keyIndex('idx_task', 'taskId')
    ]
  },
  {
    id: APPWRITE_TABLES.activityEvents,
    name: 'Activity events',
    columns: [
      id('workspaceId'),
      id('actorId'),
      name('actorName'),
      { key: 'action', type: 'varchar', size: 32, required: true },
      { key: 'entityType', type: 'varchar', size: 32, required: true },
      id('entityId'),
      name('entityName'),
      name('contextName', false),
      note('detail'),
      timestamp('createdAt')
    ],
    indexes: [
      keyIndex('idx_workspace_created', 'workspaceId', 'createdAt'),
      keyIndex('idx_entity', 'entityType', 'entityId')
    ]
  },
  {
    id: APPWRITE_TABLES.milestones,
    name: 'Milestones',
    columns: [
      id('workspaceId'),
      name('title'),
      name('scopeKind'),
      id('scopeId'),
      number('targetPercentage'),
      date('dueDate'),
      timestamp('createdAt'),
      timestamp('updatedAt')
    ],
    indexes: [keyIndex('idx_workspace', 'workspaceId')]
  }
];
