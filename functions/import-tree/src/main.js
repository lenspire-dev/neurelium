import {
  Account,
  Client,
  ID,
  Permission,
  Query,
  Role,
  TablesDB,
  Teams
} from 'node-appwrite';

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'neurelium';
const TABLES = {
  categories: 'categories',
  topics: 'topics',
  tasks: 'tasks',
  activityEvents: 'activity_events'
};
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
const MAX_ROWS = 2000;

function text(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalText(value, path) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error(`${path} must be a string.`);
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if ([...trimmed].length > 16) throw new Error(`${path} must be a short emoji.`);
  return trimmed;
}

function weight(value, path) {
  if (value === undefined) return DEFAULT_WEIGHT;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`${path} must be an integer from 1 to 5.`);
  }
  return value;
}

function color(value, path) {
  if (value === undefined || value === null || value === '') return null;
  if (!COLORS.has(value)) {
    throw new Error(`${path} must be a supported category color.`);
  }
  return value;
}

function list(value, path) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  return value;
}

function object(value, path) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
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

function permissions(userId, workspaceId) {
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

function json(body, status = 200) {
  return JSON.stringify(body);
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
  const tables = new TablesDB(admin);
  const userTables = new TablesDB(user);
  const adminTeams = new Teams(admin);

  try {
    let actor;
    try {
      actor = await new Account(user).get();
    } catch {
      return res.text(json({ error: 'Authentication required.' }), 401);
    }
    const userId = actor.$id;

    const body = req.bodyJson;
    if (typeof body !== 'object' || body === null) {
      return res.text(json({ error: 'Request body must be JSON.' }), 400);
    }
    const workspaceId = text(body.workspaceId, 'workspaceId');

    let workspace;
    try {
      workspace = await userTables.getRow({
        databaseId: DATABASE_ID,
        tableId: 'workspaces',
        rowId: workspaceId
      });
    } catch {
      return res.text(json({ error: 'Workspace not found.' }), 404);
    }

    const role = await workspaceRole(adminTeams, userId, workspaceId, workspace.ownerId);
    if (role === null || role === 'viewer') {
      return res.text(json({ error: 'You cannot import into this workspace.' }), 403);
    }

    const tree = parseCategory(body.tree, 'category');
    const now = new Date().toISOString();
    const rows = { categories: [], topics: [], tasks: [] };
    const rowPermissions = permissions(userId, workspaceId);

    function createNode(node, parentId) {
      if (rows.categories.length + rows.topics.length + rows.tasks.length >= MAX_ROWS) {
        throw new Error(`Import is limited to ${MAX_ROWS} rows.`);
      }
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

    return res.text(
      json({
        ok: true,
        categories: rows.categories.length,
        topics: rows.topics.length,
        tasks: rows.tasks.length
      })
    );
  } catch (failure) {
    logError(failure);
    const message = failure instanceof Error ? failure.message : 'Import failed.';
    return res.text(json({ error: message }), 400);
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
