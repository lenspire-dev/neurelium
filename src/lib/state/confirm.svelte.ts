export interface ConfirmOptions {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel?: string;
  readonly destructive?: boolean;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions;
}

const defaults: ConfirmOptions = {
  title: 'Are you sure?',
  description: 'This action cannot be undone.'
};

export const confirmState = $state<ConfirmState>({ open: false, options: defaults });

let resolveCurrent: ((value: boolean) => void) | null = null;

export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  resolveCurrent?.(false);
  confirmState.options = options;
  confirmState.open = true;
  return new Promise((resolve) => {
    resolveCurrent = resolve;
  });
}

export function resolveConfirm(value: boolean): void {
  const resolve = resolveCurrent;
  resolveCurrent = null;
  confirmState.open = false;
  resolve?.(value);
}
