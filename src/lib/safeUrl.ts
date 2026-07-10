/**
 * Returns `url` only when it is a safe http(s) target (or a relative / same-page
 * link), otherwise null.
 *
 * Server- and operator-supplied URLs (proposal mockups, social permalinks,
 * branding logos, customer-system links) get rendered into `href`/`src`. React
 * does NOT neutralize a `javascript:` (or `data:`, `vbscript:`, …) URL, so an
 * unvalidated value could execute script / exfiltrate the stored token when a
 * user clicks it. Gate every such URL through this before rendering.
 */
export function safeUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string') {
    return null;
  }
  const trimmed = url.trim();
  if (trimmed === '') {
    return null;
  }
  // Relative and same-page links carry no scheme and are safe.
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return trimmed;
  }
  try {
    // The WHATWG URL parser strips tab/newline obfuscation ("java\tscript:")
    // before we read the protocol, so a lower-cased protocol check is robust.
    const parsed = new URL(trimmed, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
}
