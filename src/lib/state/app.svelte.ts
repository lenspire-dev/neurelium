import {
  PUBLIC_APPWRITE_DATABASE_ID,
  PUBLIC_APPWRITE_ENDPOINT,
  PUBLIC_APPWRITE_PROJECT_ID
} from '$app/env/public';
import {
  addDays,
  endOfWeek,
  isWithinDateRange,
  startOfWeek,
  toIsoDate
} from '#lib/domain/algorithms/week.js';
import { calculateMilestoneProgress } from '#lib/domain/algorithms/milestone-progress.js';
import { categoryDescendantIds } from '#lib/presentation/tree.js';
import type { ImportCategory } from '#lib/presentation/json-import.js';
import { recommendStudyTasks } from '#lib/domain/algorithms/recommendation.js';
import type {
  ActivityAction,
  ActivityEntityType,
  ActivityEvent
} from '#lib/domain/models/activity.js';
import type {
  Milestone,
  MilestoneProgress,
  RecommendationResult
} from '#lib/domain/models/analytics.js';
import type { CategoryColor } from '#lib/domain/models/category-color.js';
import type { CategoryStatus } from '#lib/domain/models/category-status.js';
import type { IsoDate, WeekStart } from '#lib/domain/models/common.js';
import type { ActivityLog } from '#lib/domain/models/execution.js';
import type {
  Category,
  Task,
  Topic
} from '#lib/domain/models/hierarchy.js';
import type { WeeklyPoolEntry } from '#lib/domain/models/planning.js';
import type { Workspace, WorkspaceDefaultView, WorkspaceWeekStart } from '#lib/domain/models/workspace.js';
import type {
  WorkspaceMember,
  WorkspaceRole
} from '#lib/domain/models/workspace-member.js';
import type { TaskStatus } from '#lib/domain/models/task-status.js';
import type { WeightGrade } from '#lib/domain/models/weight.js';
import {
  asActivityEventId,
  asActivityLogId,
  asCategoryId,
  asTopicId,
  asMilestoneId,
  asTaskId,
  asWeeklyPoolEntryId,
  asWorkspaceId
} from '#lib/domain/models/identifiers.js';
import type { AuthenticatedUser } from '#lib/domain/ports/auth-port.js';
import { createAppwriteInfrastructureFromEnv } from '#lib/infrastructure/appwrite/index.js';
import { isNotFoundError } from '#lib/infrastructure/appwrite/errors.js';
import {
  addTaskToWeek,
  completeTask,
  createCategory,
  createMilestone,
  createTask,
  createTopic,
  deleteMilestone,
  removeRepeatedCompletion,
  removeWeeklyPoolEntry,
  repeatTaskCompletion,
  scheduleWeeklyPoolEntry,
  setTaskStatus as setTaskStatusUseCase,
  setWeeklyEntryStatus,
  updateCategory,
  updateMilestone,
  updateTask,
  updateTopic
} from '#lib/application/index.js';

type Infrastructure = ReturnType<typeof createAppwriteInfrastructureFromEnv>;
type SessionState = 'loading' | 'signed-out' | 'signed-in';

interface ImportFunctionResult {
  readonly ok?: boolean;
  readonly error?: string;
  readonly categories?: number;
  readonly topics?: number;
  readonly tasks?: number;
}

const EMPTY_RECOMMENDATION: RecommendationResult = { primary: null, alternatives: [] };
const ACTIVE_WORKSPACE_KEY = 'neurelium-active-workspace';

function storedWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

function storeWorkspaceId(workspaceId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
  } catch {
    /* storage can be unavailable in private mode */
  }
}

export class AppStore {
  session = $state<SessionState>('loading');
  user = $state<AuthenticatedUser | null>(null);
  workspaces = $state<readonly Workspace[]>([]);
  workspace = $state<Workspace | null>(null);
  members = $state<readonly WorkspaceMember[]>([]);
  membersLoading = $state(false);
  categories = $state<readonly Category[]>([]);
  topics = $state<readonly Topic[]>([]);
  tasks = $state<readonly Task[]>([]);
  milestones = $state<readonly Milestone[]>([]);
  milestoneProgress = $state<readonly MilestoneProgress[]>([]);
  activityLogs = $state<readonly ActivityLog[]>([]);
  activityEvents = $state<readonly ActivityEvent[]>([]);
  weekEntries = $state<readonly WeeklyPoolEntry[]>([]);
  recommendation = $state<RecommendationResult>(EMPTY_RECOMMENDATION);
  weekStart = $state<WeekStart>(startOfWeek(toIsoDate(new Date())));
  today = $state<IsoDate>(toIsoDate(new Date()));
  busy = $state(false);
  error = $state<string | null>(null);
  initialized = $state(false);

