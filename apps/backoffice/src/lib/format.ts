// Tarih/sayı biçimleri (Türkçe yerel ayar, Europe/Istanbul).
const dateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });
const date = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" });
const number = new Intl.NumberFormat("tr-TR");

export const fmtDateTime = (v: string | null | undefined) => (v ? dateTime.format(new Date(v)) : "—");
export const fmtDate = (v: string | null | undefined) => (v ? date.format(new Date(v)) : "—");
export const fmtNumber = (v: number | null | undefined) => (v == null ? "—" : number.format(v));

/** <input type="datetime-local"> değeri → ISO (tarayıcının saat dilimiyle). */
export const localInputToIso = (v: string) => new Date(v).toISOString();

/** Bugünden n gün sonrası, datetime-local biçiminde. */
export function inputDaysFromNow(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
