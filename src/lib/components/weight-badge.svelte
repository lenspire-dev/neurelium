<script lang="ts">
  import { cn } from '#lib/utils.js';
  import { weightMeta } from '#lib/presentation/weight.js';

  let { value, class: className }: { value: number; class?: string } = $props();
  let meta = $derived(weightMeta(value));
</script>

<span
  class={cn(
    'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
    meta.badgeClass,
    className
  )}
  title={`${meta.label} weight: ${meta.description}`}
>
  {meta.label}
</span>
