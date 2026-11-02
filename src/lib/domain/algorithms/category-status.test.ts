import { describe, expect, test } from 'bun:test';
import type { Category, Task, Topic } from '../models/hierarchy';
import { asCategoryId, asTaskId, asTopicId, asWorkspaceId } from '../models/identifiers';
import { calculateCategoryStatus } from './category-status';

const workspaceId = asWorkspaceId('workspace');
const category: Category = {
  id: asCategoryId('category'),
  workspaceId,
  parentId: null,
  name: 'Math',
  icon: null,
  color: null,
  importanceWeight: 5,
  statusOverride: null,
  createdAt: '',
  updatedAt: ''
};
const topic: Topic = {
  id: asTopicId('topic'),
  workspaceId,
  categoryId: category.id,
  name: 'Algebra',
  createdAt: '',
  updatedAt: ''
};
const task = (id: string, status: Task['status'], weight = 5): Task => ({
  id: asTaskId(id),
  workspaceId,
  topicId: topic.id,
  title: id,
  icon: null,
  taskWeight: weight,
  status,
  statusChangedAt: null,
  doneDate: null,
  createdAt: '',
  updatedAt: ''
});

describe('calculateCategoryStatus', () => {
  test('is in progress before every non-skipped task is done', () => {
    const result = calculateCategoryStatus({
      categoryId: category.id,
      categories: [category],
      topics: [topic],
      tasks: [task('a', 'done'), task('b', 'todo'), task('skipped', 'skipped')]
    });
    expect(result.status).toBe('in_progress');
    expect(result.completionPercentage).toBe(50);
    expect(result.totalTasks).toBe(2);
  });

  test('is done when every non-skipped task is done', () => {
    const result = calculateCategoryStatus({
      categoryId: category.id,
      categories: [category],
      topics: [topic],
      tasks: [task('a', 'done'), task('skipped', 'skipped')]
    });
    expect(result.status).toBe('done');
    expect(result.completionPercentage).toBe(100);
  });

  test('honours overrides in any mode and only done in done_only mode', () => {
    const overridden = { ...category, statusOverride: 'todo' as const };
    expect(
      calculateCategoryStatus({
        categoryId: category.id,
        categories: [overridden],
        topics: [topic],
        tasks: [task('a', 'done')]
      }).status
    ).toBe('todo');
    expect(
      calculateCategoryStatus({
        categoryId: category.id,
        categories: [overridden],
        topics: [topic],
        tasks: [task('a', 'done')],
        overrideMode: 'done_only'
      }).status
    ).toBe('done');
  });
});
