import { useTranslation } from 'react-i18next';

/** `{ field: { locale: value } }` — mirrors the backend `translations` column. */
export type TranslationsMap = Record<string, Record<string, string>>;

/**
 * Resolve a translatable field for a given locale: the per-locale override if
 * present + non-empty, otherwise the raw base value (source language). The
 * backend serves the base field untouched, so this never returns empty for a
 * populated field — an admin who only authored the base value still shows it.
 *
 * Portal counterpart of worktide-web's `localize()` (src/lib/languages.ts).
 * Admin-authored, customer-facing content (newsletter topics, meeting types,
 * forms, agreement types) carries a `translations` map; a customer whose portal
 * language differs from the workspace language reads it in their own language.
 */
export function localize(
  entity: ({ translations?: TranslationsMap | null } & Record<string, unknown>) | null | undefined,
  field: string,
  locale: string,
): string {
  if (!entity) return '';
  const override = entity.translations?.[field]?.[locale];
  if (typeof override === 'string' && override.trim() !== '') {
    return override;
  }
  const base = entity[field];
  return typeof base === 'string' ? base : '';
}

/**
 * Hook form of {@link localize} bound to the portal's active language
 * (i18next `i18n.language`, driven by the contact's preferred language / the
 * header switcher). Re-renders on a language switch like any i18n consumer.
 */
export function useLocalize(): (
  entity: ({ translations?: TranslationsMap | null } & Record<string, unknown>) | null | undefined,
  field: string,
) => string {
  const { i18n } = useTranslation();
  const locale = i18n.language.slice(0, 2);
  return (entity, field) => localize(entity, field, locale);
}
