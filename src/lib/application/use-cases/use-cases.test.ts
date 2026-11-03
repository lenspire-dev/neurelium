import { describe, expect, test } from 'bun:test';
import type { Milestone } from '../../domain/models/analytics';
import type { ActivityLog } from '../../domain/models/execution';
import type { Category, Task, Topic } from '../../domain/models/hierarchy';
import {
  asMilestoneId,
  asWorkspaceId,
  type CategoryId,
  type MilestoneId,
  type TaskId,
  type TopicId,
  type WeeklyPoolEntryId,
} from '../../domain/models/identifiers';
import type { WeeklyPoolEntry } from '../../domain/models/planning';
import type { ActivityLogRepository } from '../../domain/ports/activity-log-repository';
import type { CategoryRepository } from '../../domain/ports/category-repository';
import type { MilestoneRepository } from '../../domain/ports/milestone-repository';
import type { TaskRepository } from '../../domain/ports/task-repository';
import type { TopicRepository } from '../../domain/ports/topic-repository';
import type { WeeklyPoolRepository } from '../../domain/ports/weekly-pool-repository';
import { getMilestoneProgress, getStudyRecommendation } from './analytics';
import {
  completeTask,
  removeRepeatedCompletion,
  removeWeekCompletion,
  repeatTaskCompletion,
  setWeeklyEntryStatus
} from './execution';
import {
  createCategory,
  createTask,
  createTopic,
  setTaskStatus,
  updateCategory,
} from './hierarchy';
import { createMilestone } from './milestones';
import {
  addTaskToWeek,
  previewWeekRollover,
  rolloverWeek,
} from './planning';

const workspaceId = asWorkspaceId('workspace');
const weekStart = '2026-10-26';
const nextWeek = '2026-11-02';
const today = '2026-10-28';