  private infrastructure: Infrastructure | null = null;
  private initPromise: Promise<void> | null = null;
  private loadToken = 0;
  private writeQueue = new Map<string, Promise<void>>();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private optimisticSeq = 0;
  private eventsAvailable = true;
  private realtimeUnsubscribe: (() => void) | null = null;
  private realtimeWorkspaceId: string | null = null;

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise !== null) return this.initPromise;
    this.initPromise = this.initialize();
    return this.initPromise;
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.withBusy(async () => {
      const infra = this.requireInfrastructure();
      const user = await infra.auth.signIn({ email, password });
      this.user = user;
      this.session = 'signed-in';
      await this.loadWorkspaces();
    });
  }

  async signUp(name: string, email: string, password: string): Promise<void> {
    await this.withBusy(async () => {
      const infra = this.requireInfrastructure();
      const user = await infra.auth.signUp({ name, email, password });
      this.user = user;
      this.session = 'signed-in';
      await this.loadWorkspaces();
    });
  }

  async signOut(): Promise<void> {
    await this.withBusy(async () => {
      await this.requireInfrastructure().auth.signOut();
      this.user = null;
      this.session = 'signed-out';
      this.workspace = null;
      this.workspaces = [];
      this.members = [];
      this.clearWorkspaceData();
    });
  }

  async updateName(name: string): Promise<void> {
    await this.withBusy(async () => {
      this.user = await this.requireInfrastructure().auth.updateName(name);
    });
  }

  async updateEmail(email: string, password: string): Promise<void> {
    await this.withBusy(async () => {
      this.user = await this.requireInfrastructure().auth.updateEmail({ email, password });
    });
  }

  async updatePassword(password: string, oldPassword: string): Promise<void> {
    await this.withBusy(async () => {
      await this.requireInfrastructure().auth.updatePassword({ password, oldPassword });
    });
  }

  async signOutEverywhere(): Promise<void> {
    await this.withBusy(async () => {
      await this.requireInfrastructure().auth.deleteSessions();
      this.user = null;
      this.session = 'signed-out';
      this.workspace = null;
      this.workspaces = [];
      this.members = [];
      this.clearWorkspaceData();
    });
  }

  async selectWorkspace(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.find((item) => item.id === workspaceId);
    if (workspace === undefined) return;
    this.workspace = workspace;
    storeWorkspaceId(workspace.id);
    await this.refresh();
  }

  async createWorkspace(name: string): Promise<void> {
    await this.withBusy(async () => {
      const infra = this.requireInfrastructure();
      const user = this.requireUser();
      const now = infra.clock.now().toISOString();
      const workspace: Workspace = {
        id: asWorkspaceId(infra.ids.next()),
        name: name.trim() || 'My workspace',
        ownerId: user.id,
        defaultView: 'day',
        weekStartsOn: 'monday',
        categoryOverrideMode: 'any',
        createdAt: now,
        updatedAt: now
      };
      await infra.team.ensureTeam(workspace);
      const saved = await infra.workspaces.save(workspace);
      this.workspaces = await infra.workspaces.listAccessible();
      this.workspace = saved;
      storeWorkspaceId(saved.id);
      await this.refresh();
      await this.recordEvent({
        action: 'created',
        entityType: 'workspace',
        entityId: saved.id,
        entityName: saved.name
      });
    });
  }

  get workspaceRole(): WorkspaceRole {
    if (this.workspace === null || this.user === null) return 'viewer';
    if (this.workspace.ownerId === this.user.id) return 'owner';
    return (
      this.members.find((member) => member.userId === this.user?.id)?.role ?? 'member'
    );
  }

  get canManageMembers(): boolean {
    return this.workspaceRole === 'owner' || this.workspaceRole === 'admin';
  }

  get canWrite(): boolean {
    return this.workspaceRole !== 'viewer';
  }

  async updateWorkspaceSettings(input: {
    name?: string;
    defaultView?: WorkspaceDefaultView;
    weekStartsOn?: WorkspaceWeekStart;
    categoryOverrideMode?: Workspace['categoryOverrideMode'];
  }): Promise<void> {
    const current = this.workspace;
    if (current === null) return;
    await this.withBusy(async () => {
      const infra = this.requireInfrastructure();
      const workspace: Workspace = {
        id: current.id,
        name: input.name?.trim() || current.name,
        ownerId: current.ownerId,
        defaultView: input.defaultView ?? current.defaultView ?? 'day',
        weekStartsOn: input.weekStartsOn ?? current.weekStartsOn ?? 'monday',
        categoryOverrideMode:
          input.categoryOverrideMode ?? current.categoryOverrideMode ?? 'any',
        createdAt: current.createdAt,
        updatedAt: infra.clock.now().toISOString()
      };
      const created = await infra.team.ensureTeam(workspace);
      const saved = await infra.workspaces.save(workspace);
      if (created) {
        await infra.workspaces.migratePermissions(saved);
      } else {
        await infra.team.renameTeam(saved);
      }
      this.workspace = saved;
      this.workspaces = this.workspaces.map((item) =>
        item.id === saved.id ? saved : item
      );
      await this.recordEvent({
        action: 'updated',
        entityType: 'workspace',
        entityId: saved.id,
        entityName: saved.name
      });
    });
  }

  async loadMembers(): Promise<void> {
    if (this.workspace === null) return;
    this.membersLoading = true;
    try {
      const infra = this.requireInfrastructure();
      const created = await infra.team.ensureTeam(this.workspace);
      if (created && this.workspace.ownerId === this.user?.id) {
        await infra.workspaces.migratePermissions(this.workspace);
      }
      this.members = await infra.team.listMembers(this.workspace);
    } catch (error) {
      this.error = messageFor(error);
    } finally {
      this.membersLoading = false;
    }
  }

  async inviteMember(
    email: string,
    role: Exclude<WorkspaceRole, 'owner'>
  ): Promise<void> {
    if (this.workspace === null) return;
    await this.withBusy(async () => {
      const infra = this.requireInfrastructure();
      await infra.team.ensureTeam(this.workspace!);
      await infra.team.invite(
        this.workspace!,
        email,
        role,
        `${window.location.origin}/accept-invite`
      );
      this.members = await infra.team.listMembers(this.workspace!);
      await this.recordEvent({
        action: 'member_invited',
        entityType: 'member',
        entityId: email,
        entityName: email,
        detail: role
      });
    });
  }

  async updateMemberRole(
    membershipId: string,
    role: Exclude<WorkspaceRole, 'owner'>
  ): Promise<void> {
    if (this.workspace === null) return;
    await this.withBusy(async () => {
      const infra = this.requireInfrastructure();
      const member = this.members.find((item) => item.membershipId === membershipId);
      await infra.team.updateRole(this.workspace!, membershipId, role);
      this.members = await infra.team.listMembers(this.workspace!);
      if (member !== undefined) {
        await this.recordEvent({
          action: 'role_changed',
          entityType: 'member',
          entityId: member.userId,
          entityName: member.name || member.email,
          detail: role
        });
      }
    });
  }

  async removeMember(membershipId: string): Promise<void> {
    if (this.workspace === null) return;
    const member = this.members.find((item) => item.membershipId === membershipId);
    await this.withBusy(async () => {
      const infra = this.requireInfrastructure();
      await infra.team.removeMember(this.workspace!, membershipId);
      this.members = await infra.team.listMembers(this.workspace!);
      if (member !== undefined) {
        await this.recordEvent({
          action: 'member_removed',
          entityType: 'member',
          entityId: member.userId,
          entityName: member.name || member.email
        });
      }
    });
  }

  async deleteWorkspace(): Promise<void> {
    if (this.workspace === null) return;
    await this.withBusy(async () => {
      const infra = this.requireInfrastructure();
      const workspace = this.workspace!;
      await infra.team.ensureTeam(workspace);
      await infra.workspaces.deleteWorkspace(workspace);
      await infra.team.deleteTeam(workspace);
      this.workspace = null;
      this.members = [];
      this.clearWorkspaceData();
      await this.loadWorkspaces();
    });
  }

  async transferOwnership(targetUserId: string): Promise<void> {
    if (this.workspace === null || this.user === null) return;
    await this.withBusy(async () => {
      const infra = this.requireInfrastructure();
      const currentMember = this.members.find(
        (member) => member.userId === this.user?.id
      );
      const targetMember = this.members.find((member) => member.userId === targetUserId);
      if (currentMember === undefined || targetMember === undefined) {
        throw new Error('Load the member list before transferring ownership.');
      }
      await infra.team.transferOwnership(
        this.workspace!,
        currentMember.membershipId,
        targetMember.membershipId
      );
      const saved = await infra.workspaces.transferOwnership(
        this.workspace!,
        targetMember.userId as typeof this.workspace.ownerId
      );
      this.workspace = saved;
      this.workspaces = this.workspaces.map((item) =>
        item.id === saved.id ? saved : item
      );
      this.members = await infra.team.listMembers(saved);
      await this.recordEvent({
        action: 'role_changed',
        entityType: 'member',
        entityId: targetMember.userId,
        entityName: targetMember.name || targetMember.email,
        detail: 'owner'
      });
    });
  }

  async acceptInvitation(input: {
    workspaceId: string;
    membershipId: string;
    userId: string;
    secret: string;
  }): Promise<void> {
    await this.withBusy(async () => {
      await this.requireInfrastructure().team.acceptInvitation(input);
      await this.loadWorkspaces();
    });
  }

  async refresh(): Promise<void> {
    if (this.workspace === null) return;
    const token = ++this.loadToken;
    await this.withBusy(() => this.reload(token));
  }

  async setWeek(weekStart: WeekStart): Promise<void> {
    this.weekStart = weekStart;
    await this.withBusy(() => this.loadWeek(++this.loadToken));
  }

  async addTaskToCurrentWeek(taskId: string, plannedDate: IsoDate | null = null): Promise<void> {
    const workspaceId = this.workspace?.id;
    if (workspaceId === undefined) return;
    const id = asTaskId(taskId);
    const weekStart = this.weekStart;
    const tempId = asWeeklyPoolEntryId(`optimistic-${++this.optimisticSeq}`);
    const temp: WeeklyPoolEntry = {
      id: tempId,
      workspaceId,
      taskId: id,
      weekStart,
      plannedDate,
      status: 'todo',
      completedDate: null,
      createdAt: new Date().toISOString()
    };
    this.weekEntries = [...this.weekEntries, temp];
    this.recomputeDerived();

    await this.queueWrite(`task-week:${taskId}`, () =>
      this.withBusy(
        async () => {
          const infra = this.requireInfrastructure();
          const saved = await addTaskToWeek(
            {
              weeklyPool: infra.weeklyPool,
              tasks: infra.tasks,
              activityLogs: infra.activityLogs,
              clock: infra.clock,
              ids: infra.ids
            },
            { workspaceId, taskId: id, weekStart, plannedDate }
          );
          this.weekEntries = this.weekEntries.map((entry) =>
            entry.id === tempId ? saved : entry
          );
          this.recomputeDerived();
          const task = this.tasks.find((item) => item.id === id);
          if (task !== undefined) {
            await this.recordTaskEvent(
              task,
              plannedDate === null ? 'unscheduled' : 'scheduled',
              plannedDate ?? weekStart
            );
          }
        },
        () => {
          this.weekEntries = this.weekEntries.filter((entry) => entry.id !== tempId);
          this.recomputeDerived();
          this.scheduleRefresh();
        }
      )
    );
  }

  async scheduleEntry(entryId: string, plannedDate: IsoDate | null): Promise<void> {
    const id = asWeeklyPoolEntryId(entryId);
    const entry = this.weekEntries.find((item) => item.id === id);
    if (entry === undefined) return;
    const previous = entry;
    const optimistic: WeeklyPoolEntry = { ...entry, plannedDate };
    this.replaceEntry(optimistic);
    this.recomputeDerived();

    await this.queueWrite(`entry:${entryId}`, () =>
      this.withBusy(
        async () => {
          const infra = this.requireInfrastructure();
          const workspaceId = this.workspace?.id;
          if (workspaceId === undefined) return;
          const saved = await scheduleWeeklyPoolEntry(
            {
              weeklyPool: infra.weeklyPool,
              tasks: infra.tasks,
              activityLogs: infra.activityLogs,
              clock: infra.clock,
              ids: infra.ids
            },
            { workspaceId, entryId: id, plannedDate }
          );
          this.replaceEntry(saved);
          this.recomputeDerived();
          const task = this.tasks.find((item) => item.id === entry.taskId);
          if (task !== undefined) {
            await this.recordTaskEvent(
              task,
              plannedDate === null ? 'unscheduled' : 'scheduled',
              plannedDate ?? this.weekStart
            );
          }
        },
        () => {
          this.replaceEntry(previous);
          this.recomputeDerived();
          this.scheduleRefresh();
        }
      )
    );
  }

  async removeEntry(entryId: string): Promise<void> {
    const id = asWeeklyPoolEntryId(entryId);
    const previous = this.weekEntries;
    const removed = previous.find((entry) => entry.id === id);
    if (removed === undefined) return;
    this.weekEntries = previous.filter((entry) => entry.id !== id);
    this.recomputeDerived();

    await this.queueWrite(`entry:${entryId}`, () =>
      this.withBusy(
        async () => {
          const infra = this.requireInfrastructure();
          const workspaceId = this.workspace?.id;
          if (workspaceId === undefined) return;
          const result = await removeWeeklyPoolEntry(
            {
              weeklyPool: infra.weeklyPool,
              tasks: infra.tasks,
              activityLogs: infra.activityLogs,
              clock: infra.clock,
              ids: infra.ids
            },
            { workspaceId, entryId: id }
          );
          this.activityLogs = this.activityLogs.filter((log) => log.entryId !== id);
          if (result.task !== null) {
            this.tasks = this.upsert(this.tasks, result.task);
            await this.recordTaskEvent(result.task, 'unscheduled');
          }
          this.recomputeDerived();
        },
        () => {
          this.weekEntries = previous;
          this.recomputeDerived();
          this.scheduleRefresh();
        }
      )
    );
  }

  async completeTask(taskId: string): Promise<void> {
    const workspaceId = this.workspace?.id;
    if (workspaceId === undefined) return;
    const id = asTaskId(taskId);
    const weekStart = this.weekStart;
    const today = this.today;
    const entry = this.weekEntries.find(
      (item) =>
        item.taskId === id && item.weekStart === weekStart && item.completedDate === null
    );
    if (entry === undefined) return;
    const logsBefore = this.activityLogs;
    const weekEntriesBefore = this.weekEntries;
    const now = new Date().toISOString();
    const tempId = asActivityLogId(`optimistic-${++this.optimisticSeq}`);
    const task = this.tasks.find((item) => item.id === id);
    const topic = task === undefined ? undefined : this.topicForTask(task);
    const category = this.categoryForTopic(topic);
    this.activityLogs = [
      ...logsBefore,
      {
        id: tempId,
        workspaceId,
        taskId: id,
        entryId: entry.id,
        completedDate: today,
        note: null,
        taskName: task?.title ?? null,
        topicName: topic?.name ?? null,
        categoryName: category?.name ?? null,
        createdAt: now
      }
    ];
    this.replaceEntry({ ...entry, status: 'done', completedDate: today });
    this.recomputeDerived();

    await this.queueWrite(`entry:${entry.id}`, () =>
      this.withBusy(
        async () => {
          const infra = this.requireInfrastructure();
          const log = await completeTask(
            {
              tasks: infra.tasks,
              weeklyPool: infra.weeklyPool,
              activityLogs: infra.activityLogs,
              topics: infra.topics,
              categories: infra.categories,
              clock: infra.clock,
              ids: infra.ids
            },
            { workspaceId, taskId: id, weekStart, completedDate: today, entryId: entry.id }
          );
          this.activityLogs = this.activityLogs.map((item) =>
            item.id === tempId ? log : item
          );
          this.recomputeDerived();
          await this.recordCompletionEvent(log, 'completed');
        },
        () => {
          this.activityLogs = logsBefore;
          this.weekEntries = weekEntriesBefore;
          this.recomputeDerived();
          this.scheduleRefresh();
        }
      )
    );
  }

  entryCompletionCount(entryId: string): number {
    return this.activityLogs.filter((log) => log.entryId === entryId).length;
  }

  async addEntryRepeat(entryId: string): Promise<void> {
    const id = asWeeklyPoolEntryId(entryId);
    const entry = this.weekEntries.find((item) => item.id === id);
    if (entry === undefined || entry.status !== 'done') return;

    await this.persist(async (infra, workspaceId) => {
      const log = await repeatTaskCompletion(
        {
          tasks: infra.tasks,
          weeklyPool: infra.weeklyPool,
          activityLogs: infra.activityLogs,
          topics: infra.topics,
          categories: infra.categories,
          clock: infra.clock,
          ids: infra.ids
        },
        { workspaceId, entryId: id }
      );
      this.activityLogs = [...this.activityLogs, log];
      this.recomputeDerived();
      await this.recordCompletionEvent(log, 'completed');
    });
  }

  async removeEntryRepeat(entryId: string): Promise<void> {
    const id = asWeeklyPoolEntryId(entryId);
    if (this.entryCompletionCount(entryId) <= 1) return;

    await this.persist(async (infra, workspaceId) => {
      const removed = await removeRepeatedCompletion(
        { weeklyPool: infra.weeklyPool, activityLogs: infra.activityLogs },
        { workspaceId, entryId: id }
      );
      this.activityLogs = this.activityLogs.filter((log) => log.id !== removed.id);
      this.recomputeDerived();
    });
  }

  async setTaskStatus(
    taskId: string,
    status: TaskStatus,
    doneDate: string | null = null
  ): Promise<void> {
    const id = asTaskId(taskId);
    await this.persist(async (infra, workspaceId) => {
      const saved = await setTaskStatusUseCase(
        { tasks: infra.tasks, clock: infra.clock },
        { workspaceId, taskId: id, status, doneDate }
      );
      this.tasks = this.upsert(this.tasks, saved);
      this.recomputeDerived();
    });
  }

  async setEntryStatus(entryId: string, status: TaskStatus): Promise<void> {
    const workspaceId = this.workspace?.id;
    if (workspaceId === undefined) return;
    const id = asWeeklyPoolEntryId(entryId);
    const entry = this.weekEntries.find((item) => item.id === id);
    if (entry === undefined) return;
    if (entry.status === status && (status !== 'done' || entry.completedDate !== null)) return;
    const weekEntriesBefore = this.weekEntries;
    const logsBefore = this.activityLogs;
    const today = this.today;
    const task = this.tasks.find((item) => item.id === entry.taskId);
    const topic = task === undefined ? undefined : this.topicForTask(task);
    const category = this.categoryForTopic(topic);
    const tempId = asActivityLogId(`optimistic-${++this.optimisticSeq}`);
    const removedLog = logsBefore.find((log) => log.entryId === entry.id);
    this.replaceEntry({
      ...entry,
      status,
      completedDate: status === 'done' ? (entry.completedDate ?? today) : null
    });
    if (status === 'done') {
      this.activityLogs = [
        ...logsBefore.filter((log) => log.entryId !== entry.id),
        {
          id: tempId,
          workspaceId,
          taskId: entry.taskId,
          entryId: entry.id,
          completedDate: today,
          note: null,
          taskName: task?.title ?? null,
          topicName: topic?.name ?? null,
          categoryName: category?.name ?? null,
          createdAt: new Date().toISOString()
        }
      ];
    } else {
      this.activityLogs = logsBefore.filter((log) => log.entryId !== entry.id);
    }
    this.recomputeDerived();

    await this.queueWrite(`entry:${entryId}`, () =>
      this.withBusy(
        async () => {
          const infra = this.requireInfrastructure();
          const result = await setWeeklyEntryStatus(
            {
              tasks: infra.tasks,
              weeklyPool: infra.weeklyPool,
              activityLogs: infra.activityLogs,
              topics: infra.topics,
              categories: infra.categories,
              clock: infra.clock,
              ids: infra.ids
            },
            { workspaceId, entryId: id, status, completedDate: today }
          );
          this.replaceEntry(result.entry);
          if (result.log !== null) {
            this.activityLogs = this.activityLogs
              .filter((log) => log.entryId !== entry.id)
              .concat(result.log);
            await this.recordCompletionEvent(result.log, 'completed');
          } else if (removedLog !== undefined) {
            await this.recordCompletionEvent(removedLog, 'uncompleted');
          }
          this.recomputeDerived();
          if (task !== undefined) {
            await this.recordTaskEvent(task, 'status_changed', status);
          }
        },
        () => {
          this.weekEntries = weekEntriesBefore;
          this.activityLogs = logsBefore;
          this.recomputeDerived();
          this.scheduleRefresh();
        }
      )
    );
  }

  async addCategory(
    parentId: Category['parentId'],
    name: string,
    importanceWeight: WeightGrade,
    icon: string | null = null,
    color: CategoryColor | null = null
  ): Promise<void> {
    await this.persist(async (infra, workspaceId) => {
      const category = await createCategory(
        {
          categories: infra.categories,
          topics: infra.topics,
          tasks: infra.tasks,
          clock: infra.clock,
          ids: infra.ids
        },
        { workspaceId, parentId, name, icon, color, importanceWeight }
      );
      this.categories = this.upsert(this.categories, category);
      this.recomputeDerived();
      await this.recordEvent({
        action: 'created',
        entityType: 'category',
        entityId: category.id,
        entityName: category.name,
        contextName:
          this.categories.find((item) => item.id === category.parentId)?.name ?? null
      });
    });
  }

  async setCategoryStatusOverride(
    categoryId: string,
    statusOverride: CategoryStatus | null
  ): Promise<void> {
    await this.persist(async (infra, workspaceId) => {
      const category = await updateCategory(
        {
          categories: infra.categories,
          topics: infra.topics,
          tasks: infra.tasks,
          clock: infra.clock,
          ids: infra.ids
        },
        {
          workspaceId,
          categoryId: asCategoryId(categoryId),
          statusOverride
        }
      );
      this.categories = this.upsert(this.categories, category);
      this.recomputeDerived();
      await this.recordEvent({
        action: 'updated',
        entityType: 'category',
        entityId: category.id,
        entityName: category.name,
        detail: statusOverride === null ? 'Automatic status' : `Status set to ${statusOverride}`
      });
    });
  }

  async addCategoryToCurrentWeek(categoryId: string): Promise<void> {
    const id = asCategoryId(categoryId);
    const category = this.categories.find((item) => item.id === id);
    if (category === undefined) return;
    const categoryIds = categoryDescendantIds(this.categories, id);
    const topicIds = new Set(
      this.topics
        .filter((topic) => categoryIds.has(topic.categoryId))
        .map((topic) => topic.id)
    );
    const categoryTasks = this.tasks.filter((task) => topicIds.has(task.topicId));

    await this.persist(async (infra, workspaceId) => {
      const existing = new Set(
        this.weekEntries
          .filter((entry) => entry.weekStart === this.weekStart)
          .map((entry) => entry.taskId)
      );
      const created: WeeklyPoolEntry[] = [];
      for (const task of categoryTasks) {
        if (existing.has(task.id)) continue;
        created.push(
          await addTaskToWeek(
            {
              weeklyPool: infra.weeklyPool,
              tasks: infra.tasks,
              activityLogs: infra.activityLogs,
              clock: infra.clock,
              ids: infra.ids
            },
            {
              workspaceId,
              taskId: task.id,
              weekStart: this.weekStart,
              plannedDate: null
            }
          )
        );
      }
      this.weekEntries = [...this.weekEntries, ...created];
      this.recomputeDerived();
      if (created.length > 0) {
        await this.recordEvent({
          action: 'scheduled',
          entityType: 'category',
          entityId: category.id,
          entityName: category.name,
          detail: `${created.length} ${created.length === 1 ? 'task' : 'tasks'} added to the week`
        });
      }
    });
  }

  async importCategoryTree(input: ImportCategory): Promise<void> {
    const infrastructure = this.requireInfrastructure();
    const workspaceId = this.workspace?.id;
    if (workspaceId !== undefined && infrastructure.importFunctionId !== null) {
      await this.withBusy(async () => {
        const execution = await infrastructure.functions.createExecution({
          functionId: infrastructure.importFunctionId!,
          body: JSON.stringify({ workspaceId, tree: input }),
          headers: { 'content-type': 'application/json' }
        });
        let result: ImportFunctionResult;
        try {
          result = JSON.parse(execution.responseBody) as ImportFunctionResult;
        } catch {
          throw new Error('Import function returned an invalid response.');
        }
        if (execution.responseStatusCode >= 400 || result.ok !== true) {
          throw new Error(result.error ?? 'Import failed.');
        }
        await this.reload(++this.loadToken);
      });
      return;
    }

    const createdCategories: Category[] = [];
    const createdTopics: Topic[] = [];
    const createdTasks: Task[] = [];

    await this.persist(async (infra, workspaceId) => {
      const dependencies = {
        categories: infra.categories,
        topics: infra.topics,
        tasks: infra.tasks,
        clock: infra.clock,
        ids: infra.ids
      };

      async function createNode(
        node: ImportCategory,
        parentId: Category['parentId']
      ): Promise<void> {
        const category = await createCategory(dependencies, {
          workspaceId,
          parentId,
          name: node.name,
          icon: node.icon,
          color: node.color,
          importanceWeight: node.weight
        });
        createdCategories.push(category);
        for (const item of node.topics) {
          const topic = await createTopic(dependencies, {
            workspaceId,
            categoryId: category.id,
            name: item.name
          });
          createdTopics.push(topic);
          for (const task of item.tasks) {
            createdTasks.push(
              await createTask(dependencies, {
                workspaceId,
                topicId: topic.id,
                title: task.title,
                icon: task.icon,
                taskWeight: task.weight
              })
            );
          }
        }
        for (const child of node.subcategories) await createNode(child, category.id);
      }

      await createNode(input, null);
    });

    if (this.error === null) {
      this.categories = [...this.categories, ...createdCategories];
      this.topics = [...this.topics, ...createdTopics];
      this.tasks = [...this.tasks, ...createdTasks];
      this.recomputeDerived();
      await this.recordEvent({
        action: 'imported',
        entityType: 'import',
        entityId: input.name,
        entityName: input.name,
        detail: `${createdCategories.length} categories · ${createdTopics.length} topics · ${createdTasks.length} tasks`
      });
    }
  }

  async addTopic(categoryId: Category['id'], name: string): Promise<void> {
    await this.persist(async (infra, workspaceId) => {
      const topic = await createTopic(
        {
          categories: infra.categories,
          topics: infra.topics,
          tasks: infra.tasks,
          clock: infra.clock,
          ids: infra.ids
        },
        { workspaceId, categoryId, name }
      );
      this.topics = this.upsert(this.topics, topic);
      this.recomputeDerived();
      await this.recordEvent({
        action: 'created',
        entityType: 'topic',
        entityId: topic.id,
        entityName: topic.name,
        contextName:
          this.categories.find((category) => category.id === topic.categoryId)?.name ?? null
      });
    });
  }

  async addTask(
    topicId: Topic['id'],
    title: string,
    taskWeight: WeightGrade,
    icon: string | null = null,
    status: TaskStatus = 'todo',
    doneDate: string | null = null
  ): Promise<void> {
    await this.persist(async (infra, workspaceId) => {
      let task = await createTask(
        {
          categories: infra.categories,
          topics: infra.topics,
          tasks: infra.tasks,
          clock: infra.clock,
          ids: infra.ids
        },
        { workspaceId, topicId, title, icon, taskWeight }
      );
      if (status !== 'todo' || doneDate !== null) {
        task = await setTaskStatusUseCase(
          { tasks: infra.tasks, clock: infra.clock },
          { workspaceId, taskId: task.id, status, doneDate }
        );
      }
      this.tasks = this.upsert(this.tasks, task);
      this.recomputeDerived();
      await this.recordTaskEvent(task, 'created');
    });
  }

  async removeCategory(categoryId: string): Promise<void> {
    const categoryName =
      this.categories.find((category) => category.id === categoryId)?.name ?? 'Category';
    const categoryIds = categoryDescendantIds(this.categories, asCategoryId(categoryId));
    const topicIds = new Set(
      this.topics
        .filter((topic) => categoryIds.has(topic.categoryId))
        .map((topic) => topic.id)
    );
    const taskIds = this.tasks
      .filter((task) => topicIds.has(task.topicId))
      .map((task) => task.id);

    await this.persist(async (infra, workspaceId) => {
      for (const taskId of taskIds) await infra.tasks.delete(workspaceId, taskId);
      for (const topicId of topicIds) await infra.topics.delete(workspaceId, topicId);
      for (const id of categoryIds) await infra.categories.delete(workspaceId, id);
      this.categories = this.categories.filter((category) => !categoryIds.has(category.id));
      this.topics = this.topics.filter((topic) => !topicIds.has(topic.id));
      this.tasks = this.tasks.filter((task) => !taskIds.includes(task.id));
      this.recomputeDerived();
      await this.recordEvent({
        action: 'deleted',
        entityType: 'category',
        entityId: categoryId,
        entityName: categoryName
      });
    });
  }

  async removeTopic(topicId: string): Promise<void> {
    if (this.tasks.some((task) => task.topicId === topicId)) {
      throw new Error('Remove tasks in this topic first.');
    }
    const topic = this.topics.find((item) => item.id === topicId);
    await this.persist(async (infra, workspaceId) => {
      await infra.topics.delete(workspaceId, asTopicId(topicId));
      this.topics = this.topics.filter((item) => item.id !== topicId);
      this.recomputeDerived();
      if (topic !== undefined) {
        await this.recordEvent({
          action: 'deleted',
          entityType: 'topic',
          entityId: topic.id,
          entityName: topic.name,
          contextName:
            this.categories.find((category) => category.id === topic.categoryId)?.name ?? null
        });
      }
    });
  }

  async removeTask(taskId: string): Promise<void> {
    const task = this.tasks.find((item) => item.id === taskId);
    await this.persist(async (infra, workspaceId) => {
      await infra.tasks.delete(workspaceId, asTaskId(taskId));
      this.tasks = this.tasks.filter((item) => item.id !== taskId);
      this.recomputeDerived();
      if (task !== undefined) await this.recordTaskEvent(task, 'deleted');
    });
  }

  async updateCategory(
    categoryId: string,
    name: string,
    importanceWeight: WeightGrade,
    icon: string | null = null,
    color?: CategoryColor | null
  ): Promise<void> {
    await this.persist(async (infra, workspaceId) => {
      const category = await updateCategory(
        {
          categories: infra.categories,
          topics: infra.topics,
          tasks: infra.tasks,
          clock: infra.clock,
          ids: infra.ids
        },
        { workspaceId, categoryId: asCategoryId(categoryId), name, icon, color, importanceWeight }
      );
      this.categories = this.upsert(this.categories, category);
      this.recomputeDerived();
      await this.recordEvent({
        action: 'updated',
        entityType: 'category',
        entityId: category.id,
        entityName: category.name
      });
    });
  }

  async updateTopic(topicId: string, name: string): Promise<void> {
    await this.persist(async (infra, workspaceId) => {
      const topic = await updateTopic(
        {
          categories: infra.categories,
          topics: infra.topics,
          tasks: infra.tasks,
          clock: infra.clock,
          ids: infra.ids
        },
        { workspaceId, topicId: asTopicId(topicId), name }
      );
      this.topics = this.upsert(this.topics, topic);
      this.recomputeDerived();
      await this.recordEvent({
        action: 'updated',
        entityType: 'topic',
        entityId: topic.id,
        entityName: topic.name
      });
    });
  }

  async updateTask(
    taskId: string,
    title: string,
    taskWeight: WeightGrade,
    icon: string | null = null,
    status: TaskStatus = 'todo',
    doneDate: string | null = null
  ): Promise<void> {
    await this.persist(async (infra, workspaceId) => {
      const id = asTaskId(taskId);
      let task = await updateTask(
        {
          categories: infra.categories,
          topics: infra.topics,
          tasks: infra.tasks,
          clock: infra.clock,
          ids: infra.ids
        },
        { workspaceId, taskId: id, title, icon, taskWeight }
      );
      task = await setTaskStatusUseCase(
        { tasks: infra.tasks, clock: infra.clock },
        { workspaceId, taskId: id, status, doneDate }
      );
      this.tasks = this.upsert(this.tasks, task);
      this.recomputeDerived();
      await this.recordTaskEvent(task, 'updated');
    });
  }

  async addMilestone(input: {
    title: string;
    scope: Milestone['scope'];
    targetPercentage: number;
    dueDate: IsoDate;
  }): Promise<void> {
    await this.persist(async (infra, workspaceId) => {
      const milestone = await createMilestone(
        {
          milestones: infra.milestones,
          categories: infra.categories,
          topics: infra.topics,
          clock: infra.clock,
          ids: infra.ids
        },
        { workspaceId, ...input }
      );
      this.milestones = this.upsert(this.milestones, milestone);
      this.recomputeDerived();
      await this.recordEvent({
        action: 'created',
        entityType: 'milestone',
        entityId: milestone.id,
        entityName: milestone.title
      });
    });
  }

  async updateMilestone(input: {
    milestoneId: string;
    title: string;
    targetPercentage: number;
    dueDate: IsoDate;
  }): Promise<void> {
    await this.persist(async (infra, workspaceId) => {
      const milestone = await updateMilestone(
        {
          milestones: infra.milestones,
          categories: infra.categories,
          topics: infra.topics,
          clock: infra.clock,
          ids: infra.ids
        },
        {
          workspaceId,
          milestoneId: asMilestoneId(input.milestoneId),
          title: input.title,
          targetPercentage: input.targetPercentage,
          dueDate: input.dueDate
        }
      );
      this.milestones = this.upsert(this.milestones, milestone);
      this.recomputeDerived();
      await this.recordEvent({
        action: 'updated',
        entityType: 'milestone',
        entityId: milestone.id,
        entityName: milestone.title
      });
    });
  }

  async removeMilestone(milestoneId: string): Promise<void> {
    const milestone = this.milestones.find((item) => item.id === milestoneId);
    await this.persist(async (infra, workspaceId) => {
      await deleteMilestone(
        {
          milestones: infra.milestones,
          categories: infra.categories,
          topics: infra.topics,
          clock: infra.clock,
          ids: infra.ids
        },
        { workspaceId, milestoneId: asMilestoneId(milestoneId) }
      );
      this.milestones = this.milestones.filter((item) => item.id !== milestoneId);
      this.recomputeDerived();
      if (milestone !== undefined) {
        await this.recordEvent({
          action: 'deleted',
          entityType: 'milestone',
          entityId: milestone.id,
          entityName: milestone.title
        });
      }
    });
  }

  categoryForTopic(topic: Topic | undefined): Category | undefined {
    return this.categories.find((category) => category.id === topic?.categoryId);
  }

  topicForTask(task: Task): Topic | undefined {
    return this.topics.find((topic) => topic.id === task.topicId);
  }

  tasksForTopic(topicId: string): readonly Task[] {
    return this.tasks.filter((task) => task.topicId === topicId);
  }

  entriesWithTask(): readonly { entry: WeeklyPoolEntry; task: Task }[] {
    const taskById = new Map(this.tasks.map((task) => [task.id, task]));
    return this.weekEntries.flatMap((entry) => {
      const task = taskById.get(entry.taskId);
      return task === undefined ? [] : [{ entry, task }];
    });
  }

  completionCount(taskId: string): number {
    return this.activityLogs.filter((log) => log.taskId === taskId).length;
  }

  lastCompletionDate(taskId: string): IsoDate | null {
    return (
      this.activityLogs
        .filter((log) => log.taskId === taskId)
        .map((log) => log.completedDate)
        .sort()
        .at(-1) ?? null
    );
  }

  clearError(): void {
    this.error = null;
  }

  clearErrorOnInput(): void {
    if (this.error !== null) this.error = null;
  }

  private async recordEvent(input: {
    action: ActivityAction;
    entityType: ActivityEntityType;
    entityId: string;
    entityName: string;
    contextName?: string | null;
    detail?: string | null;
  }): Promise<void> {
    const workspaceId = this.workspace?.id;
    const user = this.user;
    if (workspaceId === undefined || user === null || !this.eventsAvailable) return;

    try {
      const infra = this.requireInfrastructure();
      const event = await infra.activityEvents.save({
        id: asActivityEventId(infra.ids.next()),
        workspaceId,
        actorId: user.id,
        actorName: user.name ?? user.email,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        entityName: input.entityName,
        contextName: input.contextName ?? null,
        detail: input.detail ?? null,
        createdAt: infra.clock.now().toISOString()
      });
      this.activityEvents = [event, ...this.activityEvents];
    } catch (error) {
      if (isNotFoundError(error)) this.eventsAvailable = false;
    }
  }

  private async recordTaskEvent(
    task: Task,
    action: ActivityAction,
    detail: string | null = null
  ): Promise<void> {
    const topic = this.topicForTask(task);
    const category = this.categoryForTopic(topic);
    await this.recordEvent({
      action,
      entityType: 'task',
      entityId: task.id,
      entityName: task.title,
      contextName:
        topic === undefined
          ? null
          : category === undefined
            ? topic.name
            : `${category.name} · ${topic.name}`,
      detail
    });
  }

  private async recordCompletionEvent(
    log: ActivityLog,
    action: 'completed' | 'uncompleted'
  ): Promise<void> {
    const task = this.tasks.find((item) => item.id === log.taskId);
    const topic = task === undefined ? undefined : this.topicForTask(task);
    const category = this.categoryForTopic(topic);
    await this.recordEvent({
      action,
      entityType: 'completion',
      entityId: log.id,
      entityName: task?.title ?? 'Deleted task',
      contextName:
        topic === undefined
          ? null
          : category === undefined
            ? topic.name
            : `${category.name} · ${topic.name}`,
      detail: log.completedDate
    });
  }

  private async loadMembersForRole(): Promise<readonly WorkspaceMember[]> {
    const workspace = this.workspace;
    if (workspace === null) return [];
    try {
      return await this.requireInfrastructure().team.listMembers(workspace);
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      return [];
    }
  }

  private async loadActivityEvents(
    workspaceId: Workspace['id']
  ): Promise<readonly ActivityEvent[]> {
    try {
      const events = await this.requireInfrastructure().activityEvents.listByWorkspace(workspaceId);
      this.eventsAvailable = true;
      return events;
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      this.eventsAvailable = false;
      return [];
    }
  }

  private async initialize(): Promise<void> {
    try {
      this.infrastructure = createAppwriteInfrastructureFromEnv({
        PUBLIC_APPWRITE_ENDPOINT,
        PUBLIC_APPWRITE_PROJECT_ID,
        PUBLIC_APPWRITE_DATABASE_ID
      });
      const user = await this.infrastructure.auth.getCurrentUser();
      if (user === null) {
        this.session = 'signed-out';
      } else {
        this.user = user;
        this.session = 'signed-in';
        await this.loadWorkspaces();
      }
    } catch (error) {
      this.error = messageFor(error);
      this.session = 'signed-out';
    } finally {
      this.initialized = true;
    }
  }

  private async loadWorkspaces(): Promise<void> {
    const infra = this.requireInfrastructure();
    const user = this.requireUser();
    this.workspaces = await infra.workspaces.listAccessible();
    if (this.workspaces.length === 0) {
      await this.createWorkspace('My workspace');
      return;
    }
    const stored = storedWorkspaceId();
    const selected =
      this.workspaces.find((workspace) => workspace.id === stored) ?? this.workspaces[0];
    if (selected !== undefined) {
      this.workspace = selected;
      storeWorkspaceId(selected.id);
      await this.refresh();
    }
  }

  private async reload(token: number): Promise<void> {
    const infra = this.requireInfrastructure();
    const workspaceId = this.workspace?.id;
    if (workspaceId === undefined) return;
    this.today = toIsoDate(infra.clock.now());
    const [categories, topics, tasks, milestones, activityLogs, activityEvents, members] =
      await Promise.all([
        infra.categories.listByWorkspace(workspaceId),
        infra.topics.listByWorkspace(workspaceId),
        infra.tasks.listByWorkspace(workspaceId),
        infra.milestones.listByWorkspace(workspaceId),
        infra.activityLogs.listByWorkspace(workspaceId),
        this.loadActivityEvents(workspaceId),
        this.loadMembersForRole()
      ]);
    if (token !== this.loadToken) return;

    this.categories = categories;
    this.topics = topics;
    this.tasks = tasks;
    this.milestones = milestones;
    this.activityLogs = activityLogs;
    this.activityEvents = activityEvents;
    this.members = members;
    this.startRealtime();
    await this.loadWeek(token);
  }

  private async loadWeek(token: number): Promise<void> {
    const infra = this.requireInfrastructure();
    const workspaceId = this.workspace?.id;
    if (workspaceId === undefined) return;

    const entries = await infra.weeklyPool.listByWeek(workspaceId, this.weekStart);
    if (token !== this.loadToken) return;
    const end = endOfWeek(this.weekStart);
    const legacyLogs = this.activityLogs.filter(
      (log) =>
        log.entryId === null &&
        isWithinDateRange(log.completedDate, this.weekStart, end)
    );
    this.weekEntries = entries.map((entry) => {
      const legacy = legacyLogs.find((log) => log.taskId === entry.taskId);
      if (entry.status !== 'todo' || entry.completedDate !== null || legacy === undefined) {
        return entry;
      }
      return { ...entry, status: 'done', completedDate: legacy.completedDate };
    });
    this.recomputeDerived();
  }

  private recomputeDerived(): void {
    this.recommendation = recommendStudyTasks({
      weekStart: this.weekStart,
      today: this.today,
      poolEntries: this.weekEntries,
      tasks: this.tasks,
      topics: this.topics,
      categories: this.categories,
      activityLogs: this.activityLogs
    });
    this.milestoneProgress = this.milestones.map((milestone) =>
      calculateMilestoneProgress({
        milestone,
        today: this.today,
        categories: this.categories,
        topics: this.topics,
        tasks: this.tasks,
        activityLogs: this.activityLogs
      })
    );
  }

  private queueWrite(key: string, run: () => Promise<void>): Promise<void> {
    const previous = this.writeQueue.get(key) ?? Promise.resolve();
    const next = previous.then(run, run);
    this.writeQueue.set(key, next);
    void next.then(
      () => {
        if (this.writeQueue.get(key) === next) this.writeQueue.delete(key);
      },
      () => {
        if (this.writeQueue.get(key) === next) this.writeQueue.delete(key);
      }
    );
    return next;
  }

  private async persist(
    operation: (infra: Infrastructure, workspaceId: Workspace['id']) => Promise<void>
  ): Promise<void> {
    const workspaceId = this.workspace?.id;
    if (workspaceId === undefined) {
      this.error = 'Select a workspace first.';
      return;
    }
    await this.queueWrite(`persist:${workspaceId}`, () =>
      this.withBusy(
        () => operation(this.requireInfrastructure(), workspaceId),
        () => this.scheduleRefresh()
      )
    );
  }

  private startRealtime(): void {
    const workspace = this.workspace;
    if (workspace === null || this.realtimeWorkspaceId === workspace.id) return;
    this.stopRealtime();
    this.realtimeUnsubscribe = this.requireInfrastructure().subscribeToWorkspaceRows(
      () => this.scheduleRefresh()
    );
    this.realtimeWorkspaceId = workspace.id;
  }

  private stopRealtime(): void {
    this.realtimeUnsubscribe?.();
    this.realtimeUnsubscribe = null;
    this.realtimeWorkspaceId = null;
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      if (this.workspace === null) return;
      const token = ++this.loadToken;
      void this.reload(token).catch(() => {});
    }, 600);
  }

  private replaceEntry(entry: WeeklyPoolEntry): void {
    const exists = this.weekEntries.some((item) => item.id === entry.id);
    this.weekEntries = exists
      ? this.weekEntries.map((item) => (item.id === entry.id ? entry : item))
      : [...this.weekEntries, entry];
  }

  private upsert<T extends { readonly id: string }>(
    list: readonly T[],
    item: T
  ): readonly T[] {
    return list.some((entry) => entry.id === item.id)
      ? list.map((entry) => (entry.id === item.id ? item : entry))
      : [...list, item];
  }

  private async withBusy(
    operation: () => Promise<void>,
    onError?: () => void
  ): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      await operation();
    } catch (error) {
      this.error = messageFor(error);
      onError?.();
    } finally {
      this.busy = false;
    }
  }

  private requireInfrastructure(): Infrastructure {
    if (this.infrastructure === null) throw new Error('App is not configured. Check the Appwrite environment variables.');
    return this.infrastructure;
  }

  private requireUser(): AuthenticatedUser {
    if (this.user === null) throw new Error('Authentication is required.');
    return this.user;
  }

  private clearWorkspaceData(): void {
    this.stopRealtime();
    this.categories = [];
    this.topics = [];
    this.tasks = [];
    this.milestones = [];
    this.milestoneProgress = [];
    this.activityLogs = [];
    this.activityEvents = [];
    this.weekEntries = [];
    this.recommendation = EMPTY_RECOMMENDATION;
  }
}



function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export const app = new AppStore();
