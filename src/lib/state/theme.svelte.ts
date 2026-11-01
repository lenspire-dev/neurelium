import {
  resolveTheme,
  type ResolvedTheme,
  type ThemeMode
} from '#lib/presentation/theme.js';

const STORAGE_KEY = 'neurelium-theme';

function storedMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' || value === 'system'
      ? value
      : 'system';
  } catch {
    return 'system';
  }
}

class ThemeStore {
  mode = $state<ThemeMode>('system');
  resolved = $state<ResolvedTheme>('light');
  #initialized = false;
  #media: MediaQueryList | null = null;

  init(): void {
    if (typeof window === 'undefined' || this.#initialized) return;
    this.#initialized = true;
    this.#media = window.matchMedia('(prefers-color-scheme: dark)');
    this.mode = storedMode();
    this.#apply();
    this.#media.addEventListener('change', this.#onSystemChange);
  }

  setMode(mode: ThemeMode): void {
    this.mode = mode;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        /* storage can be unavailable in private mode */
      }
    }
    this.#apply();
  }

  #onSystemChange = (): void => {
    if (this.mode === 'system') this.#apply();
  };

  #apply(): void {
    const resolved = resolveTheme(this.mode, this.#media?.matches ?? false);
    this.resolved = resolved;
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#0a0a0a' : '#bd0032');
  }
}

export const theme = new ThemeStore();