function createHarness() {
  const categories = new Map<CategoryId, Category>();
  const topics = new Map<TopicId, Topic>();
  const tasks = new Map<TaskId, Task>();
  const entries = new Map<WeeklyPoolEntryId, WeeklyPoolEntry>();
  const logs = new Map<string, ActivityLog>();
  const milestones = new Map<MilestoneId, Milestone>();

  const categoryRepository: CategoryRepository = {
    async findById(workspace, categoryId) {
      const category = categories.get(categoryId);
      return category?.workspaceId === workspace ? category : null;
    },
    async listByWorkspace(workspace) {
      return [...categories.values()].filter((item) => item.workspaceId === workspace);
    },
    async listChildren(workspace, parentId) {
      return [...categories.values()].filter(
        (item) => item.workspaceId === workspace && item.parentId === parentId
      );
    },
    async save(category) {
      categories.set(category.id, category);
      return category;
    },
    async delete(workspace, categoryId) {
      const category = categories.get(categoryId);
      if (category?.workspaceId === workspace) categories.delete(categoryId);
    },
  };

  const topicRepository: TopicRepository = {
    async findById(workspace, topicId) {
      const topic = topics.get(topicId);
      return topic?.workspaceId === workspace ? topic : null;
    },
    async listByWorkspace(workspace) {
      return [...topics.values()].filter((item) => item.workspaceId === workspace);
    },
    async listByCategory(workspace, categoryId) {
      return [...topics.values()].filter(
        (item) => item.workspaceId === workspace && item.categoryId === categoryId
      );
    },
    async save(topic) {
      topics.set(topic.id, topic);
      return topic;
    },
    async delete(workspace, topicId) {
      const topic = topics.get(topicId);
      if (topic?.workspaceId === workspace) topics.delete(topicId);
    },
  };

  const taskRepository: TaskRepository = {
    async findById(workspace, taskId) {
      const task = tasks.get(taskId);
      return task?.workspaceId === workspace ? task : null;
    },
    async listByWorkspace(workspace) {
      return [...tasks.values()].filter((item) => item.workspaceId === workspace);
    },
    async listByTopic(workspace, topicId) {
      return [...tasks.values()].filter(
        (item) => item.workspaceId === workspace && item.topicId === topicId
      );
    },
    async save(task) {
      tasks.set(task.id, task);
      return task;
    },
    async delete(workspace, taskId) {
      const task = tasks.get(taskId);
      if (task?.workspaceId === workspace) tasks.delete(taskId);
    },
  };

  const weeklyPoolRepository: WeeklyPoolRepository = {
    async findById(workspace, entryId) {
      const entry = entries.get(entryId);
      return entry?.workspaceId === workspace ? entry : null;
    },
    async listByWeek(workspace, targetWeek) {
      return [...entries.values()].filter(
        (item) => item.workspaceId === workspace && item.weekStart === targetWeek
      );
    },
    async listByTask(workspace, taskId) {
      return [...entries.values()].filter(
        (item) => item.workspaceId === workspace && item.taskId === taskId
      );
    },
    async save(entry) {
      entries.set(entry.id, entry);
      return entry;
    },
    async delete(workspace, entryId) {
      const entry = entries.get(entryId);
      if (entry?.workspaceId === workspace) entries.delete(entryId);
    },
  };

  const activityLogRepository: ActivityLogRepository = {
    async listByWorkspace(workspace) {
      return [...logs.values()].filter((item) => item.workspaceId === workspace);
    },
    async listByDateRange(workspace, from, to) {
      return [...logs.values()].filter(
        (item) =>
          item.workspaceId === workspace &&
          item.completedDate >= from &&
          item.completedDate <= to
      );
    },
    async listByTask(workspace, taskId) {
      return [...logs.values()].filter(
        (item) => item.workspaceId === workspace && item.taskId === taskId
      );
    },
    async save(log) {
      logs.set(log.id, log);
      return log;
    },
    async delete(workspace, logId) {
      const log = logs.get(logId);
      if (log?.workspaceId === workspace) logs.delete(logId);
    },
  };

  const milestoneRepository: MilestoneRepository = {
    async findById(workspace, milestoneId) {
      const milestone = milestones.get(milestoneId);
      return milestone?.workspaceId === workspace ? milestone : null;
    },
    async listByWorkspace(workspace) {
      return [...milestones.values()].filter((item) => item.workspaceId === workspace);
    },
    async save(milestone) {
      milestones.set(milestone.id, milestone);
      return milestone;
    },
    async delete(workspace, milestoneId) {
      const milestone = milestones.get(milestoneId);
      if (milestone?.workspaceId === workspace) milestones.delete(milestoneId);
    },
  };

  let sequence = 0;
  return {
    categories: categoryRepository,
    topics: topicRepository,
    tasks: taskRepository,
    weeklyPool: weeklyPoolRepository,
    activityLogs: activityLogRepository,
    milestones: milestoneRepository,
    clock: { now: () => new Date('2026-10-28T12:00:00.000Z') },
    ids: { next: () => `id-${++sequence}` },
  };
}

async function seedTask(
  harness: ReturnType<typeof createHarness>,
  name: string,
  weight: number
): Promise<{ category: Category; topic: Topic; task: Task }> {
  const category = await createCategory(harness, {
    workspaceId,
    parentId: null,
    name: `${name} category`,
    importanceWeight: 5,
  });
  const topic = await createTopic(harness, {
    workspaceId,
    categoryId: category.id,
    name: `${name} topic`,
  });
  const task = await createTask(harness, {
    workspaceId,
    topicId: topic.id,
    title: `${name} task`,
    taskWeight: weight,
  });
  return { category, topic, task };
}

