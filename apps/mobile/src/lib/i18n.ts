/* eslint-disable import/no-named-as-default-member -- Calls target the configured i18next singleton. */
import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { DEFAULT_LOCALE, resolveLocale, type SupportedLocale } from "@gina/core";
import { resources } from "@gina/core/i18n";

import { deviceRecordStorage } from "./device-record-storage";

const deviceTag = getLocales()[0]?.languageTag;

void i18n.use(initReactI18next).init({
  resources,
  lng: resolveLocale(deviceTag),
  fallbackLng: DEFAULT_LOCALE,
  ns: ["common"],
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

const LOCALE_KEY = "gina.language.v1";
let explicitChoice = false;
function applyDocumentLanguage(locale: string) {
  if (typeof document !== "undefined") document.documentElement.lang = resolveLocale(locale);
}
i18n.on("languageChanged", applyDocumentLanguage);

/** Called after hydration: web static rendering must not read browser storage. */
export async function restoreAppLanguage() {
  try {
    const saved = deviceRecordStorage.get(LOCALE_KEY);
    if (saved === "tr" || saved === "en") {
      explicitChoice = true;
      await i18n.changeLanguage(saved);
    }
  } catch { /* Private mode/storage unavailable: device language remains usable. */ }
  applyDocumentLanguage(i18n.language);
}

/** A deliberate device choice wins over account defaults; never remounts forms. */
export async function setAppLanguage(locale: SupportedLocale): Promise<boolean> {
  explicitChoice = true;
  await i18n.changeLanguage(locale);
  try { deviceRecordStorage.set(LOCALE_KEY, locale); return true; }
  catch { return false; }
}

export async function adoptAccountLanguage(locale: unknown) {
  if (!explicitChoice && (locale === "tr" || locale === "en")) await i18n.changeLanguage(locale);
}
export default i18n;
