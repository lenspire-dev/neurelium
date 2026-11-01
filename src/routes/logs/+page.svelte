<script lang="ts">
  import { app } from '#lib/state/app.svelte.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import { formatDate, formatLongDate, formatTimestamp } from '#lib/presentation/format.js';
  import { CATEGORY_COLOR_META, buildCategoryColorMap } from '#lib/presentation/category-color.js';
  import { endOfWeek, isWithinDateRange } from '#lib/domain/algorithms/week.js';
  import { History } from '@lucide/svelte';

  let activitySort = $state<'completed-desc' | 'completed-asc' | 'recorded' | 'task'>(
    'completed-desc'
  );
  let topicFilter = $state('all');
  let logQuery = $state('');

  function taskTitle(taskId: string): string {
    return app.tasks.find((task) => task.id === taskId)?.title ?? 'Deleted task';
  }

  function topicName(taskId: string): string {
    const task = app.tasks.find((item) => item.id === taskId);
    return task === undefined ? '' : (app.topicForTask(task)?.name ?? '');
  }

  let topicChoices = $derived(
    app.topics.slice().sort((a, b) => a.name.localeCompare(b.name))
  );
  let categoryColors = $derived(buildCategoryColorMap(app.categories));

  function taskColor(taskId: string) {
    const task = app.tasks.find((item) => item.id === taskId);
    const topic = task === undefined ? undefined : app.topicForTask(task);
    const key = topic === undefined ? undefined : categoryColors.get(topic.categoryId);
    return key === undefined ? CATEGORY_COLOR_META.amber : CATEGORY_COLOR_META[key];
  }

  let logs = $derived.by(() => {
    const query = logQuery.trim().toLocaleLowerCase();
    return app.activityLogs
      .filter((log) => {
        if (query !== '' && !taskTitle(log.taskId).toLocaleLowerCase().includes(query)) {
          return false;
        }
        if (topicFilter === 'all') return true;
        const task = app.tasks.find((item) => item.id === log.taskId);
        return task?.topicId === topicFilter;
      })
      .sort((a, b) => {
        if (activitySort === 'completed-asc') {
          return a.completedDate.localeCompare(b.completedDate) || a.createdAt.localeCompare(b.createdAt);
        }
        if (activitySort === 'recorded') return b.createdAt.localeCompare(a.createdAt);
        if (activitySort === 'task') return taskTitle(a.taskId).localeCompare(taskTitle(b.taskId));
        return b.completedDate.localeCompare(a.completedDate) || b.createdAt.localeCompare(a.createdAt);
      });
  });

  let weekCount = $derived(
    app.activityLogs.filter((log) =>
      isWithinDateRange(log.completedDate, app.weekStart, endOfWeek(app.weekStart))
    ).length
  );

  let groups = $derived.by(() => {
    const map = new Map<string, typeof logs>();
    for (const log of logs) {
      const existing = map.get(log.completedDate);
      if (existing === undefined) map.set(log.completedDate, [log]);
      else existing.push(log);
    }
    return [...map.entries()];
  });

</script>

<svelte:head><title>Activity · Neurelium</title></svelte:head>

<div class="space-y-5">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">Activity</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      {logs.length} completions shown · {weekCount} this week
    </p>
  </header>

  <div class="flex flex-wrap items-center gap-1.5 rounded-xl border bg-card p-2">
    <span class="px-1 text-xs font-medium text-muted-foreground">Sort & filter</span>
    <select
      class="h-10 rounded-lg border bg-background px-2 text-xs"
      aria-label="Sort activity"
      bind:value={activitySort}
    >
      <option value="completed-desc">Newest completion</option>
      <option value="completed-asc">Oldest completion</option>
      <option value="recorded">Recently recorded</option>
      <option value="task">Task title</option>
    </select>
    <select
      class="h-10 rounded-lg border bg-background px-2 text-xs"
      aria-label="Filter activity by topic"
      bind:value={topicFilter}
    >
      <option value="all">All topics</option>
      {#each topicChoices as topic (topic.id)}
        <option value={topic.id}>{topic.name}</option>
      {/each}
    </select>
    <Input
      class="h-10 w-44"
      aria-label="Search completed tasks"
      placeholder="Search tasks"
      bind:value={logQuery}
    />
  </div>

  {#if groups.length > 0}
    <div class="space-y-6">
      {#each groups as [date, entries] (date)}
        <section>
          <h2 class="sticky top-[calc(3.5rem_+_env(safe-area-inset-top))] z-10 bg-background/90 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur md:top-0">
            {date === app.today ? 'Today' : formatLongDate(date)} · {entries.length}
          </h2>
          <ul class="divide-y rounded-xl border bg-card px-3">
            {#each entries as log (log.id)}
              <li class="flex min-h-12 items-center gap-3 py-2">
                <span
                  class="size-2 shrink-0 rounded-full {taskColor(log.taskId).dotClass}"
                  aria-hidden="true"
                ></span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{taskTitle(log.taskId)}</p>
                  <p class="truncate text-xs text-muted-foreground">
                    {topicName(log.taskId)}{log.note ? ` · ${log.note}` : ''}
                  </p>
                  <p class="truncate text-[11px] text-muted-foreground">
                    Recorded {formatTimestamp(log.createdAt)}
                  </p>
                </div>
                <time class="shrink-0 text-xs text-muted-foreground" datetime={date}>
                  {formatDate(date)}
                </time>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {:else}
    <div class="rounded-2xl border border-dashed bg-card p-8 text-center">
      <History class="mx-auto size-8 text-muted-foreground" />
      <h2 class="mt-3 text-base font-semibold">
        {app.activityLogs.length === 0 ? 'No activity yet' : 'No activity matches the filters'}
      </h2>
      <p class="mt-1 text-sm text-muted-foreground">
        {app.activityLogs.length === 0
          ? 'Completed tasks show up here, grouped by day.'
          : 'Clear the search or choose a different topic.'}
      </p>
      {#if app.activityLogs.length === 0}
        <a href="/week" class="mt-4 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
          Plan this week
        </a>
      {/if}
    </div>
  {/if}
</div>