describe('hierarchy use cases', () => {
  test('creates a trimmed category with clock timestamps', async () => {
    const harness = createHarness();

    const category = await createCategory(harness, {
      workspaceId,
      parentId: null,
      name: '  Math  ',
      color: 'teal',
      importanceWeight: 5,
    });

    expect(category.name).toBe('Math');
    expect(category.color).toBe('teal');
    expect(category.importanceWeight).toBe(5);
    expect(category.parentId).toBeNull();
    expect(category.createdAt).toBe('2026-10-28T12:00:00.000Z');
  });

  test('rejects an unsupported category color', async () => {
    const harness = createHarness();

    await expect(
      createCategory(harness, {
        workspaceId,
        parentId: null,
        name: 'Math',
        color: 'crimson' as never,
        importanceWeight: 5,
      })
    ).rejects.toThrow('Category color');
  });

  test('rejects a non-positive task weight', async () => {
    const harness = createHarness();
    const category = await createCategory(harness, {
      workspaceId,
      parentId: null,
      name: 'Math',
      importanceWeight: 5,
    });
    const topic = await createTopic(harness, {
      workspaceId,
      categoryId: category.id,
      name: 'Algebra',
    });

    await expect(
      createTask(harness, {
        workspaceId,
        topicId: topic.id,
        title: 'Bad task',
        taskWeight: 0,
      })
    ).rejects.toThrow('Task weight');
  });

  test('blocks a category move that would create a cycle', async () => {
    const harness = createHarness();
    const root = await createCategory(harness, {
      workspaceId,
      parentId: null,
      name: 'Math',
      importanceWeight: 5,
    });
    const child = await createCategory(harness, {
      workspaceId,
      parentId: root.id,
      name: 'Algebra',
      importanceWeight: 5,
    });
    const grandchild = await createCategory(harness, {
      workspaceId,
      parentId: child.id,
      name: 'Linear Algebra',
      importanceWeight: 5,
    });

    await expect(
      updateCategory(harness, {
        workspaceId,
        categoryId: root.id,
        parentId: grandchild.id,
      })
    ).rejects.toThrow('cycle');
  });
});

describe('planning use cases', () => {
  test('allows repeatable tasks in and across weeks', async () => {
    const harness = createHarness();
    const { task } = await seedTask(harness, 'Math', 5);

    await addTaskToWeek(harness, { workspaceId, taskId: task.id, weekStart });
    await addTaskToWeek(harness, { workspaceId, taskId: task.id, weekStart });
    await addTaskToWeek(harness, { workspaceId, taskId: task.id, weekStart: nextWeek });

    expect(await harness.weeklyPool.listByTask(workspaceId, task.id)).toHaveLength(3);
  });

  test('rolls over only incomplete tasks', async () => {
    const harness = createHarness();
    const finished = await seedTask(harness, 'Finished', 5);
    const pending = await seedTask(harness, 'Pending', 5);
    await addTaskToWeek(harness, {
      workspaceId,
      taskId: finished.task.id,
      weekStart,
    });
    await addTaskToWeek(harness, {
      workspaceId,
      taskId: pending.task.id,
      weekStart,
    });
    await completeTask(harness, {
      workspaceId,
      taskId: finished.task.id,
      weekStart,
      completedDate: '2026-10-27',
    });

    const preview = await previewWeekRollover(harness, { workspaceId, weekStart });
    expect(preview.completed).toHaveLength(1);
    expect(preview.incomplete).toHaveLength(1);

    const moved = await rolloverWeek(harness, {
      workspaceId,
      fromWeekStart: weekStart,
      toWeekStart: nextWeek,
    });

    expect(moved).toHaveLength(1);
    expect(moved[0]?.taskId).toBe(pending.task.id);
    expect(await harness.weeklyPool.listByWeek(workspaceId, nextWeek)).toHaveLength(1);
    expect(await harness.weeklyPool.listByWeek(workspaceId, weekStart)).toHaveLength(1);
  });
});

