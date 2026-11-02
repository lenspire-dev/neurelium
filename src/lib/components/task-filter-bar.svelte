<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import { TASK_STATUS_META } from '#lib/presentation/task-status.js';
  import type {
    SortDirection,
    TaskFilterStatus,
    TaskFilterWeight,
    TaskSortKey
  } from '#lib/presentation/sorting.js';
  import { cn } from '#lib/utils.js';
  import { ArrowDown, ArrowUp, Search, SlidersHorizontal, X } from '@lucide/svelte';

  let {
    sort = $bindable<TaskSortKey>('created'),
    direction = $bindable<SortDirection>('desc'),
    status = $bindable<TaskFilterStatus>('all'),
    weight = $bindable<TaskFilterWeight>('all'),
    query = $bindable(''),
    resultCount = null
  }: {
    sort?: TaskSortKey;
    direction?: SortDirection;
    status?: TaskFilterStatus;
    weight?: TaskFilterWeight;
    query?: string;
    resultCount?: number | null;
  } = $props();

  const WEIGHTS = [1, 2, 3, 4, 5] as const;

  let filtersOpen = $state(false);
  let activeFilters = $derived((status === 'all' ? 0 : 1) + (weight === 'all' ? 0 : 1));
  let hasFilters = $derived(activeFilters > 0 || query.trim() !== '');

  function defaultDirection(key: TaskSortKey): SortDirection {
    return key === 'title' || key === 'status' ? 'asc' : 'desc';
  }

  function changeSort(event: Event) {
    sort = (event.currentTarget as HTMLSelectElement).value as TaskSortKey;
    direction = defaultDirection(sort);
  }

  function clearFilters() {
    status = 'all';
    weight = 'all';
    query = '';
  }
</script>

<div class="rounded-xl border bg-card p-2">
  <div class="flex flex-wrap items-center gap-1.5">
    <div class="relative min-w-0 flex-1 sm:max-w-xs">
      <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        class="h-10 pl-9"
        aria-label="Search tasks"
        placeholder="Search tasks"
        bind:value={query}
      />
    </div>

    <div class="flex items-center gap-1">
      <select
        class="h-10 rounded-lg border bg-background px-2 text-xs"
        aria-label="Sort tasks"
        value={sort}
        onchange={changeSort}
      >
        <option value="created">Created</option>
        <option value="updated">Updated</option>
        <option value="title">Title</option>
        <option value="weight">Weight</option>
        <option value="status">Status</option>
        <option value="done">Done date</option>
      </select>
      <Button
        variant="outline"
        size="icon"
        class="size-10"
        aria-label={direction === 'asc' ? 'Sort ascending' : 'Sort descending'}
        title={direction === 'asc' ? 'Ascending' : 'Descending'}
        onclick={() => (direction = direction === 'asc' ? 'desc' : 'asc')}
      >
        {#if direction === 'asc'}
          <ArrowUp class="size-4" />
        {:else}
          <ArrowDown class="size-4" />
        {/if}
      </Button>
    </div>

    <Button
      variant={filtersOpen || activeFilters > 0 ? 'secondary' : 'outline'}
      class="h-10 gap-2"
      aria-expanded={filtersOpen}
      onclick={() => (filtersOpen = !filtersOpen)}
    >
      <SlidersHorizontal class="size-4" />
      Filters
      {#if activeFilters > 0}
        <span class="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
          {activeFilters}
        </span>
      {/if}
    </Button>

    {#if hasFilters}
      <Button variant="ghost" class="h-10 gap-1 px-2 text-xs" onclick={clearFilters}>
        <X class="size-4" /> Clear
      </Button>
    {/if}

    {#if resultCount !== null}
      <span class="ml-auto px-1 text-xs text-muted-foreground">{resultCount} shown</span>
    {/if}
  </div>

  {#if filtersOpen}
    <div class="mt-2 grid gap-3 border-t pt-3 sm:grid-cols-2">
      <fieldset>
        <legend class="px-1 text-xs font-medium text-muted-foreground">Status</legend>
        <div class="mt-1.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            class={cn(
              'h-9 rounded-full border px-3 text-xs font-medium',
              status === 'all' ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
            )}
            aria-pressed={status === 'all'}
            onclick={() => (status = 'all')}
          >
            All
          </button>
          {#each TASK_STATUS_META as meta (meta.value)}
            <button
              type="button"
              class={cn(
                'h-9 rounded-full border px-3 text-xs font-medium',
                status === meta.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted'
              )}
              aria-pressed={status === meta.value}
              onclick={() => (status = meta.value)}
            >
              {meta.label}
            </button>
          {/each}
        </div>
      </fieldset>

      <fieldset>
        <legend class="px-1 text-xs font-medium text-muted-foreground">Weight</legend>
        <div class="mt-1.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            class={cn(
              'h-9 rounded-full border px-3 text-xs font-medium',
              weight === 'all' ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
            )}
            aria-pressed={weight === 'all'}
            onclick={() => (weight = 'all')}
          >
            All
          </button>
          {#each WEIGHTS as value (value)}
            <button
              type="button"
              class={cn(
                'h-9 rounded-full border px-3 text-xs font-medium',
                weight === value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted'
              )}
              aria-pressed={weight === value}
              onclick={() => (weight = value)}
            >
              {value}
            </button>
          {/each}
        </div>
      </fieldset>
    </div>
  {/if}
</div>
