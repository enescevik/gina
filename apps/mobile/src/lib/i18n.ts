import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { DEFAULT_LOCALE, resolveLocale } from "@gina/core";
import { resources } from "@gina/core/i18n";

const deviceTag = getLocales()[0]?.languageTag;

// eslint-disable-next-line import/no-named-as-default-member -- i18next örneği zincirleme kurulur
void i18n.use(initReactI18next).init({
  resources,
  lng: resolveLocale(deviceTag),
  fallbackLng: DEFAULT_LOCALE,
  ns: ["common"],
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

export default i18n;
