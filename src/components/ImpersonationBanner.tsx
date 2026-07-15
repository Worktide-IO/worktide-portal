import { useTranslation } from 'react-i18next';

/**
 * Amber banner shown when a staff member is previewing the portal AS a customer
 * (magic-link impersonation). Driven by a `portalImpersonation` flag that
 * {@link MagicLinkCallbackPage} writes to sessionStorage on consume — so it
 * survives in-tab navigation/reloads and clears when the tab closes (or on
 * logout). Renders nothing for a normal customer session.
 */
export function ImpersonationBanner() {
  const { t } = useTranslation();

  const raw = sessionStorage.getItem('portalImpersonation');
  if (!raw) return null;

  let info: { customerName?: string | null; issuedBy?: string | null } = {};
  try {
    info = JSON.parse(raw);
  } catch {
    return null;
  }

  return (
    <div
      role="status"
      className="w-full bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-white"
    >
      {t('impersonation.banner', {
        customer: info.customerName ?? '—',
        staff: info.issuedBy ?? '',
      })}
    </div>
  );
}
