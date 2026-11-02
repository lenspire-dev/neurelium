<script lang="ts">
  import { app } from '#lib/state/app.svelte.js';
  import { askConfirm } from '#lib/state/confirm.svelte.js';
  import { theme } from '#lib/state/theme.svelte.js';
  import ThemeToggle from '#lib/components/theme-toggle.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { ChevronRight, RotateCcw, Settings, UserRound } from '@lucide/svelte';

  async function resetPreferences() {
    const confirmed = await askConfirm({
      title: 'Reset local preferences?',
      description: 'This resets the theme and active workspace on this device.',
      confirmLabel: 'Reset',
      destructive: true
    });
    if (!confirmed) return;
    theme.setMode('system');
    try {
      localStorage.removeItem('neurelium-active-workspace');
    } catch {
      /* storage can be unavailable in private mode */
    }
    if (app.workspaces[0] !== undefined) await app.selectWorkspace(app.workspaces[0].id);
  }
</script>

<svelte:head><title>Settings · Neurelium</title></svelte:head>

<div class="mx-auto max-w-2xl space-y-5">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
    <p class="mt-1 text-sm text-muted-foreground">Appearance and workspace preferences.</p>
  </header>

  <section class="rounded-2xl border bg-card p-4 sm:p-5">
    <div class="flex items-center gap-3">
      <span class="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <Settings class="size-5" />
      </span>
      <div>
        <h2 class="text-sm font-semibold">Appearance</h2>
        <p class="text-xs text-muted-foreground">Choose light, dark, or follow your system.</p>
      </div>
    </div>
    <div class="mt-4 max-w-sm">
      <ThemeToggle />
    </div>
  </section>

  <section class="rounded-2xl border bg-card p-4 sm:p-5">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold">Workspace</h2>
        <p class="mt-1 text-xs text-muted-foreground">
          {app.workspace?.name ?? 'No workspace selected'}
        </p>
      </div>
      <a
        href="/account"
        class="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-muted"
      >
        <UserRound class="size-4" /> Account
        <ChevronRight class="size-4" />
      </a>
    </div>
    <p class="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
      Member roles, invitations, week start, and workspace defaults will appear here.
    </p>
  </section>

  <section class="rounded-2xl border bg-card p-4 sm:p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold">Local preferences</h2>
        <p class="mt-1 text-xs text-muted-foreground">Stored only on this device.</p>
      </div>
      <Button variant="outline" onclick={resetPreferences}>
        <RotateCcw class="size-4" /> Reset
      </Button>
    </div>
  </section>
</div>
