<script lang="ts">
  import './layout.css';
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import { app } from '#lib/state/app.svelte.js';
  import { theme } from '#lib/state/theme.svelte.js';
  import LoginScreen from '#lib/components/login-screen.svelte';
  import AppShell from '#lib/components/app-shell.svelte';
  import ConfirmDialog from '#lib/components/confirm-dialog.svelte';
  import { LoaderCircle } from '@lucide/svelte';

  let { children }: { children: Snippet } = $props();

  onMount(() => {
    theme.init();
    void app.init();

    let lastSync = Date.now();
    const sync = () => {
      if (document.visibilityState !== 'visible' || app.session !== 'signed-in') return;
      if (app.busy || Date.now() - lastSync < 30_000) return;
      lastSync = Date.now();
      void app.refresh();
    };
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  });
</script>

<svelte:head>
  <title>Neurelium</title>
</svelte:head>

{#if app.session === 'loading'}
  <div class="grid min-h-dvh place-items-center">
    <LoaderCircle class="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
  </div>
{:else if app.session === 'signed-out'}
  <LoginScreen />
{:else}
  <AppShell>
    {@render children()}
  </AppShell>
{/if}

<ConfirmDialog />
