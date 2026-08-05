import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en } from './locales/en'
import { ms } from './locales/ms'
import { zh } from './locales/zh'

const savedLang = localStorage.getItem('lr.lang')
const defaultLang = savedLang && ['en', 'ms', 'zh'].includes(savedLang) ? savedLang : 'en'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ms: { translation: ms },
    zh: { translation: zh },
  },
  lng: defaultLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
