export type DragPayload =
  | { readonly kind: 'task'; readonly id: string }
  | { readonly kind: 'entry'; readonly id: string };

export interface DragOptions {
  readonly payload: () => DragPayload;
  readonly onDrop: (payload: DragPayload, zone: string) => void;
  readonly disabled?: () => boolean;
}

const OVER_CLASSES = ['ring-2', 'ring-primary', 'ring-offset-2'];

export function draggable(node: HTMLElement, options: DragOptions) {
  let current = options;
  let ghost: HTMLElement | null = null;
  let over: Element | null = null;
  let startX = 0;
  let startY = 0;
  let pointerId: number | null = null;
  let dragging = false;

  function start(event: PointerEvent) {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    if (current.disabled?.()) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  function move(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if (!dragging && Math.hypot(dx, dy) < 8) return;
    event.preventDefault();

    if (!dragging) {
      dragging = true;
      const card = node.closest('[data-drag-card]') ?? node;
      ghost = card.cloneNode(true) as HTMLElement;
      ghost.removeAttribute('data-drag-card');
      ghost.style.position = 'fixed';
      ghost.style.left = '0';
      ghost.style.top = '0';
      ghost.style.width = `${card.getBoundingClientRect().width}px`;
      ghost.style.pointerEvents = 'none';
      ghost.style.opacity = '0.9';
      ghost.style.zIndex = '100';
      ghost.style.transform = `translate(${event.clientX - 24}px, ${event.clientY - 24}px)`;
      document.body.appendChild(ghost);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
    }

    if (ghost !== null) {
      ghost.style.transform = `translate(${event.clientX - 24}px, ${event.clientY - 24}px)`;
    }

    const target =
      document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-drop-zone]') ?? null;
    if (target !== over) {
      if (over !== null) over.classList.remove(...OVER_CLASSES);
      over = target;
      if (over !== null) over.classList.add(...OVER_CLASSES);
    }
  }

  function end(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);

    if (dragging) {
      const zone = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest('[data-drop-zone]')
        ?.getAttribute('data-drop-zone');
      if (zone !== null && zone !== undefined) current.onDrop(current.payload(), zone);
    }

    if (over !== null) over.classList.remove(...OVER_CLASSES);
    over = null;
    ghost?.remove();
    ghost = null;
    dragging = false;
    pointerId = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }

  function destroy() {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    over?.classList.remove(...OVER_CLASSES);
    ghost?.remove();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }

  node.addEventListener('pointerdown', start);
  return {
    update(next: DragOptions) {
      current = next;
    },
    destroy() {
      node.removeEventListener('pointerdown', start);
      destroy();
    }
  };
}
