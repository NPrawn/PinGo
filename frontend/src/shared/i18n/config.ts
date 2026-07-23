import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en/translation';
import { ko } from './locales/ko/translation';

void i18n.use(initReactI18next).init({
  resources: { ko, en },
  lng: 'ko',
  fallbackLng: 'ko',
  interpolation: { escapeValue: false },
});

export default i18n;
