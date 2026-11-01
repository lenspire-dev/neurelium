<script lang="ts">
	import { cn } from '#lib/utils.js';

	let {
		class: className,
		indicatorClass = 'bg-primary',
		value = 0,
		max = 100,
		...restProps
	}: {
		class?: string;
		indicatorClass?: string;
		value?: number | null;
		max?: number;
		[key: string]: unknown;
	} = $props();

	let percentage = $derived(max <= 0 ? 0 : Math.min(100, Math.max(0, ((value ?? 0) / max) * 100)));
</script>

<div
	role="progressbar"
	aria-valuemin={0}
	aria-valuemax={max}
	aria-valuenow={value ?? 0}
	data-slot="progress"
	class={cn('bg-muted relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full', className)}
	{...restProps}
>
	<div
		data-slot="progress-indicator"
		class="size-full flex-1 transition-all {indicatorClass}"
		style="transform: translateX(-{100 - percentage}%)"
	></div>
</div>
