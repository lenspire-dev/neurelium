<script lang="ts">
  import Modal from '#lib/components/ui/modal.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { confirmState, resolveConfirm } from '#lib/state/confirm.svelte.js';

  let options = $derived(confirmState.options);

  function close(value: boolean) {
    resolveConfirm(value);
  }
</script>

<Modal
  open={confirmState.open}
  onOpenChange={(value) => {
    if (!value && confirmState.open) close(false);
  }}
  title={options.title}
  description={options.description}
>
  <div class="flex justify-end gap-2">
    <Button variant="outline" onclick={() => close(false)}>Cancel</Button>
    <Button
      variant={options.destructive ? 'destructive' : 'default'}
      onclick={() => close(true)}
    >
      {options.confirmLabel ?? 'Continue'}
    </Button>
  </div>
</Modal>
