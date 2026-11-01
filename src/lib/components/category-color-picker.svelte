<script lang="ts">
  import { CATEGORY_COLOR_KEYS, type CategoryColor } from '#lib/domain/models/category-color.js';
  import {
    CATEGORY_COLOR_META,
    hashCategoryColor
  } from '#lib/presentation/category-color.js';

  let {
    value = $bindable(null),
    hasParent = false,
    parentColor = null,
    autoColor = null
  }: {
    value?: CategoryColor | null;
    hasParent?: boolean;
    parentColor?: CategoryColor | null;
    autoColor?: CategoryColor | null;
  } = $props();

  const groupName = 'category-color';
  const autoLabel = $derived(hasParent ? 'Inherit' : 'Auto');
  const autoKey = $derived(autoColor ?? parentColor ?? hashCategoryColor(''));
  const autoMeta = $derived(CATEGORY_COLOR_META[autoKey]);
</script>

<fieldset class="space-y-2">
  <legend class="text-sm font-medium">Color</legend>
  <p class="text-xs text-muted-foreground">
    Used for dots and highlights across your workspace.
  </p>
  <div class="flex flex-wrap gap-2">
    <label class="cursor-pointer" title={autoLabel}>
      <input
        type="radio"
        name={groupName}
        value="auto"
        class="peer sr-only"
        checked={value === null}
        onchange={() => (value = null)}
      />
      <span
        class="grid size-9 place-items-center rounded-full border border-dashed border-muted-foreground/60 transition-shadow peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background {value ===
        null
          ? 'ring-2 ring-muted-foreground ring-offset-2 ring-offset-background'
          : ''}"
        aria-hidden="true"
      >
        <span class="size-3 rounded-full {autoMeta.swatchClass}"></span>
      </span>
      <span class="sr-only">{autoLabel}</span>
    </label>
    {#each CATEGORY_COLOR_KEYS as key (key)}
      {@const meta = CATEGORY_COLOR_META[key]}
      <label class="cursor-pointer" title={meta.label}>
        <input
          type="radio"
          name={groupName}
          value={key}
          class="peer sr-only"
          checked={value === key}
          onchange={() => (value = key)}
        />
        <span
          class="block size-9 rounded-full {meta.swatchClass} transition-shadow peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background {value ===
          key
            ? `ring-2 ring-offset-2 ring-offset-background ${meta.ringClass}`
            : ''}"
          aria-hidden="true"
        ></span>
        <span class="sr-only">{meta.label}</span>
      </label>
    {/each}
  </div>
</fieldset>
