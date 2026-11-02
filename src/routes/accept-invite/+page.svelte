<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '#lib/state/app.svelte.js';
  import { Button } from '#lib/components/ui/button/index.js';

  let status = $state<'working' | 'done' | 'error'>('working');
  let message = $state('Joining workspace…');

  onMount(async () => {
    const params = new URL(window.location.href).searchParams;
    const input = {
      workspaceId: params.get('teamId') ?? '',
      membershipId: params.get('membershipId') ?? '',
      userId: params.get('userId') ?? '',
      secret: params.get('secret') ?? ''
    };
    if (Object.values(input).some((value) => value === '')) {
      status = 'error';
      message = 'This invitation link is incomplete. Ask the owner to invite you again.';
      return;
    }

    try {
      await app.acceptInvitation(input);
      status = 'done';
      message = 'You joined the workspace.';
      window.history.replaceState({}, '', '/accept-invite');
    } catch (error) {
      status = 'error';
      message = error instanceof Error ? error.message : 'Could not accept the invitation.';
    }
  });
</script>

<svelte:head><title>Join workspace · Neurelium</title></svelte:head>

<div class="mx-auto max-w-md py-16 text-center">
  <h1 class="text-2xl font-semibold tracking-tight">Workspace invitation</h1>
  <p class="mt-3 text-sm text-muted-foreground">{message}</p>
  {#if status === 'working'}
    <p class="mt-6 text-sm">Please wait…</p>
  {:else}
    <Button class="mt-6" href="/">Go to workspace</Button>
  {/if}
</div>
