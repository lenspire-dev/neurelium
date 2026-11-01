<script lang="ts">
  import { app } from '#lib/state/app.svelte.js';
  import { askConfirm } from '#lib/state/confirm.svelte.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import { Label } from '#lib/components/ui/label/index.js';
  import Modal from '#lib/components/ui/modal.svelte';
  import { Progress } from '#lib/components/ui/progress/index.js';
  import MilestoneCard from '#lib/components/milestone-card.svelte';
  import MilestoneDetail from '#lib/components/milestone-detail.svelte';
  import WeightBadge from '#lib/components/weight-badge.svelte';
  import { formatDate, formatPercent } from '#lib/presentation/format.js';
  import {
    CATEGORY_COLOR_META,
    buildCategoryColorMap
  } from '#lib/presentation/category-color.js';
  import {
    MILESTONE_STATUS_META,
    buildMilestoneViews,
    filterMilestoneViews,
    milestoneDueLabel,
    milestoneStatusCounts,
    sortMilestoneViews,
    type MilestoneContext,
    type MilestoneFilter,
    type MilestoneSort,
    type MilestoneView
  } from '#lib/presentation/milestones.js';
  import { categoryPath, categoryRows } from '#lib/presentation/tree.js';
  import { addDays, toIsoDate } from '#lib/domain/algorithms/week.js';
  import {
    asCategoryId,
    asTopicId,
    type CategoryId,
    type TopicId
  } from '#lib/domain/models/identifiers.js';
  import type { Milestone, MilestoneScope } from '#lib/domain/models/analytics.js';
  import { cn } from '#lib/utils.js';
  import { CalendarPlus, Check, Flag, Plus, Target } from '@lucide/svelte';

  let dialogOpen = $state(false);
  let editing = $state<Milestone | null>(null);
  let title = $state('');
  let scopeKind = $state<'category' | 'topic'>('category');
  let scopeId = $state('');
  let targetPercentage = $state(100);
  let dueDate = $state(addDays(toIsoDate(new Date()), 30));
  let statusFilter = $state<MilestoneFilter>('all');
  let sortMode = $state<MilestoneSort>('risk');
  let milestoneQuery = $state('');
  let selectedId = $state<string | null>(null);

  let categoryChoices = $derived(categoryRows(app.categories));
  let topicGroups = $derived(
    categoryRows(app.categories)
      .map((row) => ({
        row,
        topics: app.topics
          .filter((topic) => topic.categoryId === row.category.id)
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
      }))
      .filter((group) => group.topics.length > 0)
  );

  let context: MilestoneContext = $derived({
    today: app.today,
    categories: app.categories,
    topics: app.topics,
    tasks: app.tasks,
    activityLogs: app.activityLogs
  });
  let categoryColors = $derived(buildCategoryColorMap(app.categories));

  function scopeColor(scope: MilestoneScope) {
    const categoryId =
      scope.kind === 'category'
        ? scope.categoryId
        : app.topics.find((topic) => topic.id === scope.topicId)?.categoryId;
    const key = categoryId === undefined ? undefined : categoryColors.get(categoryId);
    return key === undefined ? CATEGORY_COLOR_META.amber : CATEGORY_COLOR_META[key];
  }
  let views: readonly MilestoneView[] = $derived(
    buildMilestoneViews(app.milestones, app.milestoneProgress, context)
  );
  let counts = $derived(milestoneStatusCounts(views));
  let statusTabs: readonly {
    value: MilestoneFilter;
    label: string;
    count: number;
  }[] = $derived([
    { value: 'all', label: 'All', count: counts.total },
    { value: 'behind', label: 'Behind', count: counts.behind },
    { value: 'on-track', label: 'On track', count: counts.onTrack },
    { value: 'ahead', label: 'Ahead', count: counts.ahead },
    { value: 'reached', label: 'Reached', count: counts.reached }
  ]);
  let visibleMilestones: readonly MilestoneView[] = $derived(
    sortMilestoneViews(
      filterMilestoneViews(views, statusFilter, milestoneQuery),
      sortMode
    )
  );
  let focusView: MilestoneView | null = $derived(
    sortMilestoneViews(
      views.filter((view) => !view.reached),
      'risk'
    )[0] ?? null
  );
  let selectedView: MilestoneView | null = $derived(
    views.find((view) => view.milestone.id === selectedId) ?? null
  );
  let currentWeekTaskIds: ReadonlySet<string> = $derived(
    new Set(app.entriesWithTask().map((item) => item.task.id))
  );

  function categoryLabel(categoryId: CategoryId): string {
    const path = categoryPath(categoryId, app.categories);
    if (path.length === 0) return 'Category';
    return path
      .map((category) => (category.icon === null ? category.name : `${category.icon} ${category.name}`))
      .join(' / ');
  }

  function topicLabel(topicId: TopicId): string {
    const topic = app.topics.find((item) => item.id === topicId);
    if (topic === undefined) return 'Topic';
    return [
      ...categoryPath(topic.categoryId, app.categories).map((category) =>
        category.icon === null ? category.name : `${category.icon} ${category.name}`
      ),
      topic.name
    ].join(' / ');
  }

  function scopeLabel(scope: MilestoneScope): string {
    return scope.kind === 'category'
      ? categoryLabel(scope.categoryId)
      : topicLabel(scope.topicId);
  }

  let selectedScopeLabel = $derived(
    scopeId === ''
      ? ''
      : scopeKind === 'category'
        ? categoryLabel(asCategoryId(scopeId))
        : topicLabel(asTopicId(scopeId))
  );

  function setScopeKind(kind: 'category' | 'topic') {
    if (scopeKind === kind) return;
    scopeKind = kind;
    scopeId = '';
  }

  function openCreate() {
    editing = null;
    title = '';
    scopeKind = 'category';
    scopeId = '';
    targetPercentage = 100;
    dueDate = addDays(toIsoDate(new Date()), 30);
    dialogOpen = true;
  }

  function openEdit(milestone: Milestone) {
    editing = milestone;
    title = milestone.title;
    scopeKind = milestone.scope.kind;
    scopeId =
      milestone.scope.kind === 'category'
        ? milestone.scope.categoryId
        : milestone.scope.topicId;
    targetPercentage = milestone.targetPercentage;
    dueDate = milestone.dueDate;
    dialogOpen = true;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (title.trim() === '') return;
    if (scopeId === '') {
      app.error = 'Choose a category or topic for this milestone.';
      return;
    }
    if (editing !== null) {
      await app.updateMilestone({
        milestoneId: editing.id,
        title,
        targetPercentage: Number(targetPercentage) || 100,
        dueDate
      });
    } else {
      const scope: MilestoneScope =
        scopeKind === 'category'
          ? { kind: 'category', categoryId: asCategoryId(scopeId) }
          : { kind: 'topic', topicId: asTopicId(scopeId) };
      await app.addMilestone({
        title,
        scope,
        targetPercentage: Number(targetPercentage) || 100,
        dueDate
      });
    }
    if (app.error === null) dialogOpen = false;
  }

  async function remove(id: string, name: string) {
    const confirmed = await askConfirm({
      title: 'Delete milestone?',
      description: `Delete "${name}"? Its progress history is not recoverable.`,
      confirmLabel: 'Delete',
      destructive: true
    });
    if (confirmed) await app.removeMilestone(id);
  }

  function editSelected() {
    const view = selectedView;
    if (view === null) return;
    selectedId = null;
    openEdit(view.milestone);
  }

  function deleteSelected() {
    const view = selectedView;
    if (view === null) return;
    selectedId = null;
    void remove(view.milestone.id, view.milestone.title);
  }
