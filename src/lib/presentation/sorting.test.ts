import { describe, expect, test } from 'bun:test';
import type { Task } from '#lib/domain/models/hierarchy.js';
import { asTaskId, asTopicId, asWorkspaceId } from '#lib/domain/models/identifiers.js';
import { filterTasks, sortTasks } from './sorting.js';

const workspaceId = asWorkspaceId('workspace');

function task(
  id: string,
  title: string,
  status: Task['status'],
  taskWeight: Task['taskWeight'],
  createdAt: string
): Task {
  return {
    id: asTaskId(id),
    workspaceId,
    topicId: asTopicId('topic'),
    title,
    icon: null,
    taskWeight,
    status,
    statusChangedAt: null,
    doneDate: null,
    createdAt,
    updatedAt: createdAt
  };
}

const tasks = [
  task('c', 'Calculus', 'done', 5, '2026-10-03T00:00:00.000Z'),
  task('a', 'Algebra', 'todo', 2, '2026-10-01T00:00:00.000Z'),
  task('b', 'Biology', 'in_progress', 4, '2026-10-02T00:00:00.000Z')
];

describe('task sorting and filtering', () => {
  test('sorts by status order and breaks ties by title', () => {
    expect(sortTasks(tasks, 'status').map((item) => item.title)).toEqual([
      'Algebra',
      'Biology',
      'Calculus'
    ]);
  });

  test('sorts by weight descending without mutating the source', () => {
    expect(sortTasks(tasks, 'weight', 'desc').map((item) => item.taskWeight)).toEqual([
      5, 4, 2
    ]);
    expect(tasks.map((item) => item.title)).toEqual(['Calculus', 'Algebra', 'Biology']);
  });

  test('filters by status, weight, and case-insensitive title query', () => {
    expect(
      filterTasks(tasks, { status: 'in_progress', weight: 'all', query: '' }).map(
        (item) => item.title
      )
    ).toEqual(['Biology']);
    expect(
      filterTasks(tasks, { status: 'all', weight: 5, query: '' }).map((item) => item.title)
    ).toEqual(['Calculus']);
    expect(
      filterTasks(tasks, { status: 'all', weight: 'all', query: '  log ' }).map(
        (item) => item.title
      )
    ).toEqual(['Biology']);
  });
});
