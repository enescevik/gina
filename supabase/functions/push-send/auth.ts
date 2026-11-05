// push-send yetkilendirmesi (Q03-EDGE-1): bearer sırrı sabit zamanlı karşılaştırılır. Deno'da
// crypto.subtle.timingSafeEqual yoktur; UTF-8 baytları üzerinde uzunluktan bağımsız manuel karşılaştırma yapılır
// (her bayt XOR'lanır, uzunluk farkı sonuca katılır, erken çıkış yok). Mevcut sözleşme korunur: PUSH_SEND_SECRET
// veya SUPABASE_SERVICE_ROLE_KEY bearer olarak kabul edilir; yapılandırılmış her sır her istekte karşılaştırılır
// (kısa devre yok), böylece hangi sırrın eşleştiği zamanlamadan okunamaz.
const encoder = new TextEncoder();

export function timingSafeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a), y = encoder.encode(b);
  const n = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function bearerToken(authorization: string | null): string {
  const m = /^Bearer\s+(.+)$/i.exec(authorization ?? "");
  return m ? m[1].trim() : "";
}

/** `secrets` içindeki boş/undefined değerler yoksayılır; hiç sır yoksa hiçbir istek yetkili değildir. */
export function authorizedBearer(
  authorization: string | null,
  secrets: ReadonlyArray<string | undefined>,
): boolean {
  const bearer = bearerToken(authorization);
  const configured = secrets.filter((s): s is string => !!s);
  if (!bearer || configured.length === 0) return false;
  let ok = 0;
  for (const secret of configured) ok |= timingSafeEqual(bearer, secret) ? 1 : 0;
  return ok === 1;
}
