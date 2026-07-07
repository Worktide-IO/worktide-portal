import { useBranding } from '@/providers/brandingProvider';

/**
 * Legal footer with Impressum / Datenschutz links. Each link renders only when
 * its BRAND_*_URL is configured; if neither is set the footer collapses to
 * nothing.
 */
export function Footer({ className }: { className?: string }) {
  const { imprintUrl, privacyUrl } = useBranding();

  if (!imprintUrl && !privacyUrl) return null;

  return (
    <footer
      className={`flex items-center justify-center gap-3 text-xs text-slate-400 ${className ?? ''}`}
    >
      {imprintUrl && (
        <a href={imprintUrl} target="_blank" rel="noreferrer" className="hover:underline">
          Impressum
        </a>
      )}
      {imprintUrl && privacyUrl && <span aria-hidden="true">·</span>}
      {privacyUrl && (
        <a href={privacyUrl} target="_blank" rel="noreferrer" className="hover:underline">
          Datenschutz
        </a>
      )}
    </footer>
  );
}
