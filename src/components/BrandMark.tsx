import { useState } from 'react';
import { Boxes } from 'lucide-react';

import { useBranding } from '@/providers/brandingProvider';
import { safeUrl } from '@/lib/safeUrl';

/**
 * Portal wordmark: renders the configured logo (BRAND_LOGO_URL or the backend's
 * /branding/logo). Falls back to a Boxes icon + the brand name when no logo URL
 * is set or the image fails to load — so the header is never blank or broken.
 */
export function BrandMark() {
  const { logoUrl, name } = useBranding();
  const [errored, setErrored] = useState(false);
  const safeLogo = safeUrl(logoUrl);

  if (safeLogo && !errored) {
    return (
      <img
        src={safeLogo}
        alt={name}
        className="h-6 w-auto"
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <>
      <Boxes className="size-5 text-[var(--brand-primary)]" />
      {name}
    </>
  );
}
