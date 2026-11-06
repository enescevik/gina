// QT00 — Kontrollü sayı ayrıştırıcı (gina.qt_parse_number ile aynı kural; ifade çalıştırmaz).
// Yalnız giriş doğrulaması/önizleme içindir; puan SQL'de hesaplanır.
export function parseNumberInput(input: string): number | null {
  let s = input.normalize("NFC").trim().replace(/−/g, "-");
  if (!s || s.length > 40) return null;
  let neg = false;
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1).trim();
  }
  let d: number | null = null;
  let m: RegExpMatchArray | null;
  if (/^[0-9]+$/.test(s)) d = Number(s);
  else if (/^[0-9]{1,3}(\.[0-9]{3})+(,[0-9]+)?$/.test(s)) d = Number(s.replace(/\./g, "").replace(",", "."));
  else if (/^[0-9]+[.,][0-9]+$/.test(s)) d = Number(s.replace(",", "."));
  else if ((m = s.match(/^([0-9]+)\/([0-9]+)$/))) d = Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2]);
  else if ((m = s.match(/^([0-9]+) ([0-9]+)\/([0-9]+)$/))) {
    const [w, n, den] = [Number(m[1]), Number(m[2]), Number(m[3])];
    d = den === 0 || n >= den ? null : w + n / den;
  }
  if (d === null || !Number.isFinite(d)) return null;
  return neg ? -d : d;
}

