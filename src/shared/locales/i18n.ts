import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './en.json';
import tr from './tr.json';

const languageDetector = () => {
  const locales = Localization.getLocales();
  const primary = locales[0];
  const candidate = primary?.languageCode || primary?.languageTag?.split('-')[0];
  return candidate === 'tr' ? 'tr' : 'en';
};

const i18n = createInstance();

void i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources: {
      en: { translation: en },
      tr: { translation: tr },
    },
    lng: languageDetector(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
