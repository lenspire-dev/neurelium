import type {
  RecommendationResult,
  StudyRecommendation,
} from '../models/analytics';
import type { WeekStart } from '../models/common';
import type { ActivityLog } from '../models/execution';
import type { Category, Task, Topic } from '../models/hierarchy';
import type { CategoryId, TaskId } from '../models/identifiers';
import type { WeeklyPoolEntry } from '../models/planning';
import { isWithinDateRange } from './week';

export interface RecommendationContext {
  readonly weekStart: WeekStart;
  readonly today: string;
  readonly poolEntries: readonly WeeklyPoolEntry[];
  readonly tasks: readonly Task[];
  readonly topics: readonly Topic[];
  readonly categories: readonly Category[];
  readonly activityLogs: readonly ActivityLog[];
}

const DEFAULT_LIMIT = 3;
const IMPORTANCE_FACTOR = 2;

interface CandidateCategory {
  readonly category: Category;
  readonly tasks: Task[];
  readonly completedWeight: number;
  remainingWeight: number;
}

interface Focus {
  readonly category: Category;
  readonly completedWeight: number;
}

export function recommendStudyTasks(
  context: RecommendationContext,
  limit = DEFAULT_LIMIT
): RecommendationResult {
  const maxResults = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : DEFAULT_LIMIT;
  if (maxResults === 0) return { primary: null, alternatives: [] };

  const categoryById = new Map(context.categories.map((category) => [category.id, category]));
  const topicById = new Map(context.topics.map((topic) => [topic.id, topic]));
  const taskById = new Map(context.tasks.map((task) => [task.id, task]));

  const weekLogs = context.activityLogs.filter((log) =>
    isWithinDateRange(log.completedDate, context.weekStart, context.today)
  );

  const completedTaskIds = new Set<TaskId>(weekLogs.map((log) => log.taskId));
  const activityByCategory = new Map<CategoryId, number>();
  let totalCompletedWeight = 0;

  for (const log of weekLogs) {
    const category = categoryForLog(log, taskById, topicById, categoryById);
    if (category === null) continue;
    const weight = taskById.get(log.taskId)?.taskWeight ?? 0;
    if (weight < 0) continue;
    activityByCategory.set(
      category.id,
      (activityByCategory.get(category.id) ?? 0) + weight
    );
    totalCompletedWeight += weight;
  }

  const candidateByCategory = new Map<CategoryId, CandidateCategory>();
  const remainingTaskIds = new Set<TaskId>();

  for (const entry of context.poolEntries) {
    if (entry.weekStart !== context.weekStart) continue;
    if (entry.status === 'done' || entry.status === 'skipped') continue;
    // Legacy rows predate occurrence status; their completion lives only in logs.
    if (entry.status === 'todo' && completedTaskIds.has(entry.taskId)) continue;
    if (remainingTaskIds.has(entry.taskId)) continue;

    const task = taskById.get(entry.taskId);
    if (task === undefined) continue;
    const topic = topicById.get(task.topicId);
    if (topic === undefined) continue;
    const category = categoryById.get(topic.categoryId);
    if (category === undefined) continue;

    remainingTaskIds.add(task.id);
    const candidate = candidateByCategory.get(category.id) ?? {
      category,
      tasks: [],
      completedWeight: activityByCategory.get(category.id) ?? 0,
      remainingWeight: 0,
    };
    candidate.tasks.push(task);
    candidate.remainingWeight += task.taskWeight;
    candidateByCategory.set(category.id, candidate);
  }

  const candidates = [...candidateByCategory.values()];
  if (candidates.length === 0) return { primary: null, alternatives: [] };

  const totalImportance = candidates.reduce(
    (sum, candidate) => sum + candidate.category.importanceWeight,
    0
  );
  const totalRemainingWeight = candidates.reduce(
    (sum, candidate) => sum + candidate.remainingWeight,
    0
  );

  const focus = findFocus(activityByCategory, categoryById);
  const averageImportance = totalImportance / candidates.length;

  const ranked = candidates
    .flatMap((candidate) => {
      const importanceShare = share(candidate.category.importanceWeight, totalImportance);
      const remainingShare = share(candidate.remainingWeight, totalRemainingWeight);
      const focusShare = share(candidate.completedWeight, totalCompletedWeight);
      const categoryFactor =
        1 + IMPORTANCE_FACTOR * importanceShare + remainingShare - focusShare;

      return candidate.tasks.map((task) => ({
        task,
        score: task.taskWeight * categoryFactor,
        candidate,
      }));
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.task.taskWeight - a.task.taskWeight ||
        a.task.id.localeCompare(b.task.id)
    )
    .slice(0, maxResults);

  const recommendations: StudyRecommendation[] = ranked.map(({ task, score, candidate }) => ({
    task,
    topic: topicById.get(task.topicId) as Topic,
    category: candidate.category,
    score,
    explanation: explain({
      category: candidate.category,
      completedWeight: candidate.completedWeight,
      remainingWeight: candidate.remainingWeight,
      focus,
      totalCompletedWeight,
      totalImportance: averageImportance,
      candidateCount: candidates.length,
    }),
  }));

  return {
    primary: recommendations[0] ?? null,
    alternatives: recommendations.slice(1),
  };
}

function categoryForLog(
  log: ActivityLog,
  taskById: ReadonlyMap<TaskId, Task>,
  topicById: ReadonlyMap<string, Topic>,
  categoryById: ReadonlyMap<CategoryId, Category>
): Category | null {
  const task = taskById.get(log.taskId);
  if (task === undefined) return null;
  const topic = topicById.get(task.topicId);
  if (topic === undefined) return null;
  return categoryById.get(topic.categoryId) ?? null;
}

function findFocus(
  activityByCategory: ReadonlyMap<CategoryId, number>,
  categoryById: ReadonlyMap<CategoryId, Category>
): Focus | null {
  let focus: Focus | null = null;
  for (const [categoryId, completedWeight] of activityByCategory) {
    const category = categoryById.get(categoryId);
    if (category === undefined) continue;
    if (
      focus === null ||
      completedWeight > focus.completedWeight ||
      (completedWeight === focus.completedWeight &&
        category.id.localeCompare(focus.category.id) < 0)
    ) {
      focus = { category, completedWeight };
    }
  }
  return focus;
}

function share(value: number, total: number): number {
  return total > 0 ? value / total : 0;
}

function explain(input: {
  category: Category;
  completedWeight: number;
  remainingWeight: number;
  focus: Focus | null;
  totalCompletedWeight: number;
  totalImportance: number;
  candidateCount: number;
}): string {
  const importance = importanceLabel(
    input.category.importanceWeight,
    input.totalImportance,
    input.candidateCount
  );

  if (
    input.totalCompletedWeight > 0 &&
    input.focus !== null &&
    input.completedWeight < input.focus.completedWeight
  ) {
    const activity =
      input.completedWeight === 0
        ? 'zero activity'
        : `only ${formatNumber(input.completedWeight)} completed weight`;
    return `Suggested because you focused heavily on ${input.focus.category.name} this week (${formatNumber(input.focus.completedWeight)} weight), and ${input.category.name} has ${importance} importance but ${activity}.`;
  }

  if (input.totalCompletedWeight === 0) {
    return `Suggested because no tasks have been completed this week yet, and ${input.category.name} has ${importance} importance with ${formatNumber(input.remainingWeight)} weight remaining.`;
  }

  return `Suggested because ${input.category.name} has ${importance} importance and ${formatNumber(input.remainingWeight)} weight remaining this week (${formatNumber(input.completedWeight)} completed).`;
}

function importanceLabel(
  importanceWeight: number,
  averageImportance: number,
  candidateCount: number
): 'high' | 'moderate' | 'low' {
  if (candidateCount <= 1 || averageImportance === 0) return 'moderate';
  if (importanceWeight > averageImportance * 1.1) return 'high';
  if (importanceWeight < averageImportance * 0.9) return 'low';
  return 'moderate';
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
