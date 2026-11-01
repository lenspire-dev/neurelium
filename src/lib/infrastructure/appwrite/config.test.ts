import { describe, expect, test } from 'bun:test';
import { readAppwriteConfig } from './config';

const env = {
  PUBLIC_APPWRITE_ENDPOINT: 'https://cloud.appwrite.io/v1/',
  PUBLIC_APPWRITE_PROJECT_ID: 'project'
};

describe('readAppwriteConfig', () => {
  test('normalizes the endpoint and defaults the database', () => {
    expect(readAppwriteConfig(env)).toEqual({
      endpoint: 'https://cloud.appwrite.io/v1',
      projectId: 'project',
      databaseId: 'neurelium'
    });
  });

  test('requires endpoint and project ID', () => {
    expect(() => readAppwriteConfig({ PUBLIC_APPWRITE_PROJECT_ID: 'project' })).toThrow(
      'PUBLIC_APPWRITE_ENDPOINT'
    );
    expect(() =>
      readAppwriteConfig({ PUBLIC_APPWRITE_ENDPOINT: 'https://cloud.appwrite.io/v1' })
    ).toThrow('PUBLIC_APPWRITE_PROJECT_ID');
  });

  test('rejects insecure remote endpoints but allows localhost', () => {
    expect(() => readAppwriteConfig({ ...env, PUBLIC_APPWRITE_ENDPOINT: 'not-a-url' })).toThrow(
      'absolute URL'
    );
    expect(() =>
      readAppwriteConfig({ ...env, PUBLIC_APPWRITE_ENDPOINT: 'http://example.com/v1' })
    ).toThrow('HTTPS');
    expect(
      readAppwriteConfig({ ...env, PUBLIC_APPWRITE_ENDPOINT: 'http://localhost/v1' }).endpoint
    ).toBe('http://localhost/v1');
  });
});
