<script lang="ts">
  import { app } from '#lib/state/app.svelte.js';
  import WeightBadge from '#lib/components/weight-badge.svelte';
  import TaskFilterBar from '#lib/components/task-filter-bar.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import { Progress } from '#lib/components/ui/progress/index.js';
  import { formatDate, formatLongDate, formatTimestamp, formatWeekday } from '#lib/presentation/format.js';
  import { TASK_STATUS_META, taskStatusMeta } from '#lib/presentation/task-status.js';
  import {
    filterTasks,
    taskComparator,
    type SortDirection,
    type TaskFilterStatus,
    type TaskFilterWeight,
    type TaskSortKey
  } from '#lib/presentation/sorting.js';
  import { cn } from '#lib/utils.js';
  import { CATEGORY_COLOR_META, buildCategoryColorMap } from '#lib/presentation/category-color.js';
  import { categoryPath } from '#lib/presentation/tree.js';
  import { taskDisplayName } from '#lib/presentation/task-display.js';
  import { draggable, type DragPayload } from '#lib/actions/touch-dnd.js';
  import {
    addDays,
    endOfWeek,
    isIsoDate,
    isWithinDateRange,
    nextWeekStart,
    parseIsoDate,
    previousWeekStart,
    startOfWeek
  } from '#lib/domain/algorithms/week.js';
  import type { IsoDate } from '#lib/domain/models/common.js';
  import type { Task } from '#lib/domain/models/hierarchy.js';
  import type { TaskStatus } from '#lib/domain/models/task-status.js';
  import type { WeeklyPoolEntry } from '#lib/domain/models/planning.js';
  import {
    CalendarDays,
    CalendarPlus,
    ChevronLeft,
    ChevronRight,
    GripVertical,
    Inbox,
    Trash2
  } from '@lucide/svelte';

  type PoolItem = { entry: WeeklyPoolEntry; task: Task };

  let view = $state<'day' | 'week'>('day');
  let selectedDate = $state<IsoDate>(app.today);
  let taskSort = $state<TaskSortKey>('created');
  let taskSortDirection = $state<SortDirection>('desc');
  let taskFilterStatus = $state<TaskFilterStatus>('all');
  let taskFilterWeight = $state<TaskFilterWeight>('all');
  let taskQuery = $state('');
  let pool = $derived(app.entriesWithTask());
  let categoryColors = $derived(buildCategoryColorMap(app.categories));
  let taskFilters = $derived({
    status: taskFilterStatus,
    weight: taskFilterWeight,
    query: taskQuery
  });
  let visiblePool = $derived.by(() => {
    const compare = taskComparator(taskSort, taskSortDirection);
    return pool
      .filter((item) => filterTasks([item.task], taskFilters).length > 0)
      .sort((a, b) => compare(a.task, b.task));
  });
  let completedIds = $derived(app.completedTaskIdsForWeek());
  let plannedWeight = $derived(
    pool.reduce((total, item) => total + item.task.taskWeight, 0)
  );
  let doneWeight = $derived(
    pool.reduce(
      (total, item) => total + (completedIds.has(item.task.id) ? item.task.taskWeight : 0),
      0
    )
  );
  let progress = $derived(
    plannedWeight === 0 ? 0 : Math.round((doneWeight / plannedWeight) * 100)
  );
  let canComplete = $derived(
    isWithinDateRange(app.today, app.weekStart, endOfWeek(app.weekStart))
  );
  let viewingToday = $derived(view === 'day' && selectedDate === app.today);
  let viewingThisWeek = $derived(
    view === 'week' && app.weekStart === startOfWeek(app.today)
  );
  let weekTodo = $derived(visiblePool.filter((item) => item.entry.plannedDate === null));
  let days = $derived(
    Array.from({ length: 7 }, (_, offset) => addDays(app.weekStart, offset))
  );
  let selectedItems = $derived(
    visiblePool.filter((item) => item.entry.plannedDate === selectedDate)
  );
  let selectedWeight = $derived(
    selectedItems.reduce((total, item) => total + item.task.taskWeight, 0)
  );
  let dayHasTasks = $derived(pool.some((item) => item.entry.plannedDate === selectedDate));

  function entriesFor(date: string): readonly PoolItem[] {
    return visiblePool.filter((item) => item.entry.plannedDate === date);
  }

  function taskBreadcrumb(task: Task): string {
    const topic = app.topicForTask(task);
    if (topic === undefined) return 'Topic';
    return categoryPath(topic.categoryId, app.categories)
      .map((category) => category.name)
      .join(' › ');
  }

  function taskColor(task: Task) {
    const topic = app.topicForTask(task);
    const key = topic === undefined ? undefined : categoryColors.get(topic.categoryId);
    return key === undefined ? CATEGORY_COLOR_META.amber : CATEGORY_COLOR_META[key];
  }

  function loadWeekFor(date: IsoDate) {
    const week = startOfWeek(date);
    if (week !== app.weekStart) void app.setWeek(week);
  }

  function selectDate(date: IsoDate) {
    selectedDate = date;
    loadWeekFor(date);
  }

  function shiftWeek(direction: -1 | 1) {
    selectedDate = addDays(selectedDate, direction * 7);
    void app.setWeek(
      direction < 0 ? previousWeekStart(app.weekStart) : nextWeekStart(app.weekStart)
    );
  }

  function step(direction: -1 | 1) {
    if (view === 'day') selectDate(addDays(selectedDate, direction));
    else shiftWeek(direction);
  }

  function goToday() {
    selectedDate = app.today;
    loadWeekFor(app.today);
  }

  function jumpToDate(event: Event) {
    const value = (event.currentTarget as HTMLInputElement).value;
    if (isIsoDate(value)) selectDate(value);
  }

  async function drop(payload: DragPayload, zone: string) {
    const plannedDate = zone === 'week-todo' ? null : zone;
    if (payload.kind === 'task') await app.addTaskToCurrentWeek(payload.id, plannedDate);
    else await app.scheduleEntry(payload.id, plannedDate);
  }

  async function remove(id: string) {
    await app.removeEntry(id);
  }

  async function moveEntry(id: string, target: string) {
    if (target === 'next') await app.moveEntryToNextWeek(id);
    else await app.scheduleEntry(id, target === 'week-todo' ? null : target);
  }

