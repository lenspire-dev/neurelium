import { describe, expect, test } from 'bun:test';
import type { Functions } from 'appwrite';
import { AppwriteTrustedWriter } from './trusted-writer';

function functionsWith(response: { status: number; body: unknown }): Functions {
  return {
    async createExecution() {
      return {
        responseStatusCode: response.status,
        responseBody: JSON.stringify(response.body)
      };
    }
  } as unknown as Functions;
}

describe('AppwriteTrustedWriter', () => {
  test('returns the row created by the function', async () => {
    const writer = new AppwriteTrustedWriter(
      functionsWith({ status: 200, body: { ok: true, row: { $id: 'row-a' } } }),
      'import-tree'
    );

    expect(await writer.createRow('tasks', 'row-a', { title: 'Read' })).toMatchObject({
      $id: 'row-a'
    });
  });

  test('surfaces function errors', async () => {
    const writer = new AppwriteTrustedWriter(
      functionsWith({ status: 403, body: { error: 'Free plan allows 500 tasks' } }),
      'import-tree'
    );

    await expect(writer.createRow('tasks', 'row-a', {})).rejects.toThrow(
      'Free plan allows 500 tasks'
    );
  });
});
