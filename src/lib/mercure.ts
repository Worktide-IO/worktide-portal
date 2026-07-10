import { EventSourcePlus } from 'event-source-plus';
import { useEffect, useRef } from 'react';

import { api } from '@/lib/api';

/**
 * URL of the Mercure hub the SPA subscribes to. May be absolute (prod: point
 * straight at the hub, whose CORS lists the portal domain) or a same-origin
 * path (dev: `/.well-known/mercure`, proxied by Vite to dodge the shared hub's
 * CORS allowlist). Resolved against the page origin below, so both forms work.
 */
export const MERCURE_HUB_URL: string =
  import.meta.env.VITE_MERCURE_HUB_URL ?? '/.well-known/mercure';

/**
 * What `/v1/portal/mercure-token` returns: a short-lived hub JWT plus the
 * (server-scoped) topic the token is allowed to subscribe to. We never build
 * the topic IRI on the client — the backend derives it from the authenticated
 * user, so the client can only ever listen to its own notifications.
 */
export type PortalMercureToken = { token: string; topic: string; expiresAt: string };

/**
 * Module-scoped token cache. The hub JWT lives 30 minutes; we refresh 60 s
 * before expiry so a long-lived subscription never races the boundary. Shared
 * across hook instances (bell + inbox page can both be mounted) so they issue
 * exactly one token fetch between them.
 */
let cached: { value: PortalMercureToken; expiresAtMs: number } | null = null;
let inflight: Promise<PortalMercureToken> | null = null;

async function getToken(): Promise<PortalMercureToken> {
  const now = Date.now();
  if (cached && cached.expiresAtMs > now + 60_000) return cached.value;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data } = await api.get<PortalMercureToken>('/portal/mercure-token');
      cached = { value: data, expiresAtMs: new Date(data.expiresAt).getTime() };
      return data;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Drop the cached token. Call on logout / hub 401 so the next read re-fetches. */
export function clearMercureToken(): void {
  cached = null;
  inflight = null;
}

/**
 * Subscribe to the portal user's private notifications topic and invoke
 * `onMessage` with each parsed notification payload as the backend publishes it.
 *
 * Implementation notes:
 *  - Uses `event-source-plus` (fetch-based) instead of the browser-native
 *    `EventSource`, which cannot send an `Authorization` header — and the hub
 *    runs in non-anonymous mode.
 *  - `onMessage` is stored in a ref so a fresh callback identity per render does
 *    not tear down and rebuild the SSE connection; the effect only re-runs when
 *    `enabled` flips.
 *  - Best-effort: if the token fetch fails (e.g. right after logout) we stay
 *    silent. The bell/inbox still work via their initial REST load; only the
 *    live push is degraded.
 */
export function useNotificationStream<T = unknown>(
  onMessage: (data: T) => void,
  options: { enabled?: boolean } = {},
): void {
  const { enabled = true } = options;
  const cbRef = useRef(onMessage);
  useEffect(() => {
    cbRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let controller: { abort: () => void } | null = null;

    (async () => {
      let auth: PortalMercureToken;
      try {
        auth = await getToken();
      } catch {
        return; // non-critical — see doc comment
      }
      if (cancelled) return;

      // Resolve against the page origin so a same-origin path (dev proxy) and
      // an absolute hub URL (prod) both parse.
      const url = new URL(MERCURE_HUB_URL, window.location.origin);
      url.searchParams.append('topic', auth.topic);

      const es = new EventSourcePlus(url.toString(), {
        headers: { Authorization: `Bearer ${auth.token}` },
        // event-source-plus retries on its own; bound it so a hub outage
        // doesn't reconnect forever.
        maxRetryCount: 10,
        maxRetryInterval: 10_000,
      });

      controller = es.listen({
        onMessage(msg) {
          if (cancelled) return;
          let parsed: T;
          try {
            parsed = JSON.parse(msg.data) as T;
          } catch {
            return; // keepalive comments / non-JSON frames
          }
          cbRef.current(parsed);
        },
        onRequestError({ error }) {
          // A 401 from the hub usually means the token expired between fetch
          // and use; drop the cache so the retry mints a fresh one.
          if (
            typeof error === 'object' &&
            error !== null &&
            'status' in error &&
            (error as { status?: number }).status === 401
          ) {
            clearMercureToken();
          }
        },
      });
    })();

    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, [enabled]);
}
