<script lang="ts">
  import { DEFAULT_WEIGHT_GRADE, type WeightGrade } from '#lib/domain/models/weight.js';
  import { WEIGHT_GRADE_META, weightMeta } from '#lib/presentation/weight.js';
  import { cn } from '#lib/utils.js';

  let {
    value = $bindable(DEFAULT_WEIGHT_GRADE),
    label = 'Weight',
    disabled = false
  }: {
    value?: WeightGrade;
    label?: string;
    disabled?: boolean;
  } = $props();

  let selected = $derived(weightMeta(value));
</script>

<fieldset class="space-y-2" {disabled}>
  <legend class="text-sm font-medium">{label}</legend>
  <div class="grid grid-cols-5 gap-1.5" role="group" aria-label={label}>
    {#each WEIGHT_GRADE_META as grade (grade.value)}
      <button
        type="button"
        data-selected={value === grade.value}
        aria-pressed={value === grade.value}
        aria-label={`${grade.value} ${grade.label}`}
        class={cn(
          'flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg border bg-background px-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50',
          grade.segmentClass
        )}
        onclick={() => (value = grade.value)}
      >
        <span class="text-sm">{grade.value}</span>
      </button>
    {/each}
  </div>
  <p class="text-xs text-muted-foreground">
    <span class="font-medium text-foreground">{selected.label}</span>
    {' · '}
    {selected.description}
  </p>
</fieldset>
