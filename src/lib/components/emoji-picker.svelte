<script lang="ts">
  import { cn } from '#lib/utils.js';

  const EMOJIS = [
    '📚', '📘', '📗', '📕', '📝', '📐', '📏', '🧮',
    '🧪', '🧬', '🔬', '🧠', '💻', '🖥️', '⚙️', '🛠️',
    '🌍', '🗺️', '🧭', '🎨', '🎵', '🎼', '🏛️', '🏺',
    '🗂️', '🗓️', '🎯', '🚀', '💡', '🧩', '🩺', '💼'
  ];

  let {
    value = $bindable<string | null>(null),
    label = 'Icon'
  }: {
    value?: string | null;
    label?: string;
  } = $props();

  function setCustom(event: Event) {
    const next = (event.currentTarget as HTMLInputElement).value.trim();
    value = next === '' ? null : next;
  }
</script>

<fieldset class="space-y-2">
  <legend class="text-sm font-medium">{label}</legend>
  <div class="grid grid-cols-8 gap-1">
    {#each EMOJIS as emoji (emoji)}
      <button
        type="button"
        aria-label="Use {emoji}"
        aria-pressed={value === emoji}
        class={cn(
          'grid size-9 place-items-center rounded-lg border bg-background text-lg transition-colors hover:bg-muted',
          value === emoji && 'border-primary bg-primary/10'
        )}
        onclick={() => (value = value === emoji ? null : emoji)}
      >
        {emoji}
      </button>
    {/each}
  </div>
  <div class="flex items-center gap-2">
    <input
      class="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      value={value ?? ''}
      maxlength="16"
      placeholder="Or type an emoji"
      oninput={setCustom}
    />
    {#if value !== null}
      <button
        type="button"
        class="h-10 shrink-0 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        onclick={() => (value = null)}
      >
        Clear
      </button>
    {/if}
  </div>
</fieldset>
