<script lang="ts">
  import { app } from '#lib/state/app.svelte.js';
  import { askConfirm } from '#lib/state/confirm.svelte.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import { Label } from '#lib/components/ui/label/index.js';
  import Modal from '#lib/components/ui/modal.svelte';
  import EmojiPicker from '#lib/components/emoji-picker.svelte';
  import CategoryColorPicker from '#lib/components/category-color-picker.svelte';
  import WeightBadge from '#lib/components/weight-badge.svelte';
  import WeightPicker from '#lib/components/weight-picker.svelte';
  import TaskStatusBadge from '#lib/components/task-status-badge.svelte';
  import TaskFilterBar from '#lib/components/task-filter-bar.svelte';
  import {
    CATEGORY_COLOR_META,
    buildCategoryColorMap,
    hashCategoryColor,
    suggestCategoryColor
  } from '#lib/presentation/category-color.js';
  import { parseCategoryImport } from '#lib/presentation/json-import.js';
import { calculateCategoryStatus } from '#lib/domain/algorithms/category-status.js';
  import { formatDate, formatTimestamp } from '#lib/presentation/format.js';
  import { TASK_STATUS_META } from '#lib/presentation/task-status.js';
  import {
    categoryComparator,
    filterTasks,
    sortTasks,
    sortTopics,
    type CategorySortKey,
    type SortDirection,
    type TaskFilterStatus,
    type TaskFilterWeight,
    type TaskSortKey,
    type TopicSortKey
  } from '#lib/presentation/sorting.js';
  import {
    categoryChildIds,
    categoryDescendantIds,
    categoryPath,
    visibleCategoryRows
  } from '#lib/presentation/tree.js';
  import type { CategoryColor } from '#lib/domain/models/category-color.js';
