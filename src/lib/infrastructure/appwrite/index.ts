import { Account, Client, TablesDB } from 'appwrite';
import { AppwriteAuthAdapter } from './auth-adapter';
import { readAppwriteConfig, type AppwriteConfig, type AppwritePublicEnv } from './config';
import { createAppwriteRepositories } from './repositories';
import { AppwriteIdGenerator, SystemClock } from './runtime';

export { AppwriteAuthAdapter } from './auth-adapter';
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
  const auth = new AppwriteAuthAdapter(account);

  return {
    client,
    tables,
    auth,
    ...createAppwriteRepositories(tables, config.databaseId, auth),
    clock: new SystemClock(),
    ids: new AppwriteIdGenerator()
  };
}

export function createAppwriteInfrastructureFromEnv(env: AppwritePublicEnv) {
  return createAppwriteInfrastructure(readAppwriteConfig(env));
}
