<script lang="ts">
  import { app } from '#lib/state/app.svelte.js';
  import { askConfirm } from '#lib/state/confirm.svelte.js';
  import { theme } from '#lib/state/theme.svelte.js';
  import ThemeToggle from '#lib/components/theme-toggle.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import { Label } from '#lib/components/ui/label/index.js';
  import {
    ChevronRight,
    RotateCcw,
    Settings,
    UserRound,
    UserPlus,
    Users
  } from '@lucide/svelte';
  import type { WorkspaceDefaultView } from '#lib/domain/models/workspace.js';
  import type { CategoryOverrideMode } from '#lib/domain/models/category-status.js';
  import type { WorkspaceRole } from '#lib/domain/models/workspace-member.js';

  let loadedWorkspaceId = $state<string | null>(null);
  let workspaceName = $state('');
  let defaultView = $state<WorkspaceDefaultView>('day');
  let categoryOverrideMode = $state<CategoryOverrideMode>('any');
  let membersLoadedFor = $state<string | null>(null);
  let inviteEmail = $state('');
  let inviteRole = $state<Exclude<WorkspaceRole, 'owner'>>('member');

  $effect(() => {
    const workspace = app.workspace;
    if (workspace === null || workspace.id === loadedWorkspaceId) return;
    loadedWorkspaceId = workspace.id;
    workspaceName = workspace.name;
    defaultView = workspace.defaultView ?? 'day';
    categoryOverrideMode = workspace.categoryOverrideMode ?? 'any';
  });

  $effect(() => {
    const workspace = app.workspace;
    if (workspace === null || workspace.id === membersLoadedFor) return;
    membersLoadedFor = workspace.id;
    void app.loadMembers();
  });

  async function saveWorkspace() {
    await app.updateWorkspaceSettings({
      name: workspaceName,
      defaultView,
      categoryOverrideMode
    });
  }

  async function invite() {
    if (inviteEmail.trim() === '') return;
    await app.inviteMember(inviteEmail, inviteRole);
    inviteEmail = '';
  }

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

  const selectClass =
    'h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring';
</script>

<svelte:head><title>Settings · Neurelium</title></svelte:head>

<div class="mx-auto max-w-2xl space-y-5">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
    <p class="mt-1 text-sm text-muted-foreground">Workspace, members, and appearance.</p>
  </header>

  <section class="rounded-2xl border bg-card p-4 sm:p-5">
    <div class="flex items-center gap-3">
      <span class="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <Settings class="size-5" />
      </span>
      <div>
        <h2 class="text-sm font-semibold">Workspace</h2>
        <p class="text-xs text-muted-foreground">
          {app.workspace?.name ?? 'No workspace selected'}
        </p>
      </div>
    </div>

    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      <div class="sm:col-span-2">
        <Label for="workspace-name">Name</Label>
        <Input id="workspace-name" bind:value={workspaceName} maxlength={80} />
      </div>
      <div>
        <Label for="default-view">Default view</Label>
        <select id="default-view" class={selectClass} bind:value={defaultView}>
          <option value="day">Today</option>
          <option value="week">Week</option>
        </select>
      </div>
      <div class="sm:col-span-2">
        <p class="text-xs text-muted-foreground">Weeks start on Monday.</p>
      </div>
      <div class="sm:col-span-2">
        <Label for="override-mode">Category status overrides</Label>
        <select
          id="override-mode"
          class={selectClass}
          bind:value={categoryOverrideMode}
        >
          <option value="any">Allow any manual status</option>
          <option value="done_only">Only allow manual “Done”</option>
        </select>
      </div>
    </div>

    <div class="mt-4 flex items-center justify-end gap-3">
      {#if app.workspaceRole !== 'owner'}
        <p class="text-xs text-muted-foreground">Only the owner can edit workspace settings.</p>
      {/if}
      <Button
        onclick={saveWorkspace}
        disabled={app.busy || app.workspace === null || app.workspaceRole !== 'owner'}
      >
        Save workspace
      </Button>
    </div>
  </section>

  <section class="rounded-2xl border bg-card p-4 sm:p-5">
    <div class="flex items-center gap-3">
      <span class="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <Users class="size-5" />
      </span>
      <div>
        <h2 class="text-sm font-semibold">Members</h2>
        <p class="text-xs text-muted-foreground">
          Share this workspace. The owner can invite and change roles.
        </p>
      </div>
    </div>

    <div class="mt-4 space-y-2">
      {#if app.membersLoading && app.members.length === 0}
        <p class="text-sm text-muted-foreground">Loading members…</p>
      {:else if app.members.length === 0}
        <p class="text-sm text-muted-foreground">No members loaded.</p>
      {:else}
        {#each app.members as member (member.membershipId)}
          <div
            class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">
                {member.name}
                {#if member.userId === app.user?.id}
                  <span class="text-muted-foreground">(you)</span>
                {/if}
              </p>
              <p class="truncate text-xs text-muted-foreground">
                {member.email}
                {#if member.invited} · Invitation pending{/if}
              </p>
            </div>
            <div class="flex items-center gap-2">
              {#if app.workspaceRole === 'owner' && member.role !== 'owner'}
                <select
                  class={selectClass + ' h-9 w-32'}
                  value={member.role}
                  onchange={(event) =>
                    app.updateMemberRole(
                      member.membershipId,
                      (event.currentTarget as HTMLSelectElement).value as Exclude<
                        WorkspaceRole,
                        'owner'
                      >
                    )}
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onclick={() => app.removeMember(member.membershipId)}
                >
                  Remove
                </Button>
              {:else}
                <span class="text-xs font-medium capitalize">{member.role}</span>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>

    {#if app.workspaceRole === 'owner'}
      <div class="mt-4 grid gap-3 rounded-xl bg-muted/50 p-3 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <Label for="invite-email">Invite by email</Label>
          <Input
            id="invite-email"
            type="email"
            bind:value={inviteEmail}
            placeholder="teammate@example.com"
          />
        </div>
        <div>
          <Label for="invite-role">Role</Label>
          <select id="invite-role" class={selectClass} bind:value={inviteRole}>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <div class="flex items-end">
          <Button onclick={invite} disabled={app.busy || inviteEmail.trim() === ''}>
            <UserPlus class="size-4" /> Invite
          </Button>
        </div>
      </div>
    {:else}
      <p class="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Only the workspace owner can invite people. Admins can edit workspace content.
      </p>
    {/if}
  </section>

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
        <h2 class="text-sm font-semibold">Account</h2>
        <p class="mt-1 text-xs text-muted-foreground">Profile, email, password, sessions.</p>
      </div>
      <a
        href="/account"
        class="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-muted"
      >
        <UserRound class="size-4" /> Account
        <ChevronRight class="size-4" />
      </a>
    </div>
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
