import { useEffect } from 'react';
import { useBranding } from '@/providers/brandingProvider';

/**
 * Sets the browser tab title to `{title} · {brandName}`.
 * Call at the top of each page component to override the default brand title.
 */
export function usePageTitle(title: string): void {
  const brand = useBranding();
  useEffect(() => {
    document.title = `${title} · ${brand.name}`;
  }, [title, brand.name]);
}
