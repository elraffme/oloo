import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import en from './locales/en.json';
import sw from './locales/sw.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import ar from './locales/ar.json';
import am from './locales/am.json';
import ha from './locales/ha.json';
import ig from './locales/ig.json';
import yo from './locales/yo.json';
import zu from './locales/zu.json';
import xh from './locales/xh.json';
import af from './locales/af.json';
import so from './locales/so.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      sw: { translation: sw },
      fr: { translation: fr },
      pt: { translation: pt },
      ar: { translation: ar },
      am: { translation: am },
      ha: { translation: ha },
      ig: { translation: ig },
      yo: { translation: yo },
      zu: { translation: zu },
      xh: { translation: xh },
      af: { translation: af },
      so: { translation: so },
    },
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
