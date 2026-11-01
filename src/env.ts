import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
  PUBLIC_APPWRITE_ENDPOINT: { public: true, schema: (value) => value },
  PUBLIC_APPWRITE_PROJECT_ID: { public: true, schema: (value) => value },
  PUBLIC_APPWRITE_DATABASE_ID: { public: true, schema: (value) => value }
});
