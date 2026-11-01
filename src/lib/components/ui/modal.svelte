<script lang="ts">
  import { Dialog } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import { X } from '@lucide/svelte';
  import { cn } from '#lib/utils.js';

  let {
    open = $bindable(false),
    title,
    description,
    class: className,
    onOpenChange,
    children
  }: {
    open?: boolean;
    title: string;
    description: string;
    class?: string;
    onOpenChange?: (open: boolean) => void;
    children: Snippet;
  } = $props();
</script>

<Dialog.Root bind:open onOpenChange={(value) => onOpenChange?.(value)}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]" />
    <Dialog.Content
      class={cn(
        'fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl outline-none',
        className
      )}
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <Dialog.Title class="text-lg font-semibold tracking-tight">{title}</Dialog.Title>
          <Dialog.Description class="mt-1 text-sm text-muted-foreground">
            {description}
          </Dialog.Description>
        </div>
        <Dialog.Close
          class="grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label="Close dialog"
        >
          <X class="size-4" />
        </Dialog.Close>
      </div>
      <div class="mt-4">
        {@render children()}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
