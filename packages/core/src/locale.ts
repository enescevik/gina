import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export const SUPPORTED_LOCALES = ["tr", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "tr";
export const DEFAULT_TIMEZONE = "Europe/Istanbul";

/** Bir anın ailenin saat dilimindeki yerel tarihini YYYY-MM-DD olarak verir (görevlerin "bugün"ü). */
export function localDateOf(instant: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  return format(new TZDate(instant, timeZone), "yyyy-MM-dd");
}

/** Cihaz dilini desteklenen dillere indirger; bilinmeyen dil varsayılana düşer. */
export function resolveLocale(tag: string | null | undefined): SupportedLocale {
  const lang = (tag ?? "").toLowerCase().split(/[-_]/)[0] ?? "";
  return (SUPPORTED_LOCALES as readonly string[]).includes(lang) ? (lang as SupportedLocale) : DEFAULT_LOCALE;
}
