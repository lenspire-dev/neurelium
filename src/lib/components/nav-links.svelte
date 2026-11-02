<script lang="ts">
  import { page } from '$app/state';
  import {
    CalendarDays,
    History,
    LayoutDashboard,
    ListTree,
    Settings,
    Target,
    UserRound
  } from '@lucide/svelte';

  let { onNavigate }: { onNavigate?: () => void } = $props();

  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/hierarchy', label: 'Hierarchy', icon: ListTree },
    { href: '/week', label: 'Week', icon: CalendarDays },
    { href: '/milestones', label: 'Milestones', icon: Target },
    { href: '/logs', label: 'Activity', icon: History },
    { href: '/account', label: 'Account', icon: UserRound },
    { href: '/settings', label: 'Settings', icon: Settings }
  ];

  function isActive(href: string): boolean {
    return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
  }
</script>

<nav class="flex flex-col gap-1" aria-label="Main">
  {#each links as link (link.href)}
    <a
      href={link.href}
      onclick={onNavigate}
      aria-current={isActive(link.href) ? 'page' : undefined}
      class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors {isActive(
        link.href
      )
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
    >
      <link.icon class="size-4" aria-hidden="true" />
      {link.label}
    </a>
  {/each}
</nav>