</script>

  {#snippet taskCard(item: PoolItem, showToday = false)}
    <li
      data-drag-card
      class="flex items-start gap-1.5 rounded-xl border border-l-[3px] bg-background p-2 {taskColor(
        item.task
      ).borderClass}"
    >
      <button
        type="button"
        class="mt-0.5 grid size-10 shrink-0 touch-none place-items-center rounded-md text-muted-foreground hover:bg-muted"
        aria-label="Drag {item.task.title}"
        use:draggable={{
          payload: () => ({ kind: 'entry', id: item.entry.id }),
          onDrop: drop,
          disabled: () => app.busy
        }}
      >
        <GripVertical class="size-4" />
      </button>
      <div class="min-w-0 flex-1 py-0.5">
        <div class="flex min-w-0 items-center gap-1.5">
          <p
            class="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium"
            title={taskDisplayName(item.task, app.topicForTask(item.task))}
          >
            {#if item.task.icon !== null}<span aria-hidden="true">{item.task.icon}</span>{/if}
            <span class="truncate">{taskDisplayName(item.task, app.topicForTask(item.task))}</span>
          </p>
          <WeightBadge value={item.task.taskWeight} />
        </div>
        <p
          class="mt-0.5 line-clamp-2 text-xs text-muted-foreground"
          title={taskBreadcrumb(item.task)}
        >
          {taskBreadcrumb(item.task)}
        </p>
        <div class="mt-2 flex flex-wrap items-center gap-1.5">
          <select
            class={cn(
              'h-10 w-28 rounded-md border px-2 text-xs font-medium',
              taskStatusMeta(item.task.status).badgeClass
            )}
            value={item.task.status}
            aria-label="Status for {item.task.title}"
            disabled={app.busy}
            onchange={(event) =>
              app.changeTaskStatus(
                item.task.id,
                (event.currentTarget as HTMLSelectElement).value as TaskStatus
              )}
          >
            {#each TASK_STATUS_META as meta (meta.value)}
              <option value={meta.value} disabled={meta.value === 'done' && !canComplete}>
                {meta.label}
              </option>
            {/each}
          </select>
          <select
            class="h-10 rounded-md border bg-background px-2 text-xs text-muted-foreground"
            value={item.entry.plannedDate ?? 'week-todo'}
            aria-label="Move {item.task.title} to another day"
            disabled={app.busy}
            onchange={(event) =>
              moveEntry(item.entry.id, (event.currentTarget as HTMLSelectElement).value)}
          >
            <option value="week-todo">To do this week</option>
            {#each days as day (day)}
              <option value={day}>{formatWeekday(day)} {parseIsoDate(day).getUTCDate()}</option>
            {/each}
            <option value="next">Next week</option>
          </select>
          <Button
            variant="ghost"
            size="sm"
            class="h-10 gap-1 px-2 text-xs text-muted-foreground"
            aria-label="Remove {item.task.title} from this week"
            disabled={app.busy}
            onclick={() => remove(item.entry.id)}
          >
            <Trash2 class="size-4" /> Remove
          </Button>
          {#if showToday && canComplete}
            <Button
              variant="outline"
              size="sm"
              class="h-10 gap-1 px-2 text-xs"
              aria-label="Schedule {item.task.title} for today"
              title="Schedule for today"
              disabled={app.busy}
              onclick={() => app.scheduleEntry(item.entry.id, app.today)}
            >
              <CalendarPlus class="size-4" /> Today
            </Button>
          {/if}
        </div>
        <p class="mt-1 text-[11px] text-muted-foreground">
          Added {formatTimestamp(item.entry.createdAt)}
        </p>
      </div>
    </li>
  {/snippet}

  {#snippet weekTodoSection()}
    <section
      data-drop-zone="week-todo"
      class="rounded-2xl border bg-card p-4 transition-shadow"
      aria-label="To do this week"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <Inbox class="size-4 text-muted-foreground" />
          <h2 class="text-sm font-semibold">To do this week</h2>
        </div>
        <span class="text-xs text-muted-foreground">{weekTodo.length} tasks</span>
      </div>
      {#if weekTodo.length > 0}
        <ul class="mt-3 space-y-2">
          {#each weekTodo as item (item.entry.id)}
            {@render taskCard(item, true)}
          {/each}
        </ul>
      {:else}
        <p class="mt-3 rounded-lg border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
          Add tasks from <a class="font-medium text-primary hover:underline" href="/hierarchy">Hierarchy</a>,
          then drop them here to keep them in this week without choosing a day.
        </p>
      {/if}
    </section>
  {/snippet}

<svelte:head><title>Week · Neurelium</title></svelte:head>

<div class="space-y-5">
  <header class="space-y-3">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          {view === 'day' ? 'Day plan' : 'Weekly plan'}
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          {view === 'day'
            ? formatLongDate(selectedDate)
            : `Week of ${formatLongDate(app.weekStart)}`}
        </p>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <div
          class="flex items-center gap-1 rounded-lg border bg-card p-1"
          role="group"
          aria-label="Plan view"
        >
          <Button
            variant={view === 'day' ? 'secondary' : 'ghost'}
            size="sm"
            class="h-11"
            aria-pressed={view === 'day'}
            onclick={() => (view = 'day')}
          >
            Day
          </Button>
          <Button
            variant={view === 'week' ? 'secondary' : 'ghost'}
            size="sm"
            class="h-11"
            aria-pressed={view === 'week'}
            onclick={() => (view = 'week')}
          >
            Week
          </Button>
        </div>
        <div class="flex items-center gap-1 rounded-lg border bg-card p-1">
          <Button
            variant="ghost"
            size="icon"
            class="size-11"
            aria-label={view === 'day' ? 'Previous day' : 'Previous week'}
            onclick={() => step(-1)}
          >
            <ChevronLeft class="size-4" />
          </Button>
          <Button
            variant={view === 'day' ? (viewingToday ? 'default' : 'ghost') : viewingThisWeek ? 'default' : 'ghost'}
            size="sm"
            class="h-11"
            aria-pressed={view === 'day' ? viewingToday : viewingThisWeek}
            onclick={goToday}
          >
            {view === 'day' ? 'Today' : 'This week'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="size-11"
            aria-label={view === 'day' ? 'Next day' : 'Next week'}
            onclick={() => step(1)}
          >
            <ChevronRight class="size-4" />
          </Button>
        </div>
        <Input
          type="date"
          aria-label="Jump to date"
          class="h-11 w-40"
          value={selectedDate}
          onchange={jumpToDate}
        />
      </div>
    </div>
    <div>
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>{Math.round(doneWeight * 10) / 10} of {Math.round(plannedWeight * 10) / 10} effort</span>
        <span>{progress}%</span>
      </div>
      <Progress value={progress} class="mt-1.5 h-2" />
    </div>
  </header>

  <TaskFilterBar
    bind:sort={taskSort}
    bind:direction={taskSortDirection}
    bind:status={taskFilterStatus}
    bind:weight={taskFilterWeight}
    bind:query={taskQuery}
    resultCount={visiblePool.length}
  />

  {@render weekTodoSection()}

  {#if view === 'day'}
    <section aria-label="Choose a day">
      <div class="grid grid-cols-7 gap-1.5">
        {#each days as day (day)}
          <button
            type="button"
            data-drop-zone={day}
            aria-label="{formatLongDate(day)}, {entriesFor(day).length} tasks"
            aria-pressed={selectedDate === day}
            onclick={() => selectDate(day)}
            class={cn(
              'flex min-w-0 flex-col items-center rounded-xl border px-1 py-2 transition-colors',
              selectedDate === day
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'bg-card hover:bg-muted',
              day === app.today && selectedDate !== day && 'border-primary/40'
            )}
          >
            <span class="text-[11px] font-medium uppercase tracking-wide opacity-80">
              {formatWeekday(day)}
            </span>
            <span class="mt-0.5 text-lg font-semibold leading-none">
              {parseIsoDate(day).getUTCDate()}
            </span>
            <span class="mt-1 block h-3 text-[11px] opacity-70">
              {entriesFor(day).length > 0 ? entriesFor(day).length : ''}
            </span>
          </button>
        {/each}
      </div>
    </section>

    <section
      data-drop-zone={selectedDate}
      class="rounded-2xl border bg-card p-4 transition-shadow"
      aria-label={formatLongDate(selectedDate)}
    >
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-lg font-semibold">{formatLongDate(selectedDate)}</h2>
            {#if selectedDate === app.today}
              <span class="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                Today
              </span>
            {/if}
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            {selectedItems.length} {selectedItems.length === 1 ? 'task' : 'tasks'} ·
            {Math.round(selectedWeight * 10) / 10} effort
          </p>
        </div>
      </div>
      {#if selectedItems.length > 0}
        <ul class="mt-3 space-y-2">
          {#each selectedItems as item (item.entry.id)}
            {@render taskCard(item)}
          {/each}
        </ul>
      {:else}
        <div class="mt-3 rounded-xl border border-dashed px-4 py-8 text-center">
          <CalendarDays class="mx-auto size-5 text-muted-foreground" />
          {#if dayHasTasks}
            <p class="mt-2 text-sm font-medium">No tasks match the filters.</p>
            <p class="mt-1 text-xs text-muted-foreground">Clear the filters to see this day's tasks.</p>
          {:else}
            <p class="mt-2 text-sm font-medium">Nothing planned for this day.</p>
            <p class="mt-1 text-xs text-muted-foreground">
              Drop a task here, or add one from
              <a class="font-medium text-primary hover:underline" href="/hierarchy">Hierarchy</a>.
            </p>
          {/if}
        </div>
      {/if}
    </section>
  {:else}
      <section aria-label="Days">
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {#each days as day (day)}
            <div
              data-drop-zone={day}
              class="min-h-32 rounded-2xl border bg-card p-3 transition-shadow {day === app.today
                ? 'border-primary/40 bg-primary/[0.03]'
                : ''}"
              aria-label={formatLongDate(day)}
            >
              <div class="flex items-baseline justify-between gap-2">
                <div>
                  <h2 class="text-sm font-semibold">{formatWeekday(day)}</h2>
                  <p class="text-xs text-muted-foreground">{formatDate(day)}</p>
                </div>
                {#if day === app.today}
                  <span class="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Today</span>
                {/if}
              </div>
              {#if entriesFor(day).length > 0}
                <ul class="mt-2 space-y-2">
                  {#each entriesFor(day) as item (item.entry.id)}
                    {@render taskCard(item)}
                  {/each}
                </ul>
              {:else}
                <p class="mt-3 rounded-lg border border-dashed px-2 py-3 text-center text-xs text-muted-foreground">
                  Drop a task here
                </p>
              {/if}
            </div>
          {/each}
        </div>
      </section>
  {/if}


</div>
