<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.js';
  import { Progress } from '#lib/components/ui/progress/index.js';
  import WeightBadge from '#lib/components/weight-badge.svelte';
  import { formatDate, formatPercent, formatWeight } from '#lib/presentation/format.js';
  import type { CategoryColorMeta } from '#lib/presentation/category-color.js';
  import {
    MILESTONE_STATUS_META,
    milestoneDueLabel,
    milestonePaceGap,
    type MilestoneView
  } from '#lib/presentation/milestones.js';
  import { cn } from '#lib/utils.js';
  import { CalendarPlus, Check } from '@lucide/svelte';

  let {
    view,
    scopeLabel,
    scopeColor,
    inCurrentWeek,
    busy = false,
    onOpen,
    onAddTask
  }: {
    view: MilestoneView;
    scopeLabel: string;
    scopeColor: CategoryColorMeta;
    inCurrentWeek: ReadonlySet<string>;
    busy?: boolean;
    onOpen: () => void;
    onAddTask: (taskId: string) => void;
  } = $props();

  let meta = $derived(MILESTONE_STATUS_META[view.status]);
  let gap = $derived(milestonePaceGap(view.progress));
  let overdue = $derived(view.daysRemaining < 0 && !view.reached);
  let paceLabel = $derived(
    view.reached
      ? 'Target reached'
      : gap > 0
        ? `${gap} pts ahead`
        : gap < 0
          ? `${Math.abs(gap)} pts behind`
          : 'On pace'
  );
</script>

<article class="flex h-full flex-col rounded-2xl border border-l-[3px] bg-card p-4 {scopeColor.borderClass}">
  <div class="flex items-start justify-between gap-2">
    <div class="min-w-0">
      <h2 class="truncate text-base font-semibold">{view.milestone.title}</h2>
      <p class="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground" title={scopeLabel}>
        <span class="size-2 shrink-0 rounded-full {scopeColor.dotClass}" aria-hidden="true"></span>
        <span class="truncate">{scopeLabel}</span>
      </p>
    </div>
    <span
      class={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
        meta.badgeClass
      )}
    >
      {meta.label}
    </span>
  </div>

  <p class={cn('mt-2 text-xs', overdue ? 'text-destructive' : 'text-muted-foreground')}>
    Due {formatDate(view.milestone.dueDate)} · {milestoneDueLabel(view.daysRemaining)}
  </p>

  <div class="mt-3">
    <div class="flex items-baseline justify-between gap-2 text-sm">
      <span class="font-medium">
        {formatPercent(view.progress.completionPercentage)} complete
      </span>
      <span class="text-xs text-muted-foreground">
        of {view.progress.targetPercentage}% target
      </span>
    </div>
    <Progress
      value={view.progress.targetProgressPercentage}
      class="mt-2 h-2"
      indicatorClass={meta.indicatorClass}
    />
    <div class="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
      <span>Time used {formatPercent(view.progress.elapsedPercentage)}</span>
      <span class={cn(gap < 0 && !view.reached && 'text-destructive')}>{paceLabel}</span>
    </div>
  </div>

  <p class="mt-3 text-xs text-muted-foreground">
    {view.progress.completedTaskCount}/{view.progress.totalTaskCount} tasks ·
    {formatWeight(view.progress.completedWeight)}/{formatWeight(view.progress.totalWeight)} weight
  </p>

  <div class="mt-3 border-t pt-3">
    <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      Next up
    </p>
    {#if view.progress.totalTaskCount === 0}
      <p class="mt-1.5 text-sm text-muted-foreground">No tasks in this scope yet.</p>
    {:else if view.nextTasks.length === 0}
      <p class="mt-1.5 text-sm text-muted-foreground">
        Every task in this scope is complete.
      </p>
    {:else}
      <ul class="mt-1.5 space-y-1">
        {#each view.nextTasks as task (task.id)}
          <li class="flex min-h-10 items-center gap-2 rounded-lg bg-muted/40 py-1 pl-2">
            <WeightBadge value={task.taskWeight} />
            <span class="min-w-0 flex-1 truncate text-sm" title={task.title}>{task.title}</span>
            {#if inCurrentWeek.has(task.id)}
              <span
                class="grid size-10 shrink-0 place-items-center text-muted-foreground"
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
      {#if view.remainingTasks.length > view.nextTasks.length}
        <p class="mt-1.5 text-[11px] text-muted-foreground">
          +{view.remainingTasks.length - view.nextTasks.length} more remaining
        </p>
      {/if}
    {/if}
  </div>

  <div class="mt-auto pt-3">
    <Button
      variant="outline"
      class="w-full"
      aria-label="View progress for {view.milestone.title}"
      onclick={onOpen}
    >
      View progress
    </Button>
  </div>
</article>
