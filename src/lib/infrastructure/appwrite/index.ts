import { Account, Channel, Client, Functions, TablesDB, Teams } from 'appwrite';
import { AppwriteAuthAdapter } from './auth-adapter';
import { readAppwriteConfig, type AppwriteConfig, type AppwritePublicEnv } from './config';
import { createAppwriteRepositories } from './repositories';
import { AppwriteIdGenerator, SystemClock } from './runtime';
import { APPWRITE_TABLES } from './schema';
import { AppwriteTrustedWriter } from './trusted-writer';
import { AppwriteWorkspaceTeamAdapter } from './workspace-team-adapter';

export { AppwriteAuthAdapter } from './auth-adapter';
export { AppwriteWorkspaceTeamAdapter } from './workspace-team-adapter';
export { readAppwriteConfig, type AppwriteConfig, type AppwritePublicEnv } from './config';
export { isAppwriteException } from './errors';
export {
  AppwriteActivityEventRepository,
  AppwriteActivityLogRepository,
  AppwriteCategoryRepository,
  AppwriteMilestoneRepository,
  AppwriteTaskRepository,
  AppwriteTopicRepository,
  AppwriteWeeklyPoolRepository,
  AppwriteWorkspaceRepository
} from './repositories';
export { AppwriteIdGenerator, SystemClock } from './runtime';
export { AppwriteTrustedWriter } from './trusted-writer';
export {
  APPWRITE_SCHEMA,
  APPWRITE_TABLES,
  DEFAULT_APPWRITE_DATABASE_ID,
  type AppwriteTableDefinition,
  type AppwriteTableId
} from './schema';

export function createAppwriteInfrastructure(
  config: AppwriteConfig
): ReturnType<typeof buildInfrastructure> {
  return buildInfrastructure(config);
}

function buildInfrastructure(config: AppwriteConfig) {
  const client = new Client().setEndpoint(config.endpoint).setProject(config.projectId);
  const account = new Account(client);
  const tables = new TablesDB(client);
  const teams = new Teams(client);
  const functions = new Functions(client);
  const auth = new AppwriteAuthAdapter(account);
  const writer = new AppwriteTrustedWriter(functions, config.importFunctionId);
  const channels = Object.values(APPWRITE_TABLES).map((tableId) =>
    Channel.tablesdb(config.databaseId).table(tableId).row().toString()
  );

  return {
    client,
    tables,
    teams,
    writer,
    subscribeToWorkspaceRows: (callback: () => void) => client.subscribe(channels, callback),
    auth,
    team: new AppwriteWorkspaceTeamAdapter(teams, writer),
    ...createAppwriteRepositories(tables, config.databaseId, auth, writer),
    clock: new SystemClock(),
    ids: new AppwriteIdGenerator()
  };
}

export function createAppwriteInfrastructureFromEnv(env: AppwritePublicEnv) {
  return createAppwriteInfrastructure(readAppwriteConfig(env));
}
