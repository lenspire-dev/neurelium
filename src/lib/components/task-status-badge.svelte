<script lang="ts">
  import { cn } from '#lib/utils.js';
  import type { TaskStatus } from '#lib/domain/models/task-status.js';
  import { taskStatusMeta } from '#lib/presentation/task-status.js';

  let { status, class: className }: { status: TaskStatus; class?: string } = $props();
  let meta = $derived(taskStatusMeta(status));
</script>

<span
  class={cn(
    'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
    meta.badgeClass,
    className
  )}
>
  {meta.label}
</span>
