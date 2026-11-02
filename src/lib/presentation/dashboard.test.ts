import { describe, expect, test } from 'bun:test';
import { asCategoryId, asTaskId, asTopicId, asWeeklyPoolEntryId, asWorkspaceId } from '#lib/domain/models/identifiers.js';
import type { ActivityLog } from '#lib/domain/models/execution.js';
import type { Category, Task, Topic } from '#lib/domain/models/hierarchy.js';
import type { WeeklyPoolEntry } from '#lib/domain/models/planning.js';
import { categoryBalance, dailyCompletion } from './dashboard';

const workspaceId = asWorkspaceId('workspace');

function category(id: string, parentId: string | null = null, name = id): Category {
  return {
    id: asCategoryId(id), workspaceId, parentId: parentId === null ? null : asCategoryId(parentId), name,
    icon: null,
    color: null,
    importanceWeight: 3, createdAt: '', updatedAt: ''
  };
}
function topic(id: string, categoryId: string): Topic {
  return { id: asTopicId(id), workspaceId, categoryId: asCategoryId(categoryId), name: id, createdAt: '', updatedAt: '' };
}
function task(id: string, topicId: string, taskWeight: number): Task {
  return { id: asTaskId(id), workspaceId, topicId: asTopicId(topicId), title: id, icon: null, taskWeight, status: 'todo', statusChangedAt: null, doneDate: null, createdAt: '', updatedAt: '' };
}
function entry(id: string, taskId: string): WeeklyPoolEntry {
  return { id: asWeeklyPoolEntryId(id), workspaceId, taskId: asTaskId(taskId), weekStart: '2026-10-26', plannedDate: null, status: 'todo', completedDate: null, createdAt: '' };
}
function log(id: string, completedDate: string): ActivityLog {
  return { id: id as ActivityLog['id'], workspaceId, taskId: asTaskId('task'), entryId: null, completedDate, note: null, taskName: null, topicName: null, categoryName: null, createdAt: '' };
}

describe('dailyCompletion', () => {
  test('counts only the seven days from the week start', () => {
    const days = dailyCompletion(
      [log('a', '2026-10-26'), log('b', '2026-10-26'), log('c', '2026-10-28'), log('d', '2026-11-02')],
      '2026-10-26'
    );
    expect(days.map((day) => day.count)).toEqual([2, 0, 1, 0, 0, 0, 0]);
  });
});

describe('categoryBalance', () => {
  test('rolls child categories into their root and splits completed effort', () => {
    const balances = categoryBalance(
      [category('math'), category('algebra', 'math', 'Algebra'), category('physics')],
      [topic('math-topic', 'math'), topic('algebra-topic', 'algebra'), topic('physics-topic', 'physics')],
      [task('math-task', 'math-topic', 3), task('algebra-task', 'algebra-topic', 2), task('physics-task', 'physics-topic', 4)],
      [
        { ...entry('e1', 'math-task'), status: 'done' },
        entry('e2', 'algebra-task'),
        entry('e3', 'physics-task')
      ]
    );
    expect(balances.map((item) => [item.category.name, item.completedWeight, item.plannedWeight])).toEqual([
      ['math', 3, 5],
      ['physics', 0, 4]
    ]);
  });
});
