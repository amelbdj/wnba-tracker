const LOCALE_MAP = {
  fr: "fr-FR",
  en: "en-US",
  es: "es-ES",
};

export function toLocale(lang) {
  return LOCALE_MAP[lang] || "fr-FR";
}
