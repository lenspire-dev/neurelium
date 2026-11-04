import {
  Client,
  TablesDB,
  TablesDBIndexType,
  AppwriteException
} from 'node-appwrite';
import {
  APPWRITE_SCHEMA,
  DEFAULT_APPWRITE_DATABASE_ID
} from '../src/lib/infrastructure/appwrite/schema';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const endpoint = (
  process.env.APPWRITE_ENDPOINT ?? process.env.PUBLIC_APPWRITE_ENDPOINT
)?.trim();
const projectId = (
  process.env.APPWRITE_PROJECT_ID ?? process.env.PUBLIC_APPWRITE_PROJECT_ID
)?.trim();

if (!endpoint) throw new Error('APPWRITE_ENDPOINT is required.');
if (!projectId) throw new Error('APPWRITE_PROJECT_ID is required.');

const databaseId =
  process.env.APPWRITE_DATABASE_ID?.trim() ||
  process.env.PUBLIC_APPWRITE_DATABASE_ID?.trim() ||
  DEFAULT_APPWRITE_DATABASE_ID;

const client = new Client()
  .setEndpoint(endpoint.replace(/\/+$/, ''))
  .setProject(projectId)
  .setKey(requiredEnv('APPWRITE_API_KEY'));
const tables = new TablesDB(client);

await ensureDatabase();
for (const definition of APPWRITE_SCHEMA) {
  await ensureTable(definition);
}

console.log(`Appwrite schema is ready in database "${databaseId}".`);

async function ensureDatabase(): Promise<void> {
  try {
    await tables.get({ databaseId });
    console.log(`Database "${databaseId}" already exists.`);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await tables.create({ databaseId, name: 'Neurelium' });
    console.log(`Created database "${databaseId}".`);
  }
}

async function ensureTable(
  definition: (typeof APPWRITE_SCHEMA)[number]
): Promise<void> {
  try {
    const existing = await tables.getTable({ databaseId, tableId: definition.id });
    await ensureColumns(definition, existing.columns);
    await ensureIndexes(definition, existing.indexes);
    await ensurePermissions(definition);
    console.log(`Table "${definition.id}" already exists.`);
    return;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  await tables.createTable({
    databaseId,
    tableId: definition.id,
    name: definition.name,
    permissions: [],
    rowSecurity: true,
    columns: definition.columns.map((column) => ({ ...column })),
    indexes: definition.indexes.map((index) => ({
      ...index,
      attributes: [...index.attributes]
    }))
  });

  await waitForTable(definition.id);
  console.log(`Created table "${definition.id}".`);
}

async function ensureColumns(
  definition: (typeof APPWRITE_SCHEMA)[number],
  existing: { key: string }[]
): Promise<void> {
  const keys = new Set(existing.map((column) => column.key));
  let added = 0;

  for (const column of definition.columns) {
    if (keys.has(column.key)) continue;

    const base = {
      databaseId,
      tableId: definition.id,
      key: column.key,
      required: column.required ?? false,
      array: column.array ?? false
    };
    switch (column.type) {
      case 'varchar':
        await tables.createVarcharColumn({ ...base, size: column.size ?? 255 });
        break;
      case 'text':
        await tables.createTextColumn(base);
        break;
      case 'double':
        await tables.createFloatColumn(base);
        break;
      case 'datetime':
        await tables.createDatetimeColumn(base);
        break;
      case 'boolean':
        await tables.createBooleanColumn(base);
        break;
      case 'integer':
        await tables.createIntegerColumn(base);
        break;
    }
    added += 1;
    console.log(`Added column "${definition.id}.${column.key}".`);
  }

  if (added > 0) await waitForTable(definition.id);
}

async function ensureIndexes(
  definition: (typeof APPWRITE_SCHEMA)[number],
  existing: { key: string }[]
): Promise<void> {
  const keys = new Set(existing.map((index) => index.key));
  let added = 0;

  for (const index of definition.indexes) {
    if (keys.has(index.key)) continue;

    await tables.createIndex({
      databaseId,
      tableId: definition.id,
      key: index.key,
      type: index.type === 'unique' ? TablesDBIndexType.Unique : TablesDBIndexType.Key,
      columns: [...index.attributes]
    });
    added += 1;
    console.log(`Added index "${definition.id}.${index.key}".`);
  }

  if (added > 0) await waitForTable(definition.id);
}

async function ensurePermissions(
  definition: (typeof APPWRITE_SCHEMA)[number]
): Promise<void> {
  await tables.updateTable({
    databaseId,
    tableId: definition.id,
    permissions: [],
    rowSecurity: true
  });
}

async function waitForTable(tableId: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const table = await tables.getTable({ databaseId, tableId });
    const pending = [...table.columns, ...table.indexes].find(
      (item) => item.status !== 'available'
    );

    if (pending === undefined) return;
    if (pending.status === 'failed') {
      throw new Error(
        `Table "${tableId}" failed to provision: ${pending.error || 'unknown error'}`
      );
    }

    await Bun.sleep(1000);
  }

  throw new Error(`Timed out waiting for table "${tableId}" to provision.`);
}

function isNotFound(error: unknown): boolean {
  return error instanceof AppwriteException && error.code === 404;
}
