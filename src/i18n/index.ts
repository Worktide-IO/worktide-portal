import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from '@/locales/de.json';
import en from '@/locales/en.json';

/**
 * Portal i18n runtime (i18next + react-i18next). English is the source/fallback;
 * German is a translation. Initial language: a logged-in contact's stored
 * `preferredLanguage` (set via the header switcher → PATCH /portal/me →
 * i18n.changeLanguage); public pages fall back to the browser language.
 *
 * Semantic keys, filled per phase (see the backend docs/i18n-plan.md).
 */
const browser = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'en';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
  },
  lng: browser === 'de' ? 'de' : 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'de'],
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export default i18n;
