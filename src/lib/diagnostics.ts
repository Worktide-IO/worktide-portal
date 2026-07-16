import { api } from '@/lib/api';

/**
 * Client-side diagnostics ring buffer for the feedback tool (portal). Captures
 * recent JS errors, unhandled rejections, console.error/warn, failed-request
 * metadata (method/url/status — NEVER response bodies) and route breadcrumbs.
 *
 * Installed once at bootstrap and mirrored to sessionStorage so it survives a
 * crash-and-reload. Purely client-side — keeps working when the backend/app is
 * erroring.
 */

export type DiagKind = 'error' | 'rejection' | 'console' | 'request' | 'route';
export type DiagEntry = { t: string; kind: DiagKind; message: string; meta?: Record<string, unknown> };
export type DiagnosticsSnapshot = {
  capturedAt: string;
  url: string | null;
  userAgent: string | null;
  appVersion: string | null;
  entries: DiagEntry[];
};

const MAX = 50;
const STORAGE_KEY = 'wtp.diag';

let buffer: DiagEntry[] = [];
let installed = false;

function nowIso(): string {
  return new Date().toISOString();
}
function clip(value: unknown, max = 300): string {
  const str = typeof value === 'string' ? value : String(value);
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}
function persist(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(buffer.slice(-MAX)));
  } catch {
    /* quota / disabled */
  }
}
function push(entry: DiagEntry): void {
  buffer.push(entry);
  if (buffer.length > MAX) buffer = buffer.slice(-MAX);
  persist();
}

export function recordError(message: string, meta?: Record<string, unknown>): void {
  push({ t: nowIso(), kind: 'error', message: clip(message), meta });
}
export function recordRoute(path: string): void {
  push({ t: nowIso(), kind: 'route', message: clip(path, 200) });
}

export function getDiagnostics(): DiagnosticsSnapshot {
  return {
    capturedAt: nowIso(),
    url: typeof location !== 'undefined' ? location.href : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    appVersion: (import.meta.env?.VITE_APP_VERSION as string | undefined) ?? null,
    entries: buffer.slice(-MAX),
  };
}

export function installDiagnostics(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const prev = JSON.parse(raw);
      if (Array.isArray(prev)) buffer = prev.slice(-MAX);
    }
  } catch {
    /* ignore */
  }

  window.addEventListener('error', (e) => {
    recordError(e.message || 'Error', { source: e.filename, line: e.lineno, col: e.colno });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = (e as PromiseRejectionEvent).reason as { message?: string } | undefined;
    recordError(reason?.message ?? clip(reason), { rejection: true });
  });

  (['error', 'warn'] as const).forEach((level) => {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      push({
        t: nowIso(),
        kind: 'console',
        message: clip(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')),
        meta: { level },
      });
      orig(...args);
    };
  });

  // The portal has no network-status event bus — record failed requests via an
  // interceptor on the shared api instance. Metadata only, never bodies.
  api.interceptors.response.use(
    (r) => r,
    (err: unknown) => {
      const e = err as { config?: { method?: string; url?: string }; response?: { status?: number } };
      const method = (e.config?.method ?? 'get').toUpperCase();
      const url = e.config?.url ?? '';
      push({ t: nowIso(), kind: 'request', message: `${method} ${url} → ${e.response?.status ?? 'network error'}`.trim() });
      return Promise.reject(err);
    },
  );

  const patch = (fn: 'pushState' | 'replaceState') => {
    const orig = history[fn].bind(history);
    history[fn] = (...args: Parameters<History['pushState']>) => {
      const ret = orig(...args);
      recordRoute(location.pathname + location.search);
      return ret;
    };
  };
  patch('pushState');
  patch('replaceState');
  window.addEventListener('popstate', () => recordRoute(location.pathname + location.search));
  recordRoute(location.pathname + location.search);
}
