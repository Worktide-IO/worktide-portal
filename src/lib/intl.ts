/**
 * Locale-aware Intl formatting for the portal. Routes dates/times/numbers
 * through the active app language (i18n.language: 'de' | 'en') instead of a
 * hard-coded 'de-DE'. Read at call time (in render), so formatting follows the
 * language the customer picks in the header switcher.
 */
import i18n from '@/i18n';

const INTL_LOCALE: Record<string, string> = { de: 'de-DE', en: 'en-GB' };

/** BCP-47 locale for the active app language, for Intl.* APIs. */
export function intlLocale(): string {
  return INTL_LOCALE[i18n.language] ?? i18n.language ?? 'en-GB';
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(
  value: string | number | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString(intlLocale(), opts) : '—';
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  return d ? d.toLocaleString(intlLocale(), opts) : '—';
}

export function formatNumber(value: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(), opts).format(value);
}
