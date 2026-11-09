import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";
import ja from "./locales/ja.json";

export const SUPPORTED_LANGUAGES = [
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const DEFAULT_LOCALE: SupportedLanguage = "en";
export const LOCALE = DEFAULT_LOCALE;

export function detectLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  const saved = localStorage.getItem("komari_lang");
  if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
    return saved as SupportedLanguage;
  }

  const cookieMatch = document.cookie.match(/(?:^|;\s*)language=([^;]+)/);
  if (cookieMatch) {
    const val = decodeURIComponent(cookieMatch[1]);
    if (val.startsWith("zh-TW") || val.startsWith("zh-HK") || val.startsWith("zh-Hant")) {
      return "zh-TW";
    }
    if (val.startsWith("zh")) {
      return "zh-CN";
    }
    if (val.startsWith("ja")) {
      return "ja";
    }
    if (val.startsWith("en")) {
      return "en";
    }
  }

  const nav = navigator.language || "";
  if (
    nav.startsWith("zh-TW") ||
    nav.startsWith("zh-HK") ||
    nav.startsWith("zh-MO") ||
    nav.startsWith("zh-Hant")
  ) {
    return "zh-TW";
  }
  if (nav.startsWith("zh")) {
    return "zh-CN";
  }
  if (nav.startsWith("ja")) {
    return "ja";
  }
  return DEFAULT_LOCALE;
}

export function setLanguage(code: SupportedLanguage) {
  void i18n.changeLanguage(code);
  try {
    localStorage.setItem("komari_lang", code);
    document.cookie = `language=${code}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // storage may be restricted
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = code;
  }
}

const initialLang = detectLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-CN": { translation: zhCN },
    "zh-TW": { translation: zhTW },
    ja: { translation: ja },
  },
  lng: initialLang,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
  interpolation: { escapeValue: false },
  returnNull: false,
});

if (typeof document !== "undefined") {
  document.documentElement.lang = initialLang;
}

i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
  }
});

export default i18n;
