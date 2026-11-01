<script lang="ts">
  import { app } from '#lib/state/app.svelte.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import { Label } from '#lib/components/ui/label/index.js';
  import ThemeToggle from '#lib/components/theme-toggle.svelte';
  import { Eye, EyeOff, LoaderCircle } from '@lucide/svelte';

  let mode = $state<'sign-in' | 'sign-up'>('sign-in');
  let name = $state('');
  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let showPassword = $state(false);
  let formError = $state<string | null>(null);

  function setMode(next: 'sign-in' | 'sign-up') {
    mode = next;
    formError = null;
    app.clearError();
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    formError = null;
    if (mode === 'sign-up' && password !== confirmPassword) {
      formError = 'Passwords do not match.';
      return;
    }
    if (mode === 'sign-in') {
      await app.signIn(email, password);
    } else {
      await app.signUp(name, email, password);
    }
  }
</script>

<div class="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
  <div class="w-full max-w-sm">
    <div class="mb-8 text-center">
      <div
        class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground"
        aria-hidden="true"
      >
        N
      </div>
      <h1 class="text-2xl font-semibold tracking-tight">Neurelium</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Plan the week. Build the milestone.
      </p>
    </div>

    <div class="rounded-2xl border bg-card p-5 shadow-sm">
      <div class="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <button
          type="button"
          aria-pressed={mode === 'sign-in'}
          class="min-h-11 rounded-md text-sm font-medium transition-colors {mode === 'sign-in'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground'}"
          onclick={() => setMode('sign-in')}
        >
          Sign in
        </button>
        <button
          type="button"
          aria-pressed={mode === 'sign-up'}
          class="min-h-11 rounded-md text-sm font-medium transition-colors {mode === 'sign-up'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground'}"
          onclick={() => setMode('sign-up')}
        >
          Create account
        </button>
      </div>

      <form class="space-y-4" onsubmit={submit}>
        {#if mode === 'sign-up'}
          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input id="name" bind:value={name} autocomplete="name" class="h-11" required />
          </div>
        {/if}
        <div class="space-y-2">
          <Label for="email">Email</Label>
          <Input
            id="email"
            type="email"
            bind:value={email}
            autocomplete="email"
            class="h-11"
            required
          />
        </div>
        <div class="space-y-2">
          <Label for="password">Password</Label>
          <div class="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              bind:value={password}
              autocomplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              class="h-11 pr-12"
              minlength={8}
              required
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-md text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onclick={() => (showPassword = !showPassword)}
            >
              {#if showPassword}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
            </button>
          </div>
        </div>
        {#if mode === 'sign-up'}
          <div class="space-y-2">
            <Label for="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              bind:value={confirmPassword}
              autocomplete="new-password"
              class="h-11"
              minlength={8}
              required
            />
          </div>
        {/if}

        {#if formError ?? app.error}
          <p class="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {formError ?? app.error}
          </p>
        {/if}

        <Button type="submit" class="h-11 w-full" disabled={app.busy}>
          {#if app.busy}
            <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
          {/if}
          {mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </Button>
      </form>
    </div>

    <div class="mt-4">
      <ThemeToggle />
    </div>

    <p class="mt-6 text-center text-xs text-muted-foreground">
      Installable. Mobile-first. Your workspace stays private.
    </p>
  </div>
</div>