import type { CategoryStatus } from '#lib/domain/models/category-status.js';
  import { DEFAULT_WEIGHT_GRADE, normalizeWeightGrade, type WeightGrade } from '#lib/domain/models/weight.js';
  import type { TaskStatus } from '#lib/domain/models/task-status.js';
  import type { Category, Task, Topic } from '#lib/domain/models/hierarchy.js';
  import { asCategoryId, asTopicId, type CategoryId } from '#lib/domain/models/identifiers.js';
  import {
    CalendarPlus,
    ChevronLeft,
    ChevronRight,
    FolderPlus,
    ListTree,
    Pencil,
    Plus,
    Trash2,
    Upload
  } from '@lucide/svelte';

  let selectedId = $state<string | null>(null);
  let mobileDetail = $state(false);
  let collapsed = $state(new Set<string>());

  let categoryDialogOpen = $state(false);
  let categoryEditing = $state<Category | null>(null);
  let categoryParentId = $state<CategoryId | null>(null);
  let categoryName = $state('');
  let categoryIcon = $state<string | null>(null);
  let categoryWeight = $state<WeightGrade>(DEFAULT_WEIGHT_GRADE);
  let categoryColor = $state<CategoryColor | null>(null);

  let topicDialogOpen = $state(false);
  let topicEditing = $state<Topic | null>(null);
  let topicCategoryId = $state<CategoryId | ''>('');
  let topicName = $state('');

  let taskDialogOpen = $state(false);
  let taskEditing = $state<Task | null>(null);
  let taskTopicId = $state<string>('');
  let taskTitle = $state('');
  let taskIcon = $state<string | null>(null);
  let taskWeight = $state<WeightGrade>(DEFAULT_WEIGHT_GRADE);
  let taskStatus = $state<TaskStatus>('todo');
  let taskDoneDate = $state('');

  let categorySort = $state<CategorySortKey>('name');
  let topicSort = $state<TopicSortKey>('name');
  let taskSort = $state<TaskSortKey>('created');
  let taskSortDirection = $state<SortDirection>('desc');
  let taskFilterStatus = $state<TaskFilterStatus>('all');
  let taskFilterWeight = $state<TaskFilterWeight>('all');
  let taskQuery = $state('');

  let importDialogOpen = $state(false);
  let importJson = $state('');
  let importError = $state<string | null>(null);

  let categoryColors = $derived(buildCategoryColorMap(app.categories));
  let childIds = $derived(categoryChildIds(app.categories));
  let rows = $derived(
    visibleCategoryRows(app.categories, collapsed, categoryComparator(categorySort, 'asc'))
  );
  let selected = $derived(
    app.categories.find((category) => category.id === selectedId) ??
      app.categories
        .filter((category) => category.parentId === null)
        .sort((a, b) => a.name.localeCompare(b.name))[0] ??
      null
  );
  let path = $derived(categoryPath(selected?.id ?? null, app.categories));
  let selectedStatus = $derived(
    selected === null
      ? null
      : calculateCategoryStatus({
          categoryId: selected.id,
          categories: app.categories,
          topics: app.topics,
          tasks: app.tasks
        })
  );
  let childCategories = $derived(
    app.categories
      .filter((category) => category.parentId === selected?.id)
      .slice()
      .sort(categoryComparator(categorySort, 'asc'))
  );
  let topics = $derived(
    sortTopics(
      app.topics.filter((topic) => topic.categoryId === selected?.id),
      topicSort
    )
  );
  let currentWeekTaskIds = $derived(
    new Set(app.entriesWithTask().map((item) => item.task.id))
  );
  let taskFilters = $derived({
    status: taskFilterStatus,
    weight: taskFilterWeight,
    query: taskQuery
  });
  let filteredTaskCount = $derived(filterTasks(app.tasks, taskFilters).length);

  function selectCategory(category: Category) {
    selectedId = category.id;
    mobileDetail = true;
  }

  function toggleCategory(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsed = next;
  }

  function openCategoryCreate(parentId: CategoryId | null) {
    categoryEditing = null;
    categoryParentId = parentId;
    categoryName = '';
    categoryIcon = null;
    categoryWeight = DEFAULT_WEIGHT_GRADE;
    categoryColor = parentId === null ? suggestCategoryColor(app.categories) : null;
    categoryDialogOpen = true;
  }

  function openCategoryEdit(category: Category) {
    categoryEditing = category;
    categoryParentId = category.parentId;
    categoryName = category.name;
    categoryIcon = category.icon;
    categoryWeight = normalizeWeightGrade(category.importanceWeight);
    categoryColor = category.color;
    categoryDialogOpen = true;
  }

  function openTopicCreate(categoryId: CategoryId | '') {
    topicEditing = null;
    topicCategoryId = categoryId;
    topicName = '';
    topicDialogOpen = true;
  }

  function openTopicEdit(topic: Topic) {
    topicEditing = topic;
    topicCategoryId = topic.categoryId;
    topicName = topic.name;
    topicDialogOpen = true;
  }

  function openTaskCreate(topicId: string) {
    taskEditing = null;
    taskTopicId = topicId;
    taskTitle = '';
    taskIcon = null;
    taskWeight = DEFAULT_WEIGHT_GRADE;
    taskStatus = 'todo';
    taskDoneDate = '';
    taskDialogOpen = true;
  }

  function openTaskEdit(task: Task) {
    taskEditing = task;
    taskTopicId = task.topicId;
    taskTitle = task.title;
    taskIcon = task.icon;
    taskWeight = normalizeWeightGrade(task.taskWeight);
    taskStatus = task.status;
    taskDoneDate = task.doneDate ?? '';
    taskDialogOpen = true;
  }

  async function saveCategory(event: SubmitEvent) {
    event.preventDefault();
    if (categoryName.trim() === '' || categoryParentId === undefined) return;
    if (categoryEditing !== null) {
      await app.updateCategory(
        categoryEditing.id,
        categoryName,
        categoryWeight,
        categoryIcon,
        categoryColor
      );
    } else {
      await app.addCategory(
        categoryParentId,
        categoryName,
        categoryWeight,
        categoryIcon,
        categoryColor
      );
    }
    if (app.error === null) categoryDialogOpen = false;
  }

  async function saveTopic(event: SubmitEvent) {
    event.preventDefault();
    if (topicName.trim() === '' || topicCategoryId === '') return;
    if (topicEditing !== null) {
      await app.updateTopic(topicEditing.id, topicName);
    } else {
      await app.addTopic(topicCategoryId, topicName);
    }
    if (app.error === null) topicDialogOpen = false;
  }

  async function saveTask(event: SubmitEvent) {
    event.preventDefault();
    if (taskTitle.trim() === '' || taskTopicId === '') return;
    const doneDate = taskStatus === 'done' ? taskDoneDate || null : null;
    if (taskEditing !== null) {
      await app.updateTask(
        taskEditing.id,
        taskTitle,
        taskWeight,
        taskIcon,
        taskStatus,
        doneDate
      );
    } else {
      await app.addTask(
        asTopicId(taskTopicId),
        taskTitle,
        taskWeight,
        taskIcon,
        taskStatus,
        doneDate
      );
    }
    if (app.error === null) taskDialogOpen = false;
  }

  function openImport() {
    importJson = '';
    importError = null;
    importDialogOpen = true;
  }

  async function readImportFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file === undefined) return;
    importJson = await file.text();
    importError = null;
  }

  async function submitImport(event: SubmitEvent) {
    event.preventDefault();
    importError = null;
    try {
      const input = parseCategoryImport(importJson);
      await app.importCategoryTree(input);
      if (app.error === null) importDialogOpen = false;
      else importError = app.error;
    } catch (error) {
      importError = error instanceof Error ? error.message : 'Could not import this JSON.';
    }
  }

  async function deleteCategory(category: Category) {
    const categoryIds = categoryDescendantIds(app.categories, category.id);
    const subcategoryCount = categoryIds.size - 1;
    const topicIds = new Set(
      app.topics.filter((topic) => categoryIds.has(topic.categoryId)).map((topic) => topic.id)
    );
    const topicCount = topicIds.size;
    const taskCount = app.tasks.filter((task) => topicIds.has(task.topicId)).length;
    const contents = [
      subcategoryCount > 0
        ? `${subcategoryCount} subcategor${subcategoryCount === 1 ? 'y' : 'ies'}`
        : '',
      topicCount > 0 ? `${topicCount} topic${topicCount === 1 ? '' : 's'}` : '',
      taskCount > 0 ? `${taskCount} task${taskCount === 1 ? '' : 's'}` : ''
    ]
      .filter((item) => item !== '')
      .join(', ');

    const hasSubcategories = subcategoryCount > 0;
    const firstCheck = await askConfirm({
      title:
        contents === ''
          ? 'Delete this category?'
          : hasSubcategories
            ? 'Delete category with its subcategories?'
            : 'Delete this category and its contents?',
      description:
        contents === ''
          ? `Delete "${category.name}"? It is empty, so nothing else will be removed.`
          : `Do you want to delete "${category.name}" ${hasSubcategories ? 'with its subcategories' : 'with everything inside it'}? This also removes ${contents}.`,
      confirmLabel: 'Delete',
      destructive: true
    });
    if (!firstCheck) return;

    const lastCheck = await askConfirm({
      title: 'Confirm deletion',
      description: `This permanently deletes "${category.name}"${contents === '' ? '' : ' and everything inside it'}. This cannot be undone.`,
      confirmLabel: 'Delete permanently',
      destructive: true
    });
    if (!lastCheck) return;

    try {
      await app.removeCategory(category.id);
      if (selectedId === category.id) selectedId = category.parentId;
      const next = new Set(collapsed);
      next.delete(category.id);
      collapsed = next;
    } catch (error) {
      app.error = error instanceof Error ? error.message : 'Could not delete category.';
    }
  }

  async function deleteTopic(topic: Topic) {
    const confirmed = await askConfirm({
      title: 'Delete topic?',
      description: `Delete "${topic.name}"? Only topics without tasks can be deleted.`,
      confirmLabel: 'Delete',
      destructive: true
    });
    if (!confirmed) return;
    try {
      await app.removeTopic(topic.id);
    } catch (error) {
      app.error = error instanceof Error ? error.message : 'Could not delete topic.';
    }
  }

  async function deleteTask(task: Task) {
    const confirmed = await askConfirm({
      title: 'Delete task?',
      description: `Delete "${task.title}"? Its completion history stays in the activity log.`,
      confirmLabel: 'Delete',
      destructive: true
    });
    if (!confirmed) return;
    await app.removeTask(task.id);
  }

  function colorMetaFor(categoryId: string) {
    const key = categoryColors.get(asCategoryId(categoryId));
    return key === undefined ? CATEGORY_COLOR_META.amber : CATEGORY_COLOR_META[key];
  }

  function taskCount(topicId: string): number {
    return app.tasksForTopic(topicId).length;
  }

  function visibleTasks(topicId: string): Task[] {
    return sortTasks(
      filterTasks(app.tasksForTopic(topicId), taskFilters),
      taskSort,
      taskSortDirection
    );
  }
