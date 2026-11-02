import { describe, expect, test } from 'bun:test';
import type { Task, Topic } from '#lib/domain/models/hierarchy.js';
import { asCategoryId, asTaskId, asTopicId, asWorkspaceId } from '#lib/domain/models/identifiers.js';
import { taskDisplayName } from './task-display.js';

const workspaceId = asWorkspaceId('workspace');
const topic: Topic = {
  id: asTopicId('topic'),
  workspaceId,
  categoryId: asCategoryId('category'),
  name: 'Algebra',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z'
};
const task: Task = {
  id: asTaskId('task'),
  workspaceId,
  topicId: topic.id,
  title: 'Solve quadratics',
  icon: null,
  taskWeight: 3,
  status: 'todo',
  statusChangedAt: null,
  doneDate: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z'
};

describe('task display names', () => {
  test('prefixes the topic name', () => {
    expect(taskDisplayName(task, topic)).toBe('Algebra · Solve quadratics');
  });

  test('falls back to the task title when the topic is missing', () => {
    expect(taskDisplayName(task, undefined)).toBe('Solve quadratics');
  });
});
