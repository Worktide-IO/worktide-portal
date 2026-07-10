import axios, { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, JWT_KEY, REFRESH_KEY, readToken, writeTokens } from './api';

/**
 * 401 → refresh → replay contract (portal M4). We drive the REAL response
 * interceptor installed in api.ts through a stubbed axios adapter, so the test
 * exercises the shipped code path rather than a reimplementation. The adapter
 * decides 401-vs-200 from the Bearer token, mirroring the backend: the stale
 * JWT is rejected, the freshly-refreshed one is accepted.
 */

function authHeader(config: { headers?: Record<string, unknown> & { get?: (k: string) => unknown } }): string {
  const h = config.headers;
  if (h && typeof h.get === 'function') return String(h.get('Authorization') ?? '');
  return String(h?.Authorization ?? '');
}

let assign: ReturnType<typeof vi.fn>;
let refreshCalls: number;
/** When true the refresh endpoint itself answers 401 (revoked/expired token). */
let refreshFails: boolean;

// A custom adapter must enforce validateStatus itself (axios only does so for
// its built-in adapters) — otherwise a resolved 401 is treated as success and
// the error interceptor never runs. Reject non-2xx with a real AxiosError so
// `error.response.status` / `error.config` are populated exactly as in prod.
function reply(config: any, status: number, data: unknown) {
  const response = { data, status, statusText: '', headers: {}, config };
  if (status >= 200 && status < 300) return Promise.resolve(response);
  return Promise.reject(new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response as never));
}

function installAdapter(): void {
  const adapter = (config: any) => {
    const url = `${config.baseURL ?? ''}${config.url ?? ''}`;
    if (url.includes('/auth/refresh')) {
      refreshCalls += 1;
      return refreshFails
        ? reply(config, 401, { error: 'invalid refresh token' })
        : reply(config, 200, { token: 'jwt-new', refresh_token: 'refresh-new' });
    }
    // Data endpoints: only the freshly-minted JWT is honoured.
    return authHeader(config) === 'Bearer jwt-new'
      ? reply(config, 200, { ok: true })
      : reply(config, 401, { error: 'expired' });
  };
  api.defaults.adapter = adapter;
  axios.defaults.adapter = adapter;
}

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  assign = vi.fn();
  vi.stubGlobal('window', { location: { pathname: '/tickets', assign } });
  refreshCalls = 0;
  refreshFails = false;
  installAdapter();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api 401 refresh interceptor', () => {
  it('refreshes once and replays the original request with the new token', async () => {
    writeTokens('jwt-stale', 'refresh-1');

    const res = await api.get('/tickets');

    expect(res.data).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
    expect(readToken(JWT_KEY)).toBe('jwt-new');
    expect(readToken(REFRESH_KEY)).toBe('refresh-new');
    expect(assign).not.toHaveBeenCalled();
  });

  it('coalesces concurrent 401s into a single refresh (rotation-safe)', async () => {
    writeTokens('jwt-stale', 'refresh-1');

    const all = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);

    expect(all.map((r) => r.data)).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
  });

  it('clears the session and bounces to /login when refresh fails', async () => {
    writeTokens('jwt-stale', 'refresh-bad');
    refreshFails = true;

    await expect(api.get('/tickets')).rejects.toMatchObject({ response: { status: 401 } });
    expect(readToken(JWT_KEY)).toBeNull();
    expect(readToken(REFRESH_KEY)).toBeNull();
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('logs out immediately on 401 when there is no refresh token', async () => {
    // No tokens stored at all.
    await expect(api.get('/tickets')).rejects.toMatchObject({ response: { status: 401 } });
    expect(refreshCalls).toBe(0);
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('does not retry a second time if the replay also 401s', async () => {
    // Refresh "succeeds" but the adapter never honours the new token either.
    writeTokens('jwt-stale', 'refresh-1');
    const adapter = (config: any) => {
      const url = `${config.baseURL ?? ''}${config.url ?? ''}`;
      if (url.includes('/auth/refresh')) {
        refreshCalls += 1;
        return reply(config, 200, { token: 'jwt-new', refresh_token: 'refresh-new' });
      }
      return reply(config, 401, { error: 'still expired' });
    };
    api.defaults.adapter = adapter;
    axios.defaults.adapter = adapter;

    await expect(api.get('/tickets')).rejects.toMatchObject({ response: { status: 401 } });
    expect(refreshCalls).toBe(1); // exactly one refresh attempt, no infinite loop
  });
});

describe('api JSON-salvage interceptor (M2)', () => {
  // Serve a raw body string with a chosen content-type. axios leaves an
  // unparseable body as a string, so the interceptor's salvage path runs.
  function serve(body: string, contentType = 'application/json') {
    api.defaults.adapter = (config: any) =>
      Promise.resolve({ data: body, status: 200, statusText: '', headers: { 'content-type': contentType }, config });
  }

  it('returns a clean JSON body unchanged', async () => {
    serve('{"a":1,"b":"x"}');
    expect((await api.get('/x')).data).toEqual({ a: 1, b: 'x' });
  });

  it('keeps a valid payload whose own string value contains "<!--" (no truncation)', async () => {
    // A Symfony profiler comment is appended AFTER the JSON; the field value
    // itself also contains "<!--" — the old indexOf('<!--') cut truncated here.
    serve('{"note":"before <!-- keep --> after","n":2}\n<!-- Symfony profiler -->');
    expect((await api.get('/x')).data).toEqual({ note: 'before <!-- keep --> after', n: 2 });
  });

  it('salvages when a PHP notice with no "<!--" is appended', async () => {
    serve('{"ok":true}<br />\n<b>Warning</b>: foo in /app on line 3');
    expect((await api.get('/x')).data).toEqual({ ok: true });
  });

  it('is not fooled by braces/brackets inside string values', async () => {
    serve('{"tpl":"a } b ] c","arr":[1,2]}<!-- x -->');
    expect((await api.get('/x')).data).toEqual({ tpl: 'a } b ] c', arr: [1, 2] });
  });

  it('salvages a top-level array', async () => {
    serve('[{"id":1},{"id":2}]<!-- trailing -->');
    expect((await api.get('/x')).data).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('leaves a genuine non-JSON (text/html) body untouched', async () => {
    serve('<html><body>hi</body></html>', 'text/html; charset=utf-8');
    const res = await api.get('/x');
    expect(typeof res.data).toBe('string');
    expect(res.data).toContain('<html>');
  });

  it('rejects a JSON-typed body that has no leading JSON value', async () => {
    serve('not json at all <!-- x -->');
    await expect(api.get('/x')).rejects.toThrow('Malformed');
  });
});