</script>

<svelte:head><title>Hierarchy · Neurelium</title></svelte:head>

<div class="space-y-5">
  <header class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Hierarchy</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Organize categories and topics. Weighted tasks drive recommendations and progress.
      </p>
    </div>
    <div class="flex gap-2">
      <Button variant="outline" onclick={openImport}>
        <Upload class="size-4" /> Import JSON
      </Button>
      <Button onclick={() => openCategoryCreate(null)}>
        <Plus class="size-4" /> Category
      </Button>
    </div>
  </header>

  {#if app.categories.length === 0}
    <div class="rounded-2xl border border-dashed bg-card p-8 text-center">
      <ListTree class="mx-auto size-8 text-muted-foreground" />
      <h2 class="mt-3 text-base font-semibold">No categories yet</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Start broad, then add topics and weighted tasks.
      </p>
      <Button class="mt-4" onclick={() => openCategoryCreate(null)}>
        <Plus class="size-4" /> Add first category
      </Button>
    </div>
  {:else}
    <div class="flex flex-wrap items-center gap-1.5 rounded-xl border bg-card p-2">
      <span class="px-1 text-xs font-medium text-muted-foreground">Structure</span>
      <select
        class="h-10 rounded-lg border bg-background px-2 text-xs"
        aria-label="Sort categories"
        bind:value={categorySort}
      >
        <option value="name">Category name</option>
        <option value="created">Newest category</option>
        <option value="importance">Category weight</option>
      </select>
      <select
        class="h-10 rounded-lg border bg-background px-2 text-xs"
        aria-label="Sort topics"
        bind:value={topicSort}
      >
        <option value="name">Topic name</option>
        <option value="created">Newest topic</option>
      </select>
    </div>

    <TaskFilterBar
      bind:sort={taskSort}
      bind:direction={taskSortDirection}
      bind:status={taskFilterStatus}
      bind:weight={taskFilterWeight}
      bind:query={taskQuery}
      resultCount={filteredTaskCount}
    />

    <div class="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <section class={mobileDetail ? 'hidden lg:block' : ''} aria-label="Category tree">
        <div class="rounded-2xl border bg-card p-2">
          <div class="flex items-center justify-between px-2 py-1.5">
            <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Structure
            </h2>
            <span class="text-xs text-muted-foreground">{app.categories.length}</span>
          </div>
          <div class="space-y-0.5">
            {#each rows as row (row.category.id)}
              {@const hasChildren = childIds.has(row.category.id)}
              {@const isCollapsed = collapsed.has(row.category.id)}
              <div
                class="flex items-center gap-0.5 rounded-lg pr-1 {selected?.id === row.category.id
                  ? 'bg-muted'
                  : 'hover:bg-muted/60'}"
                style="padding-left: {row.depth * 14}px"
              >
                {#if hasChildren}
                  <button
                    type="button"
                    class="grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-background"
                    aria-label={isCollapsed ? `Expand ${row.category.name}` : `Collapse ${row.category.name}`}
                    onclick={() => toggleCategory(row.category.id)}
                  >
                    <ChevronRight class="size-4 transition-transform {isCollapsed ? '' : 'rotate-90'}" />
                  </button>
                {:else}
                  <span class="size-10 shrink-0"></span>
                {/if}
                <button
                  type="button"
                  class="flex min-h-10 min-w-0 flex-1 items-center gap-1.5 text-left"
                  onclick={() => selectCategory(row.category)}
                >
                  <span
                    class="size-2.5 shrink-0 rounded-full {colorMetaFor(row.category.id).dotClass}"
                    aria-hidden="true"
                  ></span>
                  {#if row.category.icon !== null}<span aria-hidden="true">{row.category.icon}</span>{/if}
                  <span class="truncate text-sm font-medium">{row.category.name}</span>
                </button>
                <WeightBadge value={row.category.importanceWeight} />
              </div>
            {/each}
          </div>
        </div>
      </section>

      <section class={mobileDetail ? '' : 'hidden lg:block'} aria-label="Category details">
        {#if selected}
          <div class="space-y-4">
            <div class="rounded-2xl border border-l-4 bg-card p-4 {colorMetaFor(selected.id).borderClass}">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-10 lg:hidden"
                      aria-label="Back to categories"
                      onclick={() => (mobileDetail = false)}
                    >
                      <ChevronLeft class="size-4" />
                    </Button>
                    <p class="truncate text-xs text-muted-foreground">
                      {path.map((item) => item.name).join(' / ')}
                    </p>
                  </div>
                  <div class="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      class="size-3 shrink-0 rounded-full {colorMetaFor(selected.id).dotClass}"
                      aria-hidden="true"
                    ></span>
                    {#if selected.icon !== null}<span class="text-xl" aria-hidden="true">{selected.icon}</span>{/if}
                    <h2 class="text-xl font-semibold tracking-tight">{selected.name}</h2>
                    <WeightBadge value={selected.importanceWeight} />
                  </div>
                  <p class="mt-1 text-xs text-muted-foreground">
                    {childCategories.length} subcategories · {topics.length} topics
                  </p>
                  <p class="mt-0.5 text-[11px] text-muted-foreground">
                    Created {formatTimestamp(selected.createdAt)}
                  </p>
                  {#if selectedStatus !== null}
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                      <TaskStatusBadge status={selectedStatus.status} />
                      <span class="text-xs text-muted-foreground">
                        {selectedStatus.completionPercentage}% · {selectedStatus.completedTasks}/{selectedStatus.totalTasks}
                        done
                      </span>
                      {#if selectedStatus.overridden}
                        <span class="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          Manual
                        </span>
                      {/if}
                      <select
                        class="h-9 rounded-md border bg-background px-2 text-xs"
                        aria-label="Category status for {selected.name}"
                        value={selected.statusOverride ?? 'auto'}
                        disabled={app.busy}
                        onchange={(event) =>
                          app.setCategoryStatusOverride(
                            selected!.id,
                            (event.currentTarget as HTMLSelectElement).value === 'auto'
                              ? null
                              : ((event.currentTarget as HTMLSelectElement)
                                  .value as CategoryStatus)
                          )}
                      >
                        <option value="auto">Automatic</option>
                        {#each TASK_STATUS_META.filter((meta) => meta.value !== 'skipped') as meta (meta.value)}
                          <option value={meta.value}>{meta.label}</option>
                        {/each}
                      </select>
                    </div>
                  {/if}
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" onclick={() => openCategoryEdit(selected!)}>
                    <Pencil class="size-4" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={app.busy}
                    onclick={() => app.addCategoryToCurrentWeek(selected!.id)}
                  >
                    <CalendarPlus class="size-4" /> Add to week
                  </Button>
                  <Button variant="outline" size="sm" onclick={() => openCategoryCreate(selected!.id)}>
                    <FolderPlus class="size-4" /> Subcategory
                  </Button>
                  <Button size="sm" onclick={() => openTopicCreate(selected!.id)}>
                    <Plus class="size-4" /> Topic
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-9 text-muted-foreground hover:text-destructive"
                    aria-label="Delete category {selected.name}"
                    onclick={() => deleteCategory(selected!)}
                  >
                    <Trash2 class="size-4" />
                  </Button>
                </div>
              </div>

              {#if childCategories.length > 0}
                <div class="mt-4 border-t pt-3">
                  <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Subcategories
                  </p>
                  <div class="mt-2 flex flex-wrap gap-1.5">
                    {#each childCategories as child (child.id)}
                      <button
                        type="button"
                        class="inline-flex min-h-10 items-center gap-1 rounded-lg border bg-background px-2.5 text-sm hover:bg-muted"
                        onclick={() => selectCategory(child)}
                      >
                        <span
                          class="size-2 shrink-0 rounded-full {colorMetaFor(child.id).dotClass}"
                          aria-hidden="true"
                        ></span>
                        {#if child.icon !== null}<span aria-hidden="true">{child.icon}</span>{/if}
                        {child.name}
                        <ChevronRight class="size-3.5 text-muted-foreground" />
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>

            {#if topics.length > 0}
              <div class="space-y-3">
                {#each topics as topic (topic.id)}
                  <div class="rounded-2xl border bg-card p-3">
                    <div class="flex items-center justify-between gap-2">
                      <div class="min-w-0">
                        <div class="flex min-w-0 items-center gap-1.5">
                          <span
                            class="size-2.5 shrink-0 rounded-full {colorMetaFor(selected.id).dotClass}"
                            aria-hidden="true"
                          ></span>
                          <h3 class="truncate text-sm font-semibold">{topic.name}</h3>
                        </div>
                        <p class="text-xs text-muted-foreground">
                          {taskCount(topic.id)} {taskCount(topic.id) === 1 ? 'task' : 'tasks'} ·
                          Created {formatTimestamp(topic.createdAt)}
                        </p>
                      </div>
                      <div class="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          class="size-10"
                          aria-label="Edit topic {topic.name}"
                          onclick={() => openTopicEdit(topic)}
                        >
                          <Pencil class="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          class="size-10 text-muted-foreground hover:text-destructive"
                          aria-label="Delete topic {topic.name}"
                          onclick={() => deleteTopic(topic)}
                        >
                          <Trash2 class="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    {#if visibleTasks(topic.id).length > 0}
                      <ul class="mt-2 space-y-1">
                        {#each visibleTasks(topic.id) as task (task.id)}
                          <li class="flex min-h-12 items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5">
                            <span class="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
                              <span
                                class="size-2 shrink-0 rounded-full {colorMetaFor(topic.categoryId).dotClass}"
                                aria-hidden="true"
                              ></span>
                              {#if task.icon !== null}<span aria-hidden="true">{task.icon}</span>{/if}
                              <span class="min-w-0">
                                <span class="block truncate">{task.title}</span>
                                <span class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <TaskStatusBadge status={task.status} />
                                  <span>Created {formatTimestamp(task.createdAt)}</span>
                                  {#if task.doneDate !== null}<span>Done {formatDate(task.doneDate)}</span>{/if}
                                </span>
                              </span>
                            </span>
                            <WeightBadge value={task.taskWeight} />
                            {#if !currentWeekTaskIds.has(task.id)}
                              <Button
                                variant="ghost"
                                size="icon"
                                class="size-10"
                                aria-label="Add {task.title} to this week"
                                title="Add to this week"
                                disabled={app.busy}
                                onclick={() => app.addTaskToCurrentWeek(task.id)}
                              >
                                <CalendarPlus class="size-3.5" />
                              </Button>
                            {/if}
                            <Button
                              variant="ghost"
                              size="icon"
                              class="size-10"
                              aria-label="Edit task {task.title}"
                              onclick={() => openTaskEdit(task)}
                            >
                              <Pencil class="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              class="size-10 text-muted-foreground hover:text-destructive"
                              aria-label="Delete task {task.title}"
                              onclick={() => deleteTask(task)}
                            >
                              <Trash2 class="size-3.5" />
                            </Button>
                          </li>
                        {/each}
                      </ul>
                    {:else}
                      <p class="mt-2 text-xs text-muted-foreground">
                        {taskCount(topic.id) === 0 ? 'No tasks yet.' : 'No tasks match the filters.'}
                      </p>
                    {/if}

                    <Button
                      variant="ghost"
                      size="sm"
                      class="mt-2 w-full justify-start text-muted-foreground"
                      onclick={() => openTaskCreate(topic.id)}
                    >
                      <Plus class="size-4" /> Add task
                    </Button>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="rounded-2xl border border-dashed bg-card p-6 text-center">
                <p class="text-sm text-muted-foreground">No topics in this category.</p>
                <Button class="mt-3" size="sm" onclick={() => openTopicCreate(selected!.id)}>
                  <Plus class="size-4" /> Add topic
                </Button>
              </div>
            {/if}
          </div>
        {:else}
          <p class="text-sm text-muted-foreground">Select a category.</p>
        {/if}
      </section>
    </div>
  {/if}
</div>

<Modal
  bind:open={importDialogOpen}
  title="Import category tree"
  description="Create a category with nested subcategories, topics, and tasks from JSON."
>
  <form class="space-y-4" onsubmit={submitImport}>
    <div class="space-y-2">
      <Label for="import-file">JSON file</Label>
      <Input
        id="import-file"
        type="file"
        accept=".json,application/json"
        onchange={readImportFile}
      />
    </div>
    <div class="space-y-2">
      <Label for="import-json">Or paste JSON</Label>
      <textarea
        id="import-json"
        bind:value={importJson}
        rows="12"
        spellcheck="false"
        class="w-full resize-y rounded-lg border bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        placeholder={`{
  "name": "Mathematics",
  "icon": "📐",
  "weight": 3,
  "subcategories": [
    {
      "name": "Algebra",
      "icon": "🧮",
      "topics": [
        {
          "name": "Equations",
          "tasks": [{ "title": "Solve exercises", "icon": "✏️", "weight": 2 }]
        }
      ]
    }
  ]
}`}
      ></textarea>
      <p class="text-xs text-muted-foreground">
        Icons are optional emoji. Weights use grades 1–5 and default to 2 when omitted. Tasks belong inside topics.
      </p>
    </div>
    {#if importError !== null}
      <p class="text-sm text-destructive" role="alert">{importError}</p>
    {/if}
    <div class="flex justify-end gap-2">
      <Button type="button" variant="outline" onclick={() => (importDialogOpen = false)}>
        Cancel
      </Button>
      <Button type="submit" disabled={app.busy || importJson.trim() === ''}>Import</Button>
    </div>
  </form>
</Modal>

<Modal
  bind:open={categoryDialogOpen}
  title={categoryEditing ? 'Edit category' : categoryParentId ? 'Add subcategory' : 'Add category'}
  description={categoryEditing
    ? 'Update the category name and importance.'
    : categoryParentId
      ? 'Create a nested category under the selected category.'
      : 'Create a top-level category.'}
>
  <form class="space-y-4" onsubmit={saveCategory}>
    <div class="space-y-2">
      <Label for="category-name">Name</Label>
      <Input id="category-name" bind:value={categoryName} placeholder="Mathematics" autofocus />
    </div>
    <EmojiPicker bind:value={categoryIcon} label="Category icon" />
    <CategoryColorPicker
      bind:value={categoryColor}
      hasParent={categoryParentId !== null}
      parentColor={categoryParentId === null
        ? null
        : (categoryColors.get(categoryParentId) ?? null)}
      autoColor={categoryParentId === null && categoryEditing !== null
        ? hashCategoryColor(categoryEditing.id)
        : null}
    />
    <WeightPicker bind:value={categoryWeight} label="Importance" />
    <div class="flex justify-end gap-2">
      <Button type="button" variant="outline" onclick={() => (categoryDialogOpen = false)}>
        Cancel
      </Button>
      <Button type="submit" disabled={app.busy}>Save</Button>
    </div>
  </form>
</Modal>

<Modal
  bind:open={topicDialogOpen}
  title={topicEditing ? 'Edit topic' : 'Add topic'}
  description={topicEditing
    ? 'Update the topic name.'
    : 'Topics group tasks inside the selected category.'}
>
  <form class="space-y-4" onsubmit={saveTopic}>
    <div class="space-y-2">
      <Label for="topic-name">Name</Label>
      <Input id="topic-name" bind:value={topicName} placeholder="Algebra" autofocus />
    </div>
    <div class="flex justify-end gap-2">
      <Button type="button" variant="outline" onclick={() => (topicDialogOpen = false)}>
        Cancel
      </Button>
      <Button type="submit" disabled={app.busy}>Save</Button>
    </div>
  </form>
</Modal>

<Modal
  bind:open={taskDialogOpen}
  title={taskEditing ? 'Edit task' : 'Add task'}
  description="Task weight controls its share of progress. Add it to the current week from its task row."
>
  <form class="space-y-4" onsubmit={saveTask}>
    <div class="space-y-2">
      <Label for="task-title">Title</Label>
      <Input id="task-title" bind:value={taskTitle} placeholder="Solve quadratic equations" autofocus />
    </div>
    <EmojiPicker bind:value={taskIcon} label="Task icon" />
    <WeightPicker bind:value={taskWeight} label="Task weight" />
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-2">
        <Label for="task-status">Status</Label>
        <select
          id="task-status"
          class="h-10 w-full rounded-lg border bg-background px-3 text-sm"
          bind:value={taskStatus}
        >
          {#each TASK_STATUS_META as meta (meta.value)}
            <option value={meta.value}>{meta.label}</option>
          {/each}
        </select>
      </div>
      <div class="space-y-2">
        <Label for="task-done-date">Done date</Label>
        <Input
          id="task-done-date"
          type="date"
          bind:value={taskDoneDate}
          disabled={taskStatus !== 'done'}
        />
      </div>
    </div>
    {#if taskEditing !== null}
      <p class="text-xs text-muted-foreground">
        Created {formatTimestamp(taskEditing.createdAt)} · Updated {formatTimestamp(taskEditing.updatedAt)}
      </p>
    {/if}
    <div class="flex justify-end gap-2">
      <Button type="button" variant="outline" onclick={() => (taskDialogOpen = false)}>
        Cancel
      </Button>
      <Button type="submit" disabled={app.busy}>Save</Button>
    </div>
  </form>
</Modal>
