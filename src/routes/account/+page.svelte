<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '#lib/state/app.svelte.js';
  import { askConfirm } from '#lib/state/confirm.svelte.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import { Label } from '#lib/components/ui/label/index.js';
  import {
    planDetails,
    planName,
    PLAN_LIMITS,
    resolvePlan
  } from '#lib/presentation/plan.js';
  import { BadgeCheck, KeyRound, LogOut, Mail, UserRound } from '@lucide/svelte';

  let labels = $derived(app.user?.labels ?? []);
  let plan = $derived(app.plan?.name ?? planName(labels));
  let details = $derived(
    planDetails(app.plan?.limits ?? PLAN_LIMITS[resolvePlan(labels)])
  );
  let expiresAt = $derived(
    app.plan?.expiresAt ? new Date(app.plan.expiresAt).toLocaleDateString() : null
  );

  onMount(() => {
    void app.loadPlan();
  });
  let name = $state(app.user?.name ?? '');
  let email = $state(app.user?.email ?? '');
  let emailPassword = $state('');

  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');

  let success = $state<string | null>(null);
  let localError = $state<string | null>(null);

  function resetMessages() {
    success = null;
    localError = null;
  }

  async function saveName(event: SubmitEvent) {
    event.preventDefault();
    resetMessages();
    if (name.trim() === '') {
      localError = 'Name is required.';
      return;
    }
    await app.updateName(name);
    if (app.error === null) {
      name = app.user?.name ?? name.trim();
      success = 'Name updated.';
    }
  }

  async function saveEmail(event: SubmitEvent) {
    event.preventDefault();
    resetMessages();
    if (!email.includes('@')) {
      localError = 'Enter a valid email address.';
      return;
    }
    if (emailPassword === '') {
      localError = 'Enter your current password to change your email.';
      return;
    }
    await app.updateEmail(email, emailPassword);
    if (app.error === null) {
      email = app.user?.email ?? email.trim();
      emailPassword = '';
      success = 'Email updated.';
    }
  }

  async function savePassword(event: SubmitEvent) {
    event.preventDefault();
    resetMessages();
    if (newPassword.length < 8) {
      localError = 'New password must be at least 8 characters.';
      return;
    }
    if (newPassword !== confirmPassword) {
      localError = 'New passwords do not match.';
      return;
    }
    if (currentPassword === '') {
      localError = 'Enter your current password.';
      return;
    }
    await app.updatePassword(newPassword, currentPassword);
    if (app.error === null) {
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      success = 'Password updated.';
    }
  }

  async function signOutEverywhere() {
    const confirmed = await askConfirm({
      title: 'Sign out everywhere?',
      description: 'This ends every active session, including this one.',
      confirmLabel: 'Sign out everywhere',
      destructive: true
    });
    if (confirmed) await app.signOutEverywhere();
  }
</script>

<svelte:head><title>Account · Neurelium</title></svelte:head>

<div class="mx-auto max-w-2xl space-y-5">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">Account</h1>
    <p class="mt-1 text-sm text-muted-foreground">Manage your sign-in details and sessions.</p>
  </header>

  {#if localError}
    <p class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
      {localError}
    </p>
  {/if}
  {#if success}
    <p class="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary" role="status">
      {success}
    </p>
  {/if}

  <section class="rounded-2xl border bg-card p-4 sm:p-5">
    <div class="flex items-center gap-3">
      <span class="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <BadgeCheck class="size-5" />
      </span>
      <div>
        <h2 class="text-sm font-semibold">Plan</h2>
        <p class="text-xs text-muted-foreground">
          {#if expiresAt}
            Active until {expiresAt}
          {:else if app.plan?.source === 'subscription'}
            No active subscription.
          {:else}
            Assigned by Neurelium.
          {/if}
        </p>
      </div>
      <span class="ml-auto rounded-full border bg-muted px-3 py-1 text-sm font-medium">
        {plan}
      </span>
    </div>
    <dl class="mt-4 grid gap-x-4 gap-y-2 border-t pt-4 text-sm sm:grid-cols-2">
      {#each details as detail}
        <div class="flex items-baseline justify-between gap-3">
          <dt class="text-muted-foreground">{detail.label}</dt>
          <dd class="font-medium tabular-nums">{detail.value}</dd>
        </div>
      {/each}
    </dl>
  </section>

  <section class="rounded-2xl border bg-card p-4 sm:p-5">
    <div class="flex items-center gap-3">
      <span class="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <UserRound class="size-5" />
      </span>
      <div>
        <h2 class="text-sm font-semibold">Profile</h2>
        <p class="text-xs text-muted-foreground">Your display name.</p>
      </div>
    </div>
    <form class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onsubmit={saveName}>
      <div class="min-w-0 flex-1 space-y-2">
        <Label for="account-name">Name</Label>
        <Input id="account-name" bind:value={name} autocomplete="name" placeholder="Your name" />
      </div>
      <Button type="submit" disabled={app.busy}>Save name</Button>
    </form>
  </section>

  <section class="rounded-2xl border bg-card p-4 sm:p-5">
    <div class="flex items-center gap-3">
      <span class="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <Mail class="size-5" />
      </span>
      <div>
        <h2 class="text-sm font-semibold">Email</h2>
        <p class="text-xs text-muted-foreground">Changing your email requires your current password.</p>
      </div>
    </div>
    <form class="mt-4 space-y-3" onsubmit={saveEmail}>
      <div class="space-y-2">
        <Label for="account-email">Email</Label>
        <Input
          id="account-email"
          type="email"
          bind:value={email}
          autocomplete="email"
          placeholder="you@example.com"
        />
      </div>
      <div class="space-y-2">
        <Label for="account-email-password">Current password</Label>
        <Input
          id="account-email-password"
          type="password"
          bind:value={emailPassword}
          autocomplete="current-password"
        />
      </div>
      <Button type="submit" disabled={app.busy}>Save email</Button>
    </form>
  </section>

  <section class="rounded-2xl border bg-card p-4 sm:p-5">
    <div class="flex items-center gap-3">
      <span class="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <KeyRound class="size-5" />
      </span>
      <div>
        <h2 class="text-sm font-semibold">Password</h2>
        <p class="text-xs text-muted-foreground">Use at least 8 characters.</p>
      </div>
    </div>
    <form class="mt-4 space-y-3" onsubmit={savePassword}>
      <div class="space-y-2">
        <Label for="account-current-password">Current password</Label>
        <Input
          id="account-current-password"
          type="password"
          bind:value={currentPassword}
          autocomplete="current-password"
        />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="space-y-2">
          <Label for="account-new-password">New password</Label>
          <Input
            id="account-new-password"
            type="password"
            bind:value={newPassword}
            autocomplete="new-password"
          />
        </div>
        <div class="space-y-2">
          <Label for="account-confirm-password">Confirm new password</Label>
          <Input
            id="account-confirm-password"
            type="password"
            bind:value={confirmPassword}
            autocomplete="new-password"
          />
        </div>
      </div>
      <Button type="submit" disabled={app.busy}>Update password</Button>
    </form>
  </section>

  <section class="rounded-2xl border bg-card p-4 sm:p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="grid size-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
          <LogOut class="size-5" />
        </span>
        <div>
          <h2 class="text-sm font-semibold">Sessions</h2>
          <p class="text-xs text-muted-foreground">End every signed-in device.</p>
        </div>
      </div>
      <Button variant="outline" onclick={signOutEverywhere} disabled={app.busy}>
        Sign out everywhere
      </Button>
    </div>
  </section>
</div>
