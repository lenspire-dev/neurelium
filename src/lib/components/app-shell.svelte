<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { app } from '#lib/state/app.svelte.js';
  import NavLinks from './nav-links.svelte';
  import ThemeToggle from './theme-toggle.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import { LoaderCircle, LogOut, Menu, Plus, RefreshCw, X } from '@lucide/svelte';

  let { children }: { children: Snippet } = $props();
  let menuOpen = $state(false);
  let isDesktop = $state(false);
  let menuButton = $state<HTMLButtonElement | null>(null);
  let asideEl = $state<HTMLElement | null>(null);
  let addingWorkspace = $state(false);
  let workspaceName = $state('');

  onMount(() => {
    const query = window.matchMedia('(min-width: 768px)');
    isDesktop = query.matches;
    const onChange = (event: MediaQueryListEvent) => {
      isDesktop = event.matches;
      if (event.matches) menuOpen = false;
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  });

  $effect(() => {
    if (!menuOpen || isDesktop) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    asideEl?.querySelector<HTMLElement>('[data-close-menu]')?.focus();
    return () => {
      document.body.style.overflow = previous;
      menuButton?.focus();
    };
  });

  function closeMenu() {
    menuOpen = false;
  }

  function trapFocus(event: KeyboardEvent) {
    if (!menuOpen || isDesktop || event.key !== 'Tab' || asideEl === null) return;
    const nodes = asideEl.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function switchWorkspace(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    await app.selectWorkspace(value);
    closeMenu();
  }

  async function addWorkspace(event: SubmitEvent) {
    event.preventDefault();
    await app.createWorkspace(workspaceName);
    workspaceName = '';
    addingWorkspace = false;
    closeMenu();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') closeMenu();
    else if (event.key === 'Tab') trapFocus(event);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="min-h-dvh bg-background md:flex">
  <header
    class="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b bg-background/90 px-3 py-2 backdrop-blur md:hidden"
    style="padding-top: calc(0.5rem + env(safe-area-inset-top))"
  >
    <Button
      bind:ref={menuButton}
      variant="ghost"
      size="icon"
      class="size-11"
      aria-label="Open navigation"
      aria-expanded={menuOpen}
      aria-controls="app-sidebar"
      onclick={() => (menuOpen = true)}
    >
      <Menu class="size-5" />
    </Button>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-semibold">{app.workspace?.name ?? 'Neurelium'}</p>
    </div>
    {#if app.busy}
      <LoaderCircle class="size-4 animate-spin text-muted-foreground" aria-label="Updating" />
    {/if}
  </header>

  {#if menuOpen}
    <div
      class="fixed inset-0 z-40 bg-black/40 md:hidden"
      role="presentation"
      onclick={closeMenu}
    ></div>
  {/if}

  <aside
    id="app-sidebar"
    bind:this={asideEl}
    inert={!menuOpen && !isDesktop}
    class="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] flex-col overflow-y-auto border-r bg-sidebar px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-sidebar-foreground transition-transform duration-200 md:sticky md:top-0 md:z-0 md:h-dvh md:w-64 md:translate-x-0 {menuOpen
      ? 'translate-x-0'
      : '-translate-x-full'}"
    aria-label="Sidebar"
  >
    <div class="mb-5 flex items-center justify-between gap-2">
      <a href="/" class="flex items-center gap-2" onclick={closeMenu}>
        <span
          class="grid size-9 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
          aria-hidden="true">N</span
        >
        <span class="text-base font-semibold">Neurelium</span>
      </a>
      {#if app.busy}
        <LoaderCircle class="size-4 shrink-0 animate-spin text-muted-foreground" aria-label="Updating" />
      {/if}
      <Button
        data-close-menu
        variant="ghost"
        size="icon"
        class="size-11 md:hidden"
        aria-label="Close navigation"
        onclick={closeMenu}
      >
        <X class="size-5" />
      </Button>
    </div>

    <div class="mb-4 space-y-2">
      <label class="text-xs font-medium text-sidebar-foreground/70" for="workspace-select">
        Workspace
      </label>
      <select
        id="workspace-select"
        class="h-11 w-full rounded-lg border bg-background px-3 text-sm"
        value={app.workspace?.id ?? ''}
        onchange={switchWorkspace}
        disabled={app.busy}
      >
        {#each app.workspaces as workspace (workspace.id)}
          <option value={workspace.id}>{workspace.name}</option>
        {/each}
      </select>
      {#if addingWorkspace}
        <form class="flex gap-2" onsubmit={addWorkspace}>
          <Input
            bind:value={workspaceName}
            placeholder="Workspace name"
            class="h-10"
            aria-label="New workspace name"
          />
          <Button type="submit" size="icon" class="size-10" aria-label="Create workspace">
            <Plus class="size-4" />
          </Button>
        </form>
      {:else}
        <Button
          variant="ghost"
          class="h-10 w-full justify-start"
          onclick={() => (addingWorkspace = true)}
        >
          <Plus class="size-4" /> New workspace
        </Button>
      {/if}
    </div>

    <NavLinks onNavigate={closeMenu} />

    <div class="mt-auto space-y-3 pt-6">
      <div class="space-y-2">
        <p class="text-xs font-medium text-sidebar-foreground/70">Theme</p>
        <ThemeToggle />
      </div>
      {#if app.user}
        <div class="rounded-lg border bg-background p-3">
          <p class="truncate text-sm font-medium">{app.user.name ?? 'Student'}</p>
          <p class="truncate text-xs text-muted-foreground">{app.user.email}</p>
        </div>
      {/if}
      <div class="grid grid-cols-2 gap-2">
        <Button variant="outline" class="h-11" onclick={() => app.refresh()} disabled={app.busy}>
          <RefreshCw class="size-4" /> Refresh
        </Button>
        <Button variant="ghost" class="h-11" onclick={() => app.signOut()}>
          <LogOut class="size-4" /> Sign out
        </Button>
      </div>
    </div>
  </aside>

  <main class="min-w-0 flex-1 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-10">
    <div class="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 md:py-8">
      {#if app.workspaceRole === 'viewer'}
        <div
          class="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
          role="status"
        >
          You have view-only access to this workspace.
        </div>
      {/if}
      {#if app.error}
        <div
          class="mb-4 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <p>{app.error}</p>
          <button
            type="button"
            class="min-h-10 shrink-0 rounded-md px-2 text-xs font-medium underline-offset-2 hover:underline"
            onclick={() => app.clearError()}
          >
            Dismiss
          </button>
        </div>
      {/if}

      {#if app.workspace === null}
        <div class="grid min-h-[50dvh] place-items-center text-center">
          <div>
            <p class="text-sm text-muted-foreground">Preparing your workspace…</p>
            {#if app.error}
              <Button class="mt-4" onclick={() => app.refresh()}>Retry</Button>
            {/if}
          </div>
        </div>
      {:else}
        <div inert={app.workspaceRole === 'viewer'}>
          {@render children()}
        </div>
      {/if}
    </div>
  </main>
</div>
