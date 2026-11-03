import { DEFAULT_APPWRITE_DATABASE_ID } from './schema';

export const IMPORT_FUNCTION_ID = 'import-tree';

export interface AppwriteConfig {
  readonly endpoint: string;
  readonly projectId: string;
  readonly databaseId: string;
  readonly importFunctionId: string | null;
}

export interface AppwritePublicEnv {
  readonly PUBLIC_APPWRITE_ENDPOINT?: string | undefined;
  readonly PUBLIC_APPWRITE_PROJECT_ID?: string | undefined;
  readonly PUBLIC_APPWRITE_DATABASE_ID?: string | undefined;
}

export function readAppwriteConfig(env: AppwritePublicEnv): AppwriteConfig {
  const endpoint = env.PUBLIC_APPWRITE_ENDPOINT?.trim();
  const projectId = env.PUBLIC_APPWRITE_PROJECT_ID?.trim();

  if (!endpoint) throw new Error('PUBLIC_APPWRITE_ENDPOINT is required.');
  if (!projectId) throw new Error('PUBLIC_APPWRITE_PROJECT_ID is required.');

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error('PUBLIC_APPWRITE_ENDPOINT must be an absolute URL.');
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('PUBLIC_APPWRITE_ENDPOINT must use HTTPS outside localhost.');
  }

  return {
    endpoint: endpoint.replace(/\/+$/, ''),
    projectId,
    databaseId: env.PUBLIC_APPWRITE_DATABASE_ID?.trim() || DEFAULT_APPWRITE_DATABASE_ID,
    importFunctionId: IMPORT_FUNCTION_ID
  };
}
