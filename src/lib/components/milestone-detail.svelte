<script lang="ts">
  import Modal from '#lib/components/ui/modal.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Progress } from '#lib/components/ui/progress/index.js';
  import TaskStatusBadge from '#lib/components/task-status-badge.svelte';
  import WeightBadge from '#lib/components/weight-badge.svelte';
  import { formatDate, formatPercent, formatWeight } from '#lib/presentation/format.js';
  import type { CategoryColorMeta } from '#lib/presentation/category-color.js';
  import {
    MILESTONE_STATUS_META,
    milestoneDueLabel,
    milestoneMomentum,
    milestonePaceGap,
    milestoneProjection,
    milestoneTopicProgress,
    type MilestoneContext,
    type MilestoneView
  } from '#lib/presentation/milestones.js';
  import { cn } from '#lib/utils.js';
  import { CalendarPlus, Check, Pencil, Trash2 } from '@lucide/svelte';

  let {
    view,
    scopeLabel,
    scopeColor,
    context,
    inCurrentWeek,
    busy = false,
    canDelete = true,
    onClose,
    onEdit,
    onDelete,
    onAddTask
  }: {
    view: MilestoneView;
    scopeLabel: string;
    scopeColor: CategoryColorMeta;
    context: MilestoneContext;
    inCurrentWeek: ReadonlySet<string>;
    busy?: boolean;
    canDelete?: boolean;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onAddTask: (taskId: string) => void;
  } = $props();

  let meta = $derived(MILESTONE_STATUS_META[view.status]);
  let momentum = $derived(milestoneMomentum(view.milestone, context));
  let projection = $derived(milestoneProjection(view, context));
  let topicProgress = $derived(milestoneTopicProgress(view, context));
  let visibleTopics = $derived(topicProgress.slice(0, 6));
  let maxMomentum = $derived(Math.max(1, ...momentum.map((week) => week.weight)));
  let gap = $derived(milestonePaceGap(view.progress));
  let remainingWeight = $derived(
    view.remainingTasks.reduce((sum, task) => sum + task.taskWeight, 0)
  );
  let weeksLeft = $derived(Math.ceil(Math.max(0, view.daysRemaining) / 7));
  let showTopics = $derived(
    view.milestone.scope.kind === 'category' && topicProgress.length > 1
  );
  let paceSentence = $derived(
    view.reached
      ? 'The target has been reached.'
      : gap > 0
        ? `${gap} points ahead of schedule.`
        : gap < 0
          ? `${Math.abs(gap)} points behind schedule.`
          : 'Exactly on schedule.'
  );
</script>

<Modal
  open={true}
  title={view.milestone.title}
  description={`${scopeLabel} · due ${formatDate(view.milestone.dueDate)}`}
  class="max-w-2xl"
  onOpenChange={(open) => {
    if (!open) onClose();
  }}
