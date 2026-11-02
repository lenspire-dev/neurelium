<script lang="ts">
  import { app } from '#lib/state/app.svelte.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Progress } from '#lib/components/ui/progress/index.js';
  import WeightBadge from '#lib/components/weight-badge.svelte';
  import { formatWeek, formatWeekday } from '#lib/presentation/format.js';
  import { CATEGORY_COLOR_META, buildCategoryColorMap } from '#lib/presentation/category-color.js';
  import { categoryBalance, dailyCompletion } from '#lib/presentation/dashboard.js';
  import { taskDisplayName } from '#lib/presentation/task-display.js';
  import { endOfWeek, isWithinDateRange } from '#lib/domain/algorithms/week.js';
  import { asCategoryId } from '#lib/domain/models/identifiers.js';
  import type { Task } from '#lib/domain/models/hierarchy.js';
  import { ArrowRight, CheckCircle2, Sparkles, Target, Timer, TrendingUp } from '@lucide/svelte';

  let weekLogs = $derived(
    app.activityLogs.filter((log) =>
      isWithinDateRange(log.completedDate, app.weekStart, endOfWeek(app.weekStart))
    )
  );
  let completedIds = $derived(app.completedTaskIdsForWeek());
  let planned = $derived(app.entriesWithTask());
  let plannedWeight = $derived(
    planned.reduce((total, item) => total + item.task.taskWeight, 0)
  );
  let doneWeight = $derived(
    planned.reduce(
      (total, item) => total + (completedIds.has(item.task.id) ? item.task.taskWeight : 0),
      0
    )
  );
  let remaining = $derived(planned.filter((item) => !completedIds.has(item.task.id)).length);
  let weekProgress = $derived(
    plannedWeight === 0 ? 0 : Math.round((doneWeight / plannedWeight) * 100)
  );
  let atRisk = $derived(
    app.milestoneProgress.filter((progress) => progress.pace === 'behind')
  );
  let primary = $derived(app.recommendation.primary);
  let topMilestones = $derived(
    app.milestones
      .map((milestone) => ({
        milestone,
        progress: app.milestoneProgress.find((item) => item.milestoneId === milestone.id)
      }))
      .filter((item) => item.progress !== undefined)
      .sort((a, b) => a.progress!.targetProgressPercentage - b.progress!.targetProgressPercentage)
      .slice(0, 3)
  );
  let hasData = $derived(app.categories.length > 0 || app.tasks.length > 0);
  let daily = $derived(dailyCompletion(app.activityLogs, app.weekStart));
  let maxDaily = $derived(Math.max(1, ...daily.map((day) => day.count)));
  let dailyLabel = $derived(
    daily.map((day) => `${formatWeekday(day.date)} ${day.count}`).join(', ')
  );
  let balances = $derived(
    categoryBalance(
      app.categories,
      app.topics,
      app.tasks,
      planned.map((item) => item.entry),
      completedIds
    )
  );
  let categoryColors = $derived(buildCategoryColorMap(app.categories));

  function categoryColor(categoryId: string) {
    const key = categoryColors.get(asCategoryId(categoryId));
    return key === undefined ? CATEGORY_COLOR_META.amber : CATEGORY_COLOR_META[key];
  }

  function taskColor(task: Task) {
    const topic = app.topicForTask(task);
    return topic === undefined
      ? CATEGORY_COLOR_META.amber
      : categoryColor(topic.categoryId);
  }

  function taskCategoryName(task: Task): string {
    const topic = app.topicForTask(task);
    return app.categories.find((category) => category.id === topic?.categoryId)?.name ?? 'Topic';
  }

  async function complete(taskId: string) {
    await app.completeTask(taskId);
  }
</script>

<svelte:head><title>Dashboard · Neurelium</title></svelte:head>