describe('execution use cases', () => {
  test('logs a completion with a trimmed note and blocks duplicates', async () => {
    const harness = createHarness();
    const { task } = await seedTask(harness, 'Math', 5);
    await addTaskToWeek(harness, { workspaceId, taskId: task.id, weekStart });

    const log = await completeTask(harness, {
      workspaceId,
      taskId: task.id,
      weekStart,
      completedDate: '2026-10-28',
      note: '  solved chapter 3  ',
    });

    expect(log.note).toBe('solved chapter 3');
    expect(log.completedDate).toBe(today);

    await expect(
      completeTask(harness, {
        workspaceId,
        taskId: task.id,
        weekStart,
        completedDate: '2026-10-28',
      })
    ).rejects.toThrow('already completed');
  });

  test('removes the current week completion when reopening a task', async () => {
    const harness = createHarness();
    const { task } = await seedTask(harness, 'Math', 5);
    await addTaskToWeek(harness, { workspaceId, taskId: task.id, weekStart });
    await completeTask(harness, {
      workspaceId,
      taskId: task.id,
      weekStart,
      completedDate: '2026-10-27',
    });

    await removeWeekCompletion(harness, {
      workspaceId,
      taskId: task.id,
      weekStart,
    });

    expect(await harness.activityLogs.listByTask(workspaceId, task.id)).toHaveLength(0);
  });

  test('keeps the task status manual while completing one occurrence', async () => {
    const harness = createHarness();
    const { task } = await seedTask(harness, 'Math', 5);
    const entry = await addTaskToWeek(harness, {
      workspaceId,
      taskId: task.id,
      weekStart,
    });

    const completed = await setWeeklyEntryStatus(harness, {
      workspaceId,
      entryId: entry.id,
      status: 'done',
      completedDate: '2026-10-28',
    });

    expect(completed.entry.status).toBe('done');
    expect(completed.entry.completedDate).toBe('2026-10-28');
    expect(completed.log?.entryId).toBe(entry.id);
    expect(completed.log?.taskName).toBe(task.title);
    expect((await harness.tasks.findById(workspaceId, task.id))?.status).toBe('todo');

    const reopened = await setWeeklyEntryStatus(harness, {
      workspaceId,
      entryId: entry.id,
      status: 'in_progress',
    });

    expect(reopened.entry.status).toBe('in_progress');
    expect(reopened.entry.completedDate).toBeNull();
    expect(await harness.activityLogs.listByTask(workspaceId, task.id)).toHaveLength(0);
  });

  test('adds and removes repeated completions on the same day', async () => {
    const harness = createHarness();
    const { task } = await seedTask(harness, 'Math', 5);
    const entry = await addTaskToWeek(harness, {
      workspaceId,
      taskId: task.id,
      weekStart,
    });
    await completeTask(harness, {
      workspaceId,
      taskId: task.id,
      weekStart,
      completedDate: '2026-10-28',
      entryId: entry.id,
    });

    await repeatTaskCompletion(harness, { workspaceId, entryId: entry.id });
    await repeatTaskCompletion(harness, { workspaceId, entryId: entry.id });

    expect(await harness.activityLogs.listByTask(workspaceId, task.id)).toHaveLength(3);

    await removeRepeatedCompletion(harness, { workspaceId, entryId: entry.id });

    expect(await harness.activityLogs.listByTask(workspaceId, task.id)).toHaveLength(2);
    expect((await harness.weeklyPool.findById(workspaceId, entry.id))?.status).toBe('done');
    await expect(
      removeRepeatedCompletion(harness, { workspaceId, entryId: entry.id })
    ).resolves.toBeDefined();
    await expect(
      removeRepeatedCompletion(harness, { workspaceId, entryId: entry.id })
    ).rejects.toThrow('only completion');
  });

  test('rejects completions outside the planned week', async () => {
    const harness = createHarness();
    const { task } = await seedTask(harness, 'Math', 5);
    await addTaskToWeek(harness, { workspaceId, taskId: task.id, weekStart });

    await expect(
      completeTask(harness, {
        workspaceId,
        taskId: task.id,
        weekStart,
        completedDate: '2026-11-02',
      })
    ).rejects.toThrow('inside the planned week');
  });
});

