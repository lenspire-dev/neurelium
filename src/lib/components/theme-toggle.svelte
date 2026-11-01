<script lang="ts">
  import { Monitor, Moon, Sun } from '@lucide/svelte';
  import { theme } from '#lib/state/theme.svelte.js';
  import type { ThemeMode } from '#lib/presentation/theme.js';

  const options: readonly {
    value: ThemeMode;
    label: string;
    icon: typeof Sun;
  }[] = [
    { value: 'light', label: 'Light theme', icon: Sun },
    { value: 'dark', label: 'Dark theme', icon: Moon },
    { value: 'system', label: 'System theme', icon: Monitor }
  ];
</script>

<div class="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Color theme">
  {#each options as option (option.value)}
    <button
      type="button"
      class="grid min-h-10 place-items-center rounded-md transition-colors {theme.mode === option.value
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground'}"
      aria-pressed={theme.mode === option.value}
      aria-label={option.label}
      title={option.label}
      onclick={() => theme.setMode(option.value)}
    >
      <option.icon class="size-4" aria-hidden="true" />
    </button>
  {/each}
</div>
