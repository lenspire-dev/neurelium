import {
  Account,
  Client,
  ID,
  Permission,
  Query,
  Role,
  TablesDB,
  Teams,
  Users
} from 'node-appwrite';
import {
  monthStartIso,
  planName,
  PLAN_LIMITS,
  resolvePlan,
  resolveSubscriptionPlan
} from './plans.js';

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'neurelium';
const TABLES = {
  workspaces: 'workspaces',
  categories: 'categories',
  topics: 'topics',
  tasks: 'tasks',
  weeklyPoolEntries: 'weekly_pool_entries',
  activityLogs: 'activity_logs',
  activityEvents: 'activity_events',
  milestones: 'milestones',
  subscriptions: 'subscriptions'
};
const CONTENT_TABLES = new Set([
  TABLES.categories,
  TABLES.topics,
  TABLES.tasks,
  TABLES.weeklyPoolEntries,
  TABLES.activityLogs,
  TABLES.activityEvents,
  TABLES.milestones
]);
const REQUIRED_ROLES = new Set(['owner', 'admin', 'member']);
const INVITE_ROLES = new Set(['admin', 'member', 'viewer']);
const TASK_STATUSES = new Set(['todo', 'in_progress', 'done', 'skipped']);
const CATEGORY_STATUSES = new Set(['todo', 'in_progress', 'done']);
const ACTIVITY_ACTIONS = new Set([
  'created',
  'updated',
  'deleted',
  'scheduled',
  'unscheduled',
  'moved',
  'completed',
  'uncompleted',
  'status_changed',
  'imported',
  'member_invited',
  'member_joined',
  'member_removed',
  'role_changed'
]);
const ACTIVITY_ENTITY_TYPES = new Set([
  'workspace',
  'category',
  'topic',
  'task',
  'weekly_entry',
  'completion',
  'milestone',
  'import',
  'member',
  'invitation'
]);
const MILESTONE_SCOPE_KINDS = new Set(['category', 'topic']);
const COLORS = new Set([
  'amber',
  'lime',
  'emerald',
  'teal',
  'sky',
  'indigo',
  'violet',
  'pink'
]);
const DEFAULT_WEIGHT = 2;
const BATCH_SIZE = 100;

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function text(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(`${path} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalText(value, path) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new AppError(`${path} must be a string.`);
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if ([...trimmed].length > 16) throw new AppError(`${path} must be a short emoji.`);
  return trimmed;
}

function nullableText(value, path) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new AppError(`${path} must be a string.`);
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function optionalId(value, path) {
  if (value === undefined || value === null || value === '') return null;
  return text(value, path);
}

function isoDate(value, path, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  const result = text(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
    throw new AppError(`${path} must be an ISO date.`);
  }
  return result;
}

function isoDateTime(value, path, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  const result = text(value, path);
  if (Number.isNaN(Date.parse(result))) {
    throw new AppError(`${path} must be an ISO timestamp.`);
  }
  return result;
}

function enumText(value, path, allowed) {
  const result = text(value, path);
  if (!allowed.has(result)) throw new AppError(`${path} is not a supported value.`);
  return result;
}

function status(value, path) {
  return value === undefined || value === null
    ? 'todo'
    : enumText(value, path, TASK_STATUSES);
}

function categoryStatus(value, path) {
  if (value === undefined || value === null || value === '') return null;
  return enumText(value, path, CATEGORY_STATUSES);
}

function rejectUnknownKeys(input, allowed, path) {
  for (const key of Object.keys(input)) {
    if (key === '$id' || key === '$permissions') continue;
    if (!allowed.has(key)) throw new AppError(`${path}.${key} is not allowed.`);
  }
}

function weight(value, path) {
  if (value === undefined) return DEFAULT_WEIGHT;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
    throw new AppError(`${path} must be an integer from 1 to 5.`);
  }
  return value;
}

function color(value, path) {
  if (value === undefined || value === null || value === '') return null;
  if (!COLORS.has(value)) {
    throw new AppError(`${path} must be a supported category color.`);
  }
  return value;
}

function list(value, path) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new AppError(`${path} must be an array.`);
  return value;
}

function object(value, path) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError(`${path} must be an object.`);
  }
  return value;
}

function parseTask(value, path) {
  const input = object(value, path);
  return {
    title: text(input.title, `${path}.title`),
    icon: optionalText(input.icon, `${path}.icon`),
    weight: weight(input.weight, `${path}.weight`)
  };
}

function parseTopic(value, path) {
  const input = object(value, path);
  return {
    name: text(input.name, `${path}.name`),
    tasks: list(input.tasks, `${path}.tasks`).map((task, index) =>
      parseTask(task, `${path}.tasks[${index}]`)
    )
  };
}

function parseCategory(value, path) {
  const input = object(value, path);
  return {
    name: text(input.name, `${path}.name`),
    icon: optionalText(input.icon, `${path}.icon`),
    color: color(input.color, `${path}.color`),
    weight: weight(input.weight, `${path}.weight`),
    topics: list(input.topics, `${path}.topics`).map((topic, index) =>
      parseTopic(topic, `${path}.topics[${index}]`)
    ),
    subcategories: list(input.subcategories, `${path}.subcategories`).map((child, index) =>
      parseCategory(child, `${path}.subcategories[${index}]`)
    )
  };
}

function countTreeRows(node) {
  const own = {
    categories: 1,
    topics: node.topics.length,
    tasks: node.topics.reduce((total, topic) => total + topic.tasks.length, 0)
  };
  return node.subcategories.reduce(
    (total, child) => {
      const nested = countTreeRows(child);
      return {
        categories: total.categories + nested.categories,
        topics: total.topics + nested.topics,
        tasks: total.tasks + nested.tasks
      };
    },
    own
  );
}

function contentPermissions(userId, workspaceId) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
    Permission.read(Role.team(workspaceId)),
    ...['owner', 'admin', 'member'].map((role) =>
      Permission.update(Role.team(workspaceId, role))
    ),
    ...['owner', 'admin'].map((role) => Permission.delete(Role.team(workspaceId, role)))
  ];
}

function workspacePermissions(userId, workspaceId) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
    Permission.read(Role.team(workspaceId)),
    Permission.update(Role.team(workspaceId, 'owner')),
    Permission.update(Role.team(workspaceId, 'admin')),
    Permission.delete(Role.team(workspaceId, 'owner'))
  ];
}

function json(body) {
  return JSON.stringify(body);
}

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

async function countRows(tables, tableId, queries) {
  const result = await tables.listRows({
    databaseId: DATABASE_ID,
    tableId,
    queries: [...queries, Query.limit(1)]
  });
  return result.total;
}

async function readPlan(tables, users, ownerId) {
  const owner = await users.get({ userId: ownerId });

  let subscriptions = [];
  try {
    const result = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.subscriptions,
      queries: [Query.equal('userId', ownerId), Query.limit(100)]
    });
    subscriptions = result.rows;
  } catch (failure) {
    if (failure?.code !== 404) throw failure;
  }

  if (subscriptions.length > 0) {
    const { plan, expiresAt } = resolveSubscriptionPlan(subscriptions);
    return {
      plan,
      limits: PLAN_LIMITS[plan],
      source: 'subscription',
      expiresAt
    };
  }

  const plan = resolvePlan(owner.labels ?? []);
  return {
    plan,
    limits: PLAN_LIMITS[plan],
    source: 'label',
    expiresAt: null
  };
}

async function getPlan(context) {
  const info = await readPlan(context.tables, context.adminUsers, context.userId);
  return {
    plan: info.plan,
    name: planName(info.plan),
    limits: info.limits,
    source: info.source,
    expiresAt: info.expiresAt
  };
}

async function loadWorkspace(userTables, workspaceId) {
  try {
    return await userTables.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.workspaces,
      rowId: workspaceId
    });
  } catch {
    throw new AppError('Workspace not found.', 404);
  }
}

async function requireWriterRole(adminTeams, userId, workspace) {
  const role = await workspaceRole(adminTeams, userId, workspace.$id, workspace.ownerId);
  if (role === null || !REQUIRED_ROLES.has(role)) {
    throw new AppError('You cannot create content in this workspace.', 403);
  }
}

async function assertOwnedWorkspaceLimit(tables, users, ownerId) {
  const { plan, limits } = await readPlan(tables, users, ownerId);
  const count = await countRows(tables, TABLES.workspaces, [
    Query.equal('ownerId', ownerId)
  ]);
  if (count >= limits.ownedWorkspaces) {
    throw new AppError(
      `${planName(plan)} plan allows ${plural(limits.ownedWorkspaces, 'workspace')}.`,
      403
    );
  }
}

async function assertTaskCapacity(tables, users, workspaceId, ownerId, incoming = 0) {
  if (incoming === 0) return;
  const { plan, limits } = await readPlan(tables, users, ownerId);
  const count = await countRows(tables, TABLES.tasks, [
    Query.equal('workspaceId', workspaceId)
  ]);
  if (count + incoming > limits.tasksPerWorkspace) {
    throw new AppError(
      `${planName(plan)} plan allows ${limits.tasksPerWorkspace} tasks per workspace.`,
      403
    );
  }
}

async function assertMilestoneCapacity(tables, users, workspaceId, ownerId) {
  const { plan, limits } = await readPlan(tables, users, ownerId);
  const today = new Date().toISOString().slice(0, 10);
  const count = await countRows(tables, TABLES.milestones, [
    Query.equal('workspaceId', workspaceId),
    Query.greaterThanEqual('dueDate', today)
  ]);
  if (count >= limits.activeMilestonesPerWorkspace) {
    throw new AppError(
      `${planName(plan)} plan allows ${limits.activeMilestonesPerWorkspace} active milestones per workspace.`,
      403
    );
  }
}

async function assertImportQuota(tables, users, ownerId) {
  const { plan, limits } = await readPlan(tables, users, ownerId);
  const owned = await tables.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.workspaces,
    queries: [Query.equal('ownerId', ownerId), Query.limit(100)]
  });
  const workspaceIds = owned.rows.map((row) => row.$id);
  if (workspaceIds.length === 0) return;

  const queries = [
    Query.equal('workspaceId', workspaceIds),
    Query.equal('action', 'imported')
  ];
  if (limits.treeImportWindow === 'month') {
    queries.push(Query.greaterThanEqual('createdAt', monthStartIso()));
  }

  const count = await countRows(tables, TABLES.activityEvents, queries);
  if (count >= limits.treeImports) {
    const window = limits.treeImportWindow === 'month' ? 'this month' : 'in total';
    throw new AppError(
      `${planName(plan)} plan allows ${plural(limits.treeImports, 'tree import')} ${window}.`,
      403
    );
  }
}

async function importTree(context, body) {
  const { actor, userId, tables, userTables, adminTeams, users } = context;
  const workspaceId = text(body.workspaceId, 'workspaceId');
  const workspace = await loadWorkspace(userTables, workspaceId);
  await requireWriterRole(adminTeams, userId, workspace);
  await assertImportQuota(tables, users, workspace.ownerId);

  const { limits } = await readPlan(tables, users, workspace.ownerId);
  const tree = parseCategory(body.tree, 'category');
  const incoming = countTreeRows(tree);
  if (incoming.categories + incoming.topics + incoming.tasks > limits.maxRowsPerImport) {
    throw new AppError(`Import is limited to ${limits.maxRowsPerImport} rows.`);
  }
  const now = new Date().toISOString();
  const rows = { categories: [], topics: [], tasks: [] };
  const rowPermissions = contentPermissions(userId, workspaceId);

  function createNode(node, parentId) {
    const categoryId = ID.unique();
    rows.categories.push({
      $id: categoryId,
      $permissions: rowPermissions,
      workspaceId,
      parentId,
      name: node.name,
      icon: node.icon,
      color: node.color,
      importanceWeight: node.weight,
      statusOverride: null,
      createdAt: now,
      updatedAt: now
    });

    for (const item of node.topics) {
      const topicId = ID.unique();
      rows.topics.push({
        $id: topicId,
        $permissions: rowPermissions,
        workspaceId,
        categoryId,
        name: item.name,
        createdAt: now,
        updatedAt: now
      });
      for (const task of item.tasks) {
        rows.tasks.push({
          $id: ID.unique(),
          $permissions: rowPermissions,
          workspaceId,
          topicId,
          title: task.title,
          icon: task.icon,
          taskWeight: task.weight,
          status: 'todo',
          statusChangedAt: null,
          doneDate: null,
          createdAt: now,
          updatedAt: now
        });
      }
    }
    for (const child of node.subcategories) createNode(child, categoryId);
  }

  createNode(tree, null);
  await assertTaskCapacity(tables, users, workspaceId, workspace.ownerId, rows.tasks.length);

  const detail = `${rows.categories.length} categories · ${rows.topics.length} topics · ${rows.tasks.length} tasks`;
  rows.activityEvents = [
    {
      $id: ID.unique(),
      $permissions: rowPermissions,
      workspaceId,
      actorId: userId,
      actorName: actor.name || actor.email || 'Unknown member',
      action: 'imported',
      entityType: 'import',
      entityId: tree.name,
      entityName: tree.name,
      contextName: null,
      detail,
      createdAt: now
    }
  ];

  const transaction = await tables.createTransaction({ ttl: 300 });
  try {
    for (const tableId of Object.keys(rows)) {
      for (let index = 0; index < rows[tableId].length; index += BATCH_SIZE) {
        await tables.createRows({
          databaseId: DATABASE_ID,
          tableId: TABLES[tableId],
          rows: rows[tableId].slice(index, index + BATCH_SIZE),
          transactionId: transaction.$id
        });
      }
    }
    await tables.updateTransaction({ transactionId: transaction.$id, commit: true });
  } catch (failure) {
    await tables
      .updateTransaction({ transactionId: transaction.$id, rollback: true })
      .catch(() => {});
    throw failure;
  }

  return {
    categories: rows.categories.length,
    topics: rows.topics.length,
    tasks: rows.tasks.length
  };
}

async function createRow(context, body) {
  const { userId, actor, tables, userTables, adminTeams, users } = context;
  const tableId = text(body.tableId, 'tableId');
  if (!CONTENT_TABLES.has(tableId)) {
    throw new AppError('This row cannot be created through this function.');
  }
  const rowId = text(body.rowId, 'rowId');
  const input = object(body.data, 'data');
  const workspaceId = text(input.workspaceId, 'data.workspaceId');
  const workspace = await loadWorkspace(userTables, workspaceId);
  await requireWriterRole(adminTeams, userId, workspace);

  if (tableId === TABLES.tasks) {
    await assertTaskCapacity(tables, users, workspaceId, workspace.ownerId, 1);
  } else if (tableId === TABLES.milestones) {
    await assertMilestoneCapacity(tables, users, workspaceId, workspace.ownerId);
  }

  const data = await sanitizeRow(tables, tableId, input, workspaceId, userId, actor);
  const row = await tables.createRow({
    databaseId: DATABASE_ID,
    tableId,
    rowId,
    data,
    permissions: contentPermissions(userId, workspaceId)
  });
  return { row };
}

async function sanitizeRow(tables, tableId, input, workspaceId, userId, actor) {
  const base = { workspaceId };
  const createdAt = () => isoDateTime(input.createdAt, 'data.createdAt');
  const updatedAt = () => isoDateTime(input.updatedAt, 'data.updatedAt');

  switch (tableId) {
    case TABLES.categories: {
      rejectUnknownKeys(
        input,
        new Set([
          'workspaceId',
          'parentId',
          'name',
          'icon',
          'color',
          'importanceWeight',
          'statusOverride',
          'createdAt',
          'updatedAt'
        ]),
        'data'
      );
      const parentId = optionalId(input.parentId, 'data.parentId');
      if (parentId !== null) {
        await requireScopedRow(tables, TABLES.categories, parentId, workspaceId, 'Parent category');
      }
      return {
        ...base,
        parentId,
        name: text(input.name, 'data.name'),
        icon: optionalText(input.icon, 'data.icon'),
        color: color(input.color, 'data.color'),
        importanceWeight: weight(input.importanceWeight, 'data.importanceWeight'),
        statusOverride: categoryStatus(input.statusOverride, 'data.statusOverride'),
        createdAt: createdAt(),
        updatedAt: updatedAt()
      };
    }
    case TABLES.topics: {
      rejectUnknownKeys(
        input,
        new Set(['workspaceId', 'categoryId', 'name', 'createdAt', 'updatedAt']),
        'data'
      );
      const categoryId = text(input.categoryId, 'data.categoryId');
      await requireScopedRow(tables, TABLES.categories, categoryId, workspaceId, 'Category');
      return {
        ...base,
        categoryId,
        name: text(input.name, 'data.name'),
        createdAt: createdAt(),
        updatedAt: updatedAt()
      };
    }
    case TABLES.tasks: {
      rejectUnknownKeys(
        input,
        new Set([
          'workspaceId',
          'topicId',
          'title',
          'icon',
          'taskWeight',
          'status',
          'statusChangedAt',
          'doneDate',
          'createdAt',
          'updatedAt'
        ]),
        'data'
      );
      const topicId = text(input.topicId, 'data.topicId');
      await requireScopedRow(tables, TABLES.topics, topicId, workspaceId, 'Topic');
      return {
        ...base,
        topicId,
        title: text(input.title, 'data.title'),
        icon: optionalText(input.icon, 'data.icon'),
        taskWeight: weight(input.taskWeight, 'data.taskWeight'),
        status: status(input.status, 'data.status'),
        statusChangedAt: isoDateTime(input.statusChangedAt, 'data.statusChangedAt', true),
        doneDate: isoDate(input.doneDate, 'data.doneDate', true),
        createdAt: createdAt(),
        updatedAt: updatedAt()
      };
    }
    case TABLES.weeklyPoolEntries: {
      rejectUnknownKeys(
        input,
        new Set([
          'workspaceId',
          'taskId',
          'weekStart',
          'plannedDate',
          'status',
          'completedDate',
          'createdAt'
        ]),
        'data'
      );
      const taskId = text(input.taskId, 'data.taskId');
      await requireScopedRow(tables, TABLES.tasks, taskId, workspaceId, 'Task');
      return {
        ...base,
        taskId,
        weekStart: isoDate(input.weekStart, 'data.weekStart'),
        plannedDate: isoDate(input.plannedDate, 'data.plannedDate', true),
        status: status(input.status, 'data.status'),
        completedDate: isoDate(input.completedDate, 'data.completedDate', true),
        createdAt: createdAt()
      };
    }
    case TABLES.activityLogs: {
      rejectUnknownKeys(
        input,
        new Set([
          'workspaceId',
          'taskId',
          'entryId',
          'completedDate',
          'note',
          'taskName',
          'topicName',
          'categoryName',
          'createdAt'
        ]),
        'data'
      );
      const taskId = text(input.taskId, 'data.taskId');
      await requireScopedRow(tables, TABLES.tasks, taskId, workspaceId, 'Task');
      const entryId = optionalId(input.entryId, 'data.entryId');
      if (entryId !== null) {
        await requireScopedRow(
          tables,
          TABLES.weeklyPoolEntries,
          entryId,
          workspaceId,
          'Weekly pool entry'
        );
      }
      return {
        ...base,
        taskId,
        entryId,
        completedDate: isoDate(input.completedDate, 'data.completedDate'),
        note: nullableText(input.note, 'data.note'),
        taskName: nullableText(input.taskName, 'data.taskName'),
        topicName: nullableText(input.topicName, 'data.topicName'),
        categoryName: nullableText(input.categoryName, 'data.categoryName'),
        createdAt: createdAt()
      };
    }
    case TABLES.activityEvents: {
      rejectUnknownKeys(
        input,
        new Set([
          'workspaceId',
          'actorId',
          'actorName',
          'action',
          'entityType',
          'entityId',
          'entityName',
          'contextName',
          'detail',
          'createdAt'
        ]),
        'data'
      );
      return {
        ...base,
        actorId: userId,
        actorName: actor.name || actor.email || 'Unknown member',
        action: enumText(input.action, 'data.action', ACTIVITY_ACTIONS),
        entityType: enumText(input.entityType, 'data.entityType', ACTIVITY_ENTITY_TYPES),
        entityId: text(input.entityId, 'data.entityId'),
        entityName: text(input.entityName, 'data.entityName'),
        contextName: nullableText(input.contextName, 'data.contextName'),
        detail: nullableText(input.detail, 'data.detail'),
        createdAt: createdAt()
      };
    }
    case TABLES.milestones: {
      rejectUnknownKeys(
        input,
        new Set([
          'workspaceId',
          'title',
          'scopeKind',
          'scopeId',
          'targetPercentage',
          'dueDate',
          'createdAt',
          'updatedAt'
        ]),
        'data'
      );
      const scopeKind = enumText(input.scopeKind, 'data.scopeKind', MILESTONE_SCOPE_KINDS);
      const scopeId = text(input.scopeId, 'data.scopeId');
      await requireScopedRow(
        tables,
        scopeKind === 'category' ? TABLES.categories : TABLES.topics,
        scopeId,
        workspaceId,
        scopeKind === 'category' ? 'Category' : 'Topic'
      );
      return {
        ...base,
        title: text(input.title, 'data.title'),
        scopeKind,
        scopeId,
        targetPercentage: percentage(input.targetPercentage, 'data.targetPercentage'),
        dueDate: isoDate(input.dueDate, 'data.dueDate'),
        createdAt: createdAt(),
        updatedAt: updatedAt()
      };
    }
    default:
      throw new AppError('This row cannot be created through this function.');
  }
}

function percentage(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100) {
    throw new AppError(`${path} must be a number greater than 0 and at most 100.`);
  }
  return value;
}

async function requireScopedRow(tables, tableId, rowId, workspaceId, label) {
  let row;
  try {
    row = await tables.getRow({ databaseId: DATABASE_ID, tableId, rowId });
  } catch (error) {
    if (error?.code === 404) throw new AppError(`${label} not found.`);
    throw error;
  }
  if (row.workspaceId !== workspaceId) {
    throw new AppError(`${label} does not belong to this workspace.`);
  }
  return row;
}

async function createWorkspace(context, body) {
  const { userId, tables, adminUsers, userTeams } = context;
  const workspaceId = text(body.workspaceId, 'workspaceId');
  const input = object(body.data, 'data');
  const name = text(input.name, 'data.name');

  await assertOwnedWorkspaceLimit(tables, adminUsers, userId);

  const now = new Date().toISOString();
  const data = {
    name,
    ownerId: userId,
    defaultView: input.defaultView === 'week' ? 'week' : 'day',
    weekStartsOn: input.weekStartsOn === 'sunday' ? 'sunday' : 'monday',
    categoryOverrideMode: input.categoryOverrideMode === 'done_only' ? 'done_only' : 'any',
    createdAt: now,
    updatedAt: now
  };

  await userTeams.create({
    teamId: workspaceId,
    name,
    roles: ['admin', 'member', 'viewer']
  });

  try {
    const row = await tables.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.workspaces,
      rowId: workspaceId,
      data,
      permissions: workspacePermissions(userId, workspaceId)
    });
    return { row };
  } catch (failure) {
    await userTeams.delete({ teamId: workspaceId }).catch(() => {});
    throw failure;
  }
}

async function inviteMember(context, body) {
  const { tables, adminTeams, users, userTeams } = context;
  const workspaceId = text(body.workspaceId, 'workspaceId');
  const email = text(body.email, 'email');
  const role = text(body.role, 'role');
  if (!INVITE_ROLES.has(role)) throw new AppError('Invalid member role.');
  const redirectUrl = text(body.redirectUrl, 'redirectUrl');

  const workspace = await loadWorkspace(context.userTables, workspaceId);
  const actorRole = await workspaceRole(
    adminTeams,
    context.userId,
    workspaceId,
    workspace.ownerId
  );
  if (actorRole !== 'owner' && actorRole !== 'admin') {
    throw new AppError('You cannot invite members to this workspace.', 403);
  }

  const { plan, limits } = await readPlan(tables, users, workspace.ownerId);
  const memberships = await adminTeams.listMemberships({
    teamId: workspaceId,
    queries: [Query.limit(1)]
  });
  if (memberships.total >= limits.membersPerWorkspace) {
    throw new AppError(
      `${planName(plan)} plan allows ${plural(limits.membersPerWorkspace, 'member')} per workspace.`,
      403
    );
  }

  await userTeams.createMembership({
    teamId: workspaceId,
    roles: [role],
    email: email.trim(),
    url: redirectUrl
  });
}

export default async ({ req, res, error: logError }) => {
  const jwt = req.headers['x-appwrite-user-jwt'];
  if (!jwt) {
    return res.text(json({ error: 'Authentication required.' }), 401);
  }

  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const key = req.headers['x-appwrite-key'];
  if (!endpoint || !projectId || !key) {
    return res.text(json({ error: 'Function environment is incomplete.' }), 500);
  }

  const admin = new Client().setEndpoint(endpoint).setProject(projectId).setKey(key);
  const user = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(jwt);
  const adminTables = new TablesDB(admin);
  const userTables = new TablesDB(user);
  const adminTeams = new Teams(admin);
  const userTeams = new Teams(user);
  const adminUsers = new Users(admin);

  try {
    let actor;
    try {
      actor = await new Account(user).get();
    } catch {
      return res.text(json({ error: 'Authentication required.' }), 401);
    }

    const body = req.bodyJson;
    if (typeof body !== 'object' || body === null) {
      return res.text(json({ error: 'Request body must be JSON.' }), 400);
    }

    const context = {
      actor,
      userId: actor.$id,
      adminUsers,
      userTeams,
      adminTeams,
      tables: adminTables,
      userTables
    };
    const action = typeof body.action === 'string' ? body.action : 'import';

    let result;
    switch (action) {
      case 'import':
        result = await importTree(context, body);
        break;
      case 'createRow':
        result = await createRow(context, body);
        break;
      case 'createWorkspace':
        result = await createWorkspace(context, body);
        break;
      case 'inviteMember':
        await inviteMember(context, body);
        result = {};
        break;
      case 'getPlan':
        result = await getPlan(context);
        break;
      default:
        throw new AppError('Unknown action.');
    }

    return res.text(json({ ok: true, ...result }));
  } catch (failure) {
    logError(failure);
    const status = failure instanceof AppError ? failure.status : 400;
    const message = failure instanceof Error ? failure.message : 'Request failed.';
    return res.text(json({ error: message }), status);
  }
};

async function workspaceRole(teams, userId, workspaceId, ownerId) {
  if (ownerId === userId) return 'owner';
  try {
    const page = await teams.listMemberships({
      teamId: workspaceId,
      queries: [Query.equal('userId', userId), Query.limit(1)]
    });
    const membership = page.memberships[0];
    if (membership === undefined || !membership.confirm) return null;
    for (const role of ['owner', 'admin', 'member', 'viewer']) {
      if (membership.roles.includes(role)) return role;
    }
    return null;
  } catch (failure) {
    if (failure?.code === 404) return null;
    throw failure;
  }
}
