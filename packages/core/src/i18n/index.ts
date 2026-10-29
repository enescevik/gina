import en from "./en.json";
import tr from "./tr.json";

/** i18next kaynakları: her dil tek namespace ("common") ile başlar, ekranlar büyüdükçe bölünür. */
export const resources = {
  tr: { common: tr },
  en: { common: en },
} as const;

export type TranslationKeys = keyof typeof tr;