>
  <div class="flex flex-wrap items-center gap-2">
    <span
      class={cn('rounded-full px-2 py-0.5 text-xs font-medium', meta.badgeClass)}
    >
      {meta.label}
    </span>
    <span class="text-xs text-muted-foreground">
      {milestoneDueLabel(view.daysRemaining)}
    </span>
  </div>

  <div class="mt-3 rounded-xl border border-l-4 bg-muted/20 p-3 {scopeColor.borderClass}">
    <div class="flex items-baseline justify-between gap-2">
      <p class="text-2xl font-semibold tabular-nums">
        {formatPercent(view.progress.completionPercentage)}
        <span class="text-sm font-normal text-muted-foreground">complete</span>
      </p>
      <p class="text-sm text-muted-foreground">{view.progress.targetPercentage}% target</p>
    </div>
    <Progress
      value={view.progress.targetProgressPercentage}
      class="mt-2 h-2.5"
      indicatorClass={meta.indicatorClass}
    />
    <div class="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
      <span>Target progress {formatPercent(view.progress.targetProgressPercentage)}</span>
      <span>Time used {formatPercent(view.progress.elapsedPercentage)}</span>
    </div>
    <p
      class={cn(
        'mt-1 text-xs font-medium',
        gap < 0 && !view.reached ? 'text-destructive' : 'text-muted-foreground'
      )}
    >
      {paceSentence}
    </p>
  </div>

  <div class="mt-3 grid grid-cols-3 gap-2">
    <div class="rounded-lg border px-2.5 py-2">
      <p class="text-[11px] text-muted-foreground">Tasks</p>
      <p class="text-sm font-medium tabular-nums">
        {view.progress.completedTaskCount}/{view.progress.totalTaskCount}
      </p>
    </div>
    <div class="rounded-lg border px-2.5 py-2">
      <p class="text-[11px] text-muted-foreground">Weight</p>
      <p class="text-sm font-medium tabular-nums">
        {formatWeight(view.progress.completedWeight)}/{formatWeight(view.progress.totalWeight)}
      </p>
    </div>
    <div class="rounded-lg border px-2.5 py-2">
      <p class="text-[11px] text-muted-foreground">Time used</p>
      <p class="text-sm font-medium tabular-nums">
        {formatPercent(view.progress.elapsedPercentage)}
      </p>
    </div>
  </div>

  <div class="mt-3 rounded-xl border p-3 text-sm">
    {#if view.progress.totalTaskCount === 0}
      <p class="font-medium">No tasks to track yet</p>
      <p class="mt-0.5 text-muted-foreground">
        Add tasks to this category or topic and progress will appear here.
      </p>
    {:else if view.reached}
      <p class="font-medium">Target reached</p>
      <p class="mt-0.5 text-muted-foreground">
        The scope is {formatPercent(view.progress.completionPercentage)} complete against a
        {view.progress.targetPercentage}% target.
      </p>
    {:else if projection.projectedDate !== null}
      <p class="font-medium">
        At your recent pace ({formatWeight(projection.recentWeeklyWeight)} weight/week),
        you would hit the target around {formatDate(projection.projectedDate)}.
      </p>
      <p class="mt-1 text-muted-foreground">
        {#if projection.daysLate !== null && projection.daysLate > 0}
          That is {projection.daysLate} days after the deadline.
        {:else if projection.daysLate !== null && projection.daysLate < 0}
          That is {Math.abs(projection.daysLate)} days before the deadline.
        {:else}
          That lands on the deadline.
        {/if}
        {#if weeksLeft > 0}
          On time needs about {formatWeight(projection.requiredWeeklyWeight)}
          weight/week for the remaining {weeksLeft}
          {weeksLeft === 1 ? 'week' : 'weeks'}.
        {:else if view.daysRemaining < 0}
          The deadline has passed.
        {:else}
          The deadline is today.
        {/if}
      </p>
    {:else}
      <p class="font-medium">No pace estimate yet</p>
      <p class="mt-0.5 text-muted-foreground">
        Complete a few tasks in this scope and a projected date will appear.
      </p>
    {/if}
    {#if view.progress.totalTaskCount > 0}
      <p class="mt-1 text-xs text-muted-foreground">
        {formatWeight(projection.remainingToTarget)} weight left to hit the
        {view.progress.targetPercentage}% target.
      </p>
    {/if}
  </div>

  <section class="mt-4">
    <div class="flex items-baseline justify-between gap-2">
      <h3 class="text-sm font-semibold">Momentum</h3>
      <p class="text-xs text-muted-foreground">Weight completed per week</p>
    </div>
    <div class="mt-2 flex h-24 items-end gap-1">
      {#each momentum as week (week.weekStart)}
        <div class="flex h-full flex-1 flex-col justify-end">
          <div
            class={cn(
              'w-full rounded-t',
              week.weight > 0 ? scopeColor.barClass : 'bg-muted'
            )}
            style:height={week.weight > 0
              ? `${Math.max(8, Math.round((week.weight / maxMomentum) * 100))}%`
              : '2px'}
            role="img"
            aria-label={`Week of ${formatDate(week.weekStart)}: ${formatWeight(week.weight)} weight from ${week.count} tasks`}
            title={`${formatDate(week.weekStart)}: ${formatWeight(week.weight)} weight`}
          ></div>
        </div>
      {/each}
    </div>
    <div class="mt-1 flex gap-1">
      {#each momentum as week (week.weekStart)}
        <span class="flex-1 text-center text-[10px] text-muted-foreground">
          {formatDate(week.weekStart)}
        </span>
      {/each}
    </div>
    {#if momentum.every((week) => week.weight === 0)}
      <p class="mt-1 text-xs text-muted-foreground">
        No completions in this scope over the last six weeks.
      </p>
    {/if}
  </section>

  {#if showTopics}
    <section class="mt-4">
      <h3 class="text-sm font-semibold">Where the work is</h3>
      <ul class="mt-2 space-y-2">
        {#each visibleTopics as item (item.topic.id)}
          <li>
            <div class="flex items-baseline justify-between gap-2 text-sm">
              <span class="truncate">{item.topic.name}</span>
              <span class="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatPercent(item.completionPercentage)}
              </span>
            </div>
            <Progress
              value={item.completionPercentage}
              class="mt-1 h-1.5"
              indicatorClass={scopeColor.barClass}
            />
            <p class="mt-1 text-[11px] text-muted-foreground">
              {item.completedTaskCount}/{item.totalTaskCount} tasks ·
              {formatWeight(item.completedWeight)}/{formatWeight(item.totalWeight)} weight
            </p>
          </li>
        {/each}
      </ul>
      {#if topicProgress.length > visibleTopics.length}
        <p class="mt-1.5 text-[11px] text-muted-foreground">
          +{topicProgress.length - visibleTopics.length} more topics
        </p>
      {/if}
    </section>
  {/if}

  <section class="mt-4">
    <div class="flex items-baseline justify-between gap-2">
      <h3 class="text-sm font-semibold">What's left</h3>
      <p class="text-xs text-muted-foreground tabular-nums">
        {view.remainingTasks.length} tasks · {formatWeight(remainingWeight)} weight
      </p>
    </div>
    {#if view.progress.totalTaskCount === 0}
      <p class="mt-2 text-sm text-muted-foreground">No tasks in this scope yet.</p>
    {:else if view.remainingTasks.length === 0}
      <p class="mt-2 text-sm text-muted-foreground">No open tasks in this scope.</p>
    {:else}
      <ul class="mt-2 max-h-64 divide-y overflow-y-auto rounded-xl border">
        {#each view.remainingTasks as task (task.id)}
          <li class="flex min-h-12 items-center gap-2 bg-card px-2.5 py-1.5">
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm">{task.title}</span>
              <span class="mt-0.5 flex items-center gap-1.5">
                <TaskStatusBadge status={task.status} />
                <WeightBadge value={task.taskWeight} />
              </span>
            </span>
            {#if inCurrentWeek.has(task.id)}
              <span
                class="grid size-10 shrink-0 place-items-center text-muted-foreground"
                role="img"
                title="Already in this week"
                aria-label="Already in this week"
              >
                <Check class="size-4" />
              </span>
            {:else}
              <Button
                variant="ghost"
                size="icon"
                class="size-10 shrink-0"
                aria-label="Add {task.title} to this week"
                title="Add to this week"
                disabled={busy}
                onclick={() => onAddTask(task.id)}
              >
                <CalendarPlus class="size-4" />
              </Button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <div class="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
    {#if canDelete}
      <Button
        variant="ghost"
        class="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onclick={onDelete}
      >
        <Trash2 class="size-4" /> Delete
      </Button>
    {:else}
      <span></span>
    {/if}
    <div class="flex gap-2">
      <Button variant="ghost" onclick={onClose}>Close</Button>
      <Button onclick={onEdit}>
        <Pencil class="size-4" /> Edit
      </Button>
    </div>
  </div>
</Modal>