describe('task status use cases', () => {
  test('defaults new tasks to todo and updates lifecycle dates', async () => {
    const harness = createHarness();
    const { task } = await seedTask(harness, 'Math', 5);

    expect(task.status).toBe('todo');
    expect(task.statusChangedAt).toBeNull();
    expect(task.doneDate).toBeNull();

    const started = await setTaskStatus(harness, {
      workspaceId,
      taskId: task.id,
      status: 'in_progress',
    });
    expect(started.status).toBe('in_progress');
    expect(started.statusChangedAt).toBe('2026-10-28T12:00:00.000Z');
    expect(started.doneDate).toBeNull();

    const done = await setTaskStatus(harness, {
      workspaceId,
      taskId: task.id,
      status: 'done',
      doneDate: '2026-10-20',
    });
    expect(done.doneDate).toBe('2026-10-20');

    const reopened = await setTaskStatus(harness, {
      workspaceId,
      taskId: task.id,
      status: 'todo',
    });
    expect(reopened.doneDate).toBeNull();

    const skipped = await setTaskStatus(harness, {
      workspaceId,
      taskId: task.id,
      status: 'skipped',
    });
    expect(skipped.status).toBe('skipped');
    expect(skipped.doneDate).toBeNull();
  });

  test('defaults the done date and rejects done dates for open tasks', async () => {
    const harness = createHarness();
    const { task } = await seedTask(harness, 'Math', 5);

    await expect(
      setTaskStatus(harness, {
        workspaceId,
        taskId: task.id,
        status: 'in_progress',
        doneDate: '2026-10-20',
      })
    ).rejects.toThrow('only available for done');

    const done = await setTaskStatus(harness, {
      workspaceId,
      taskId: task.id,
      status: 'done',
    });
    expect(done.doneDate).toBe('2026-10-28');
  });
});

describe('analytics use cases', () => {
  test('recommends a neglected category through repositories', async () => {
    const harness = createHarness();
    const math = await seedTask(harness, 'Math', 5);
    const mathRemaining = await createTask(harness, {
      workspaceId,
      topicId: math.topic.id,
      title: 'Math remaining',
      taskWeight: 5,
    });
    const physics = await seedTask(harness, 'Physics', 5);
    const mathCategory = await harness.categories.findById(workspaceId, math.category.id);
    expect(mathCategory).not.toBeNull();
    if (mathCategory !== null) {
      await harness.categories.save({
        ...mathCategory,
        importanceWeight: 4,
      });
    }
    const physicsCategory = await harness.categories.findById(
      workspaceId,
      physics.category.id
    );
    expect(physicsCategory).not.toBeNull();
    if (physicsCategory !== null) {
      await harness.categories.save({
        ...physicsCategory,
        importanceWeight: 4,
      });
    }

    await addTaskToWeek(harness, {
      workspaceId,
      taskId: math.task.id,
      weekStart,
    });
    await addTaskToWeek(harness, {
      workspaceId,
      taskId: mathRemaining.id,
      weekStart,
    });
    await addTaskToWeek(harness, {
      workspaceId,
      taskId: physics.task.id,
      weekStart,
    });
    await completeTask(harness, {
      workspaceId,
      taskId: math.task.id,
      weekStart,
      completedDate: '2026-10-27',
    });

    const result = await getStudyRecommendation(harness, {
      workspaceId,
      weekStart,
      today,
    });

    expect(result.primary?.task.id).toBe(physics.task.id);
    expect(result.primary?.explanation).toContain('focused heavily on');
  });

  test('returns weighted milestone progress and rejects missing milestones', async () => {
    const harness = createHarness();
    const { category, task } = await seedTask(harness, 'Math', 5);
    const milestone = await createMilestone(harness, {
      workspaceId,
      title: 'Finish Math',
      scope: { kind: 'category', categoryId: category.id },
      targetPercentage: 100,
      dueDate: '2026-10-31',
    });
    await addTaskToWeek(harness, { workspaceId, taskId: task.id, weekStart });
    await completeTask(harness, {
      workspaceId,
      taskId: task.id,
      weekStart,
      completedDate: '2026-10-28',
    });

    const progress = await getMilestoneProgress(harness, {
      workspaceId,
      milestoneId: milestone.id,
      today: '2026-10-31',
    });

    expect(progress.completedWeight).toBe(5);
    expect(progress.totalWeight).toBe(5);
    expect(progress.completionPercentage).toBe(100);

    await expect(
      getMilestoneProgress(harness, {
        workspaceId,
        milestoneId: asMilestoneId('missing'),
        today,
      })
    ).rejects.toThrow('Milestone not found');
  });
});
