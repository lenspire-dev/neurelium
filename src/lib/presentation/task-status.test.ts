import { describe, expect, test } from 'bun:test';
import { asTaskId, asTopicId, asWorkspaceId } from '#lib/domain/models/identifiers.js';
import type { Task } from '#lib/domain/models/hierarchy.js';
import { applyTaskStatus } from './task-status';

const workspaceId = asWorkspaceId('workspace');

function task(id: string, status: Task['status'] = 'todo', doneDate: string | null = null): Task {
  return {
    id: asTaskId(id),
    workspaceId,
    topicId: asTopicId('topic'),
    title: id,
    icon: null,
    taskWeight: 2,
    status,
    statusChangedAt: null,
    doneDate,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z'
  };
}

describe('applyTaskStatus', () => {
  test('marks a task done with today as the done date', () => {
    const [updated] = applyTaskStatus([task('a')], asTaskId('a'), 'done', '2026-10-31', 'now');
    expect(updated?.status).toBe('done');
    expect(updated?.doneDate).toBe('2026-10-31');
    expect(updated?.statusChangedAt).toBe('now');
  });

  test('clears the done date when leaving done', () => {
    const [updated] = applyTaskStatus(
      [task('a', 'done', '2026-10-30')],
      asTaskId('a'),
      'in_progress',
      '2026-10-31',
      'now'
    );
    expect(updated?.status).toBe('in_progress');
    expect(updated?.doneDate).toBeNull();
  });

  test('keeps statusChangedAt when the status is unchanged and leaves other tasks alone', () => {
    const original = { ...task('a', 'todo'), statusChangedAt: 'earlier' };
    const untouched = task('b');
    const updated = applyTaskStatus([original, untouched], asTaskId('a'), 'todo', '2026-10-31', 'now');
    expect(updated[0]?.statusChangedAt).toBe('earlier');
    expect(updated[1]).toBe(untouched);
  });
});