<div class="space-y-6">
  <header class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">This week</p>
      <h1 class="text-2xl font-semibold tracking-tight">{formatWeek(app.weekStart)}</h1>
    </div>
    <div class="flex gap-2">
      <a href="/week" class="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-muted">
        Plan week <ArrowRight class="size-4" />
      </a>
    </div>
  </header>

  {#if !hasData}
    <section class="rounded-2xl border border-dashed bg-card p-6 text-center sm:p-10">
      <div class="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles class="size-6" />
      </div>
      <h2 class="mt-4 text-lg font-semibold">Build your study map</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Add a category, a topic, and a few weighted tasks. Then plan your first week.
      </p>
      <a
        href="/hierarchy"
        class="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Open hierarchy <ArrowRight class="size-4" />
      </a>
    </section>
  {:else}
    <section class="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
      <div class="rounded-2xl border bg-card p-5">
        <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Sparkles class="size-4 text-primary" /> Recommended next
        </div>
        {#if primary}
          <h2 class="mt-3 flex items-center gap-2 text-xl font-semibold leading-tight">
            {#if primary.task.icon !== null}<span aria-hidden="true">{primary.task.icon}</span>{/if}
            <span>{taskDisplayName(primary.task, primary.topic)}</span>
          </h2>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span class="flex items-center gap-1.5">
              <span
                class="size-2.5 shrink-0 rounded-full {categoryColor(primary.category.id).dotClass}"
                aria-hidden="true"
              ></span>
              {primary.category.name}
            </span>
            <WeightBadge value={primary.task.taskWeight} />
          </div>
          <p class="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-sm">{primary.explanation}</p>
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <Button onclick={() => complete(primary!.task.id)} disabled={app.busy}>
              <CheckCircle2 class="size-4" /> Mark complete
            </Button>
            <a href="/week" class="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-muted">
              Change plan
            </a>
          </div>
          {#if app.recommendation.alternatives.length > 0}
            <p class="mt-4 text-xs text-muted-foreground">
              {app.recommendation.alternatives.length} alternative
              {app.recommendation.alternatives.length === 1 ? 'task is' : 'tasks are'} waiting.
            </p>
          {/if}
        {:else}
          <h2 class="mt-3 text-xl font-semibold">Nothing queued for this week</h2>
          <p class="mt-2 text-sm text-muted-foreground">
            Add tasks to the weekly pool to get a recommendation.
          </p>
          <a href="/week" class="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
            Plan the week <ArrowRight class="size-4" />
          </a>
        {/if}
      </div>

      <div class="grid grid-cols-2 gap-3">
        <a href="/week" class="rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/60">
          <span class="grid size-8 place-items-center rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300">
            <Timer class="size-4" />
          </span>
          <p class="mt-3 text-2xl font-semibold">{remaining}</p>
          <p class="text-xs text-muted-foreground">tasks left</p>
        </a>
        <div class="rounded-2xl border bg-card p-4">
          <span class="grid size-8 place-items-center rounded-lg bg-violet-500/10 text-violet-700 dark:text-violet-300">
            <TrendingUp class="size-4" />
          </span>
          <p class="mt-3 text-2xl font-semibold">{weekProgress}%</p>
          <p class="text-xs text-muted-foreground">weighted progress</p>
        </div>
        <a href="/milestones" class="rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/60">
          <span class="grid size-8 place-items-center rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300">
            <Target class="size-4" />
          </span>
          <p class="mt-3 text-2xl font-semibold">{atRisk.length}</p>
          <p class="text-xs text-muted-foreground">milestones behind</p>
        </a>
        <a href="/logs" class="rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/60">
          <span class="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 class="size-4" />
          </span>
          <p class="mt-3 text-2xl font-semibold">{weekLogs.length}</p>
          <p class="text-xs text-muted-foreground">completed this week</p>
        </a>
      </div>
    </section>

    <section class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border bg-card p-5">
        <h2 class="text-sm font-semibold">Daily completions</h2>
        <p class="mt-0.5 text-xs text-muted-foreground">Tasks finished this week</p>
        <div class="mt-4 flex h-32 items-end gap-1.5" role="img" aria-label="Tasks completed this week: {dailyLabel}">
          {#each daily as day (day.date)}
            <div class="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span class="text-[11px] font-medium tabular-nums">{day.count}</span>
              <div
                class="w-full rounded-t-md {day.count === 0 ? 'bg-muted' : 'bg-primary'}"
                style:height={day.count === 0 ? '4px' : `${Math.max(8, (day.count / maxDaily) * 100)}%`}
              ></div>
            </div>
          {/each}
        </div>
        <div class="mt-2 grid grid-cols-7 gap-1.5 text-center text-[11px] text-muted-foreground">
          {#each daily as day (day.date)}
            <span>{formatWeekday(day.date)}</span>
          {/each}
        </div>
      </div>

      <div class="rounded-2xl border bg-card p-5">
        <h2 class="text-sm font-semibold">Category balance</h2>
        <p class="mt-0.5 text-xs text-muted-foreground">Completed vs planned effort this week</p>
        {#if balances.length > 0}
          <div class="mt-4 space-y-3">
            {#each balances as item (item.category.id)}
              {@const percent = item.plannedWeight === 0 ? 0 : Math.round((item.completedWeight / item.plannedWeight) * 100)}
              <div>
                <div class="flex items-baseline justify-between gap-2 text-xs">
                  <span class="flex min-w-0 items-center gap-1 font-medium">
                    <span
                      class="size-2.5 shrink-0 rounded-full {categoryColor(item.category.id).dotClass}"
                      aria-hidden="true"
                    ></span>
                    {#if item.category.icon !== null}<span aria-hidden="true">{item.category.icon}</span>{/if}
                    <span class="truncate">{item.category.name}</span>
                  </span>
                  <span class="shrink-0 tabular-nums text-muted-foreground">
                    {item.completedWeight} / {item.plannedWeight}
                  </span>
                </div>
                <div
                  class="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label="{item.category.name}: {percent}% of planned effort completed"
                >
                  <div
                    class="h-full rounded-full {categoryColor(item.category.id).barClass}"
                    style:width={`${percent}%`}
                  ></div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="mt-4 text-sm text-muted-foreground">Plan tasks to see category effort.</p>
        {/if}
      </div>
    </section>

    <section class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border bg-card p-5">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-sm font-semibold">Weekly pool</h2>
          <a href="/week" class="text-xs font-medium text-primary hover:underline">Manage</a>
        </div>
        {#if planned.length > 0}
          <ul class="mt-3 divide-y">
            {#each planned as item (item.entry.id)}
              <li class="flex min-h-11 items-center gap-2 py-2">
                <span class="min-w-0 flex-1">
                  <span class="flex min-w-0 items-center gap-1.5 text-sm">
                    <span
                      class="size-2 shrink-0 rounded-full {taskColor(item.task).dotClass}"
                      aria-hidden="true"
                    ></span>
                    {#if item.task.icon !== null}<span aria-hidden="true">{item.task.icon}</span>{/if}
                    <span class="truncate">{taskDisplayName(item.task, app.topicForTask(item.task))}</span>
                  </span>
                  <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span class="truncate">{taskCategoryName(item.task)}</span>
                    <WeightBadge value={item.task.taskWeight} />
                  </span>
                </span>
                {#if completedIds.has(item.task.id)}
                  <span class="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <CheckCircle2 class="size-3.5" /> Done
                  </span>
                {:else}
                  <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => complete(item.task.id)}
                    disabled={app.busy}
                  >
                    Complete
                  </Button>
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <p class="mt-3 text-sm text-muted-foreground">No tasks in this week yet.</p>
        {/if}
      </div>

      <div class="rounded-2xl border bg-card p-5">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-sm font-semibold">Milestones</h2>
          <a href="/milestones" class="text-xs font-medium text-primary hover:underline">View all</a>
        </div>
        {#if topMilestones.length > 0}
          <div class="mt-3 space-y-4">
            {#each topMilestones as item (item.milestone.id)}
              <div>
                <div class="flex items-baseline justify-between gap-2">
                  <p class="truncate text-sm">{item.milestone.title}</p>
                  <span class="shrink-0 text-xs text-muted-foreground">
                    {Math.round(item.progress!.targetProgressPercentage)}%
                  </span>
                </div>
                <Progress value={item.progress!.targetProgressPercentage} class="mt-2 h-1.5" />
              </div>
            {/each}
          </div>
        {:else}
          <p class="mt-3 text-sm text-muted-foreground">No milestones yet.</p>
          <a href="/milestones" class="mt-3 inline-flex h-10 items-center gap-2 text-sm font-medium text-primary">
            Create one <ArrowRight class="size-4" />
          </a>
        {/if}
      </div>
    </section>
  {/if}
</div>