</script>

<svelte:head><title>Milestones · Neurelium</title></svelte:head>

<div class="space-y-4">
  <header class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Milestones</h1>
      <p class="mt-1 max-w-prose text-sm text-muted-foreground">
        Weighted goals with a deadline. See what's left, whether you're on pace, and what to
        plan next.
      </p>
    </div>
    <Button onclick={openCreate}>
      <Plus class="size-4" /> Milestone
    </Button>
  </header>

  {#if views.length > 0}
    <dl class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div class="rounded-xl border bg-card p-3">
        <dt class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span class="size-2 rounded-full bg-primary" aria-hidden="true"></span> Active
        </dt>
        <dd class="mt-0.5 text-xl font-semibold tabular-nums">{counts.active}</dd>
      </div>
      <div class="rounded-xl border bg-card p-3">
        <dt class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span class="size-2 rounded-full bg-sky-500" aria-hidden="true"></span> On track
        </dt>
        <dd class="mt-0.5 flex items-baseline gap-1">
          <span class="text-xl font-semibold tabular-nums">{counts.onTrack}</span>
          {#if counts.ahead > 0}
            <span class="text-[11px] text-muted-foreground">+{counts.ahead} ahead</span>
          {/if}
        </dd>
      </div>
      <div class="rounded-xl border bg-card p-3">
        <dt class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span class="size-2 rounded-full bg-destructive" aria-hidden="true"></span> Behind
        </dt>
        <dd class="mt-0.5 text-xl font-semibold tabular-nums">{counts.behind}</dd>
      </div>
      <div class="rounded-xl border bg-card p-3" title="Includes overdue milestones">
        <dt class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span class="size-2 rounded-full bg-amber-500" aria-hidden="true"></span> Due soon
        </dt>
        <dd class="mt-0.5 text-xl font-semibold tabular-nums">{counts.dueSoon}</dd>
      </div>
    </dl>
  {/if}

  {#if focusView}
    <section
      class="rounded-2xl border border-l-4 bg-card p-4 {scopeColor(focusView.milestone.scope)
        .borderClass}"
      aria-labelledby="milestone-focus"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p
            id="milestone-focus"
            class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
          >
            Focus
          </p>
          <h2 class="mt-1 truncate text-lg font-semibold">{focusView.milestone.title}</h2>
          <p class="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <span
              class="size-2 shrink-0 rounded-full {scopeColor(focusView.milestone.scope).dotClass}"
              aria-hidden="true"
            ></span>
            <span class="truncate">{scopeLabel(focusView.milestone.scope)}</span>
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <span
            class={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              MILESTONE_STATUS_META[focusView.status].badgeClass
            )}
          >
            {MILESTONE_STATUS_META[focusView.status].label}
          </span>
          <Button
            variant="outline"
            aria-label="Open {focusView.milestone.title}"
            onclick={() => (selectedId = focusView.milestone.id)}
          >
            Open
          </Button>
        </div>
      </div>

      <div class="mt-3">
        <div class="flex items-baseline justify-between gap-2 text-sm">
          <span class="font-medium">
            {formatPercent(focusView.progress.completionPercentage)} complete
          </span>
          <span class="text-xs text-muted-foreground">
            of {focusView.progress.targetPercentage}% target
          </span>
        </div>
        <Progress
          value={focusView.progress.targetProgressPercentage}
          class="mt-2 h-2"
          indicatorClass={MILESTONE_STATUS_META[focusView.status].indicatorClass}
        />
        <div class="mt-1.5 flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground">
          <span>Time used {formatPercent(focusView.progress.elapsedPercentage)}</span>
          <span>
            Due {formatDate(focusView.milestone.dueDate)} ·
            {milestoneDueLabel(focusView.daysRemaining)}
          </span>
        </div>
      </div>

      {#if focusView.nextTasks.length > 0}
        <div class="mt-3 flex flex-wrap gap-2">
          {#each focusView.nextTasks as task (task.id)}
            <div class="flex min-h-10 items-center gap-2 rounded-lg border bg-background py-1 pl-2 pr-1">
              <WeightBadge value={task.taskWeight} />
              <span class="max-w-52 truncate text-sm" title={task.title}>{task.title}</span>
              {#if currentWeekTaskIds.has(task.id)}
                <span
                  class="grid size-10 place-items-center text-muted-foreground"
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
                  class="size-10"
                  aria-label="Add {task.title} to this week"
                  title="Add to this week"
                  disabled={app.busy}
                  onclick={() => app.addTaskToCurrentWeek(task.id)}
                >
                  <CalendarPlus class="size-4" />
                </Button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <div class="flex flex-wrap items-center justify-between gap-2">
    <div
      class="flex flex-wrap gap-1 rounded-xl border bg-muted/30 p-1"
      role="group"
      aria-label="Filter milestones by status"
    >
      {#each statusTabs as tab (tab.value)}
        <button
          type="button"
          class={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
            statusFilter === tab.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
          )}
          aria-pressed={statusFilter === tab.value}
          onclick={() => (statusFilter = tab.value)}
        >
          {tab.label}
          <span
            class={cn(
              'rounded-full px-1.5 text-[11px] tabular-nums',
              statusFilter === tab.value ? 'bg-muted' : 'bg-muted/60'
            )}
          >
            {tab.count}
          </span>
        </button>
      {/each}
    </div>
    <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <Input
        type="search"
        class="h-10 w-full sm:w-56"
        aria-label="Search milestones"
        placeholder="Search milestones"
        bind:value={milestoneQuery}
      />
      <select
        class="h-10 rounded-lg border bg-background px-2 text-xs"
        aria-label="Sort milestones"
        bind:value={sortMode}
      >
        <option value="risk">Most at risk</option>
        <option value="due">Due soonest</option>
        <option value="progress">Most progress</option>
        <option value="title">Title</option>
      </select>
    </div>
  </div>

  <Modal
    bind:open={dialogOpen}
    title={editing === null ? 'New milestone' : 'Edit milestone'}
    description={editing === null
      ? 'Pick a category or topic, set a target, and choose a deadline.'
      : 'Update the target or deadline. The scope stays fixed.'}
  >
    <form class="space-y-4" onsubmit={submit}>
      <div class="space-y-2">
        <Label for="milestone-title">Title</Label>
        <Input id="milestone-title" bind:value={title} placeholder="Finish calculus unit" required />
      </div>
      {#if editing !== null}
        <div class="rounded-xl border bg-muted/40 px-3 py-2.5">
          <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Scope</p>
          <p class="mt-1 text-sm font-medium">{scopeLabel(editing.scope)}</p>
        </div>
      {:else}
        <div class="space-y-2">
          <p class="text-sm font-medium">Scope type</p>
          <div
            class="grid grid-cols-2 gap-1 rounded-lg border bg-muted/30 p-1"
            role="group"
            aria-label="Scope type"
          >
            <button
              type="button"
              class={cn(
                'h-11 rounded-md text-sm font-medium transition-colors',
                scopeKind === 'category'
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:bg-background/60'
              )}
              aria-pressed={scopeKind === 'category'}
              onclick={() => setScopeKind('category')}
            >
              Category
            </button>
            <button
              type="button"
              class={cn(
                'h-11 rounded-md text-sm font-medium transition-colors',
                scopeKind === 'topic'
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:bg-background/60'
              )}
              aria-pressed={scopeKind === 'topic'}
              onclick={() => setScopeKind('topic')}
            >
              Topic
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <p id="scope-options-label" class="text-sm font-medium">
            Choose {scopeKind === 'category' ? 'category' : 'topic'}
          </p>
          <div
            role="radiogroup"
            aria-labelledby="scope-options-label"
            class="max-h-64 overflow-y-auto rounded-xl border bg-background p-1"
          >
            {#if scopeKind === 'category'}
              {#if categoryChoices.length === 0}
                <p class="px-2 py-3 text-sm text-muted-foreground">
                  No categories yet. Create one in the hierarchy first.
                </p>
              {:else}
                {#each categoryChoices as row (row.category.id)}
                  <label
                    class={cn(
                      'flex min-h-10 cursor-pointer items-center gap-2 rounded-lg pr-2 text-sm transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring/50',
                      scopeId === row.category.id && 'bg-primary/10 text-primary'
                    )}
                    style:padding-left={`${8 + row.depth * 18}px`}
                  >
                    <input
                      type="radio"
                      name="milestone-scope"
                      value={row.category.id}
                      checked={scopeId === row.category.id}
                      onchange={() => (scopeId = row.category.id)}
                      class="sr-only"
                    />
                    <span class="grid size-4 shrink-0 place-items-center">
                      {#if scopeId === row.category.id}<Check class="size-4" />{/if}
                    </span>
                    {#if row.category.icon !== null}
                      <span aria-hidden="true">{row.category.icon}</span>
                    {/if}
                    <span class="truncate">{row.category.name}</span>
                  </label>
                {/each}
              {/if}
            {:else if topicGroups.length === 0}
              <p class="px-2 py-3 text-sm text-muted-foreground">
                No topics yet. Create one in the hierarchy first.
              </p>
            {:else}
              {#each topicGroups as group (group.row.category.id)}
                <div
                  class="flex items-center gap-1.5 px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground"
                  style:padding-left={`${8 + group.row.depth * 18}px`}
                >
                  {#if group.row.category.icon !== null}
                    <span aria-hidden="true">{group.row.category.icon}</span>
                  {/if}
                  <span class="truncate">{group.row.category.name}</span>
                </div>
                {#each group.topics as topic (topic.id)}
                  <label
                    class={cn(
                      'flex min-h-10 cursor-pointer items-center gap-2 rounded-lg pr-2 text-sm transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring/50',
                      scopeId === topic.id && 'bg-primary/10 text-primary'
                    )}
                    style:padding-left={`${30 + group.row.depth * 18}px`}
                  >
                    <input
                      type="radio"
                      name="milestone-scope"
                      value={topic.id}
                      checked={scopeId === topic.id}
                      onchange={() => (scopeId = topic.id)}
                      class="sr-only"
                    />
                    <span class="grid size-4 shrink-0 place-items-center">
                      {#if scopeId === topic.id}<Check class="size-4" />{/if}
                    </span>
                    <span class="truncate">{topic.name}</span>
                  </label>
                {/each}
              {/each}
            {/if}
          </div>
          {#if selectedScopeLabel !== ''}
            <p class="rounded-lg bg-muted px-3 py-2 text-xs">
              <span class="text-muted-foreground">Selected:</span>
              <span class="font-medium text-foreground">{selectedScopeLabel}</span>
            </p>
          {/if}
        </div>
      {/if}

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <Label for="target">Target completion</Label>
            <span class="text-sm font-medium tabular-nums">{targetPercentage}%</span>
          </div>
          <input
            id="target"
            type="range"
            min="1"
            max="100"
            step="1"
            bind:value={targetPercentage}
            class="h-10 w-full cursor-pointer accent-primary"
            aria-label="Target completion percentage"
          />
        </div>
        <div class="space-y-2">
          <Label for="due">Due date</Label>
          <Input id="due" type="date" bind:value={dueDate} required />
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <Button type="button" variant="ghost" onclick={() => (dialogOpen = false)}>Cancel</Button>
        <Button type="submit" disabled={app.busy}>
          {editing === null ? 'Create milestone' : 'Save changes'}
        </Button>
      </div>
    </form>
  </Modal>

  {#if views.length === 0}
    <div class="rounded-2xl border border-dashed bg-card p-8 text-center">
      <Target class="mx-auto size-8 text-muted-foreground" />
      <h2 class="mt-3 text-base font-semibold">Set a long-term goal</h2>
      <p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        A milestone tracks weighted task progress inside a category or topic, compares it
        with the time left, and shows what to do next.
      </p>
      <ul class="mx-auto mt-4 grid max-w-md gap-1.5 text-left text-sm text-muted-foreground">
        <li>• Measured by task weight, not raw task count.</li>
        <li>• Pace compares progress with the deadline.</li>
        <li>• Remaining tasks can be planned into the week.</li>
      </ul>
      <Button class="mt-5" onclick={openCreate}>
        <Flag class="size-4" /> Add first milestone
      </Button>
    </div>
  {:else if visibleMilestones.length === 0}
    <div class="rounded-2xl border border-dashed bg-card p-8 text-center">
      <h2 class="text-base font-semibold">No milestones match</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Try a different status, or clear the search.
      </p>
      <Button
        variant="outline"
        class="mt-4"
        onclick={() => {
          statusFilter = 'all';
          milestoneQuery = '';
        }}
      >
        Clear filters
      </Button>
    </div>
  {:else}
    <div class="grid gap-3 md:grid-cols-2">
      {#each visibleMilestones as view (view.milestone.id)}
        <MilestoneCard
          {view}
          scopeLabel={scopeLabel(view.milestone.scope)}
          scopeColor={scopeColor(view.milestone.scope)}
          inCurrentWeek={currentWeekTaskIds}
          busy={app.busy}
          onOpen={() => (selectedId = view.milestone.id)}
          onAddTask={(taskId) => app.addTaskToCurrentWeek(taskId)}
        />
      {/each}
    </div>
  {/if}

  {#if selectedView}
    <MilestoneDetail
      view={selectedView}
      scopeLabel={scopeLabel(selectedView.milestone.scope)}
      scopeColor={scopeColor(selectedView.milestone.scope)}
      {context}
      inCurrentWeek={currentWeekTaskIds}
      busy={app.busy}
      onClose={() => (selectedId = null)}
      onEdit={editSelected}
      onDelete={deleteSelected}
      onAddTask={(taskId) => app.addTaskToCurrentWeek(taskId)}
    />
  {/if}
</div>
