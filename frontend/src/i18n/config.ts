import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import zh from '../locales/zh.json';

const LANGUAGE_KEY = 'app_language';
const SUPPORTED_LANGUAGES = ['zh', 'en'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const normalizeLanguage = (value?: string | null): SupportedLanguage => {
    if (value === 'zh' || value === 'en') return value;
    return 'zh';
};

const detectLanguage = (): SupportedLanguage => {
    if (typeof window === 'undefined') return 'zh';
    try {
        const stored = localStorage.getItem(LANGUAGE_KEY);
        return normalizeLanguage(stored);
    } catch {
        return 'zh';
    }
};

const applyDocumentLang = (lang: SupportedLanguage) => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
};

const initialLanguage = detectLanguage();

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            zh: { translation: zh },
        },
        lng: initialLanguage,
        fallbackLng: 'zh',
        supportedLngs: SUPPORTED_LANGUAGES,
        interpolation: {
            escapeValue: false,
        },
    });

applyDocumentLang(initialLanguage);
i18n.on('languageChanged', (lang) => {
    const normalized = normalizeLanguage(lang);
    applyDocumentLang(normalized);
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(LANGUAGE_KEY, normalized);
    } catch {
        // Ignore write failures to keep runtime stable.
    }
});

export default i18n;
