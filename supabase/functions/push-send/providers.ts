// APNs (HTTP/2, token auth ES256) ve FCM HTTP v1 (service account OAuth2) gönderimi.
// Firebase SDK kullanılmaz; yalnız REST. Anahtarlar Supabase secrets'tan okunur.

export interface PushMessage {
  title: string;
  body: string;
  kind: string;
  data: Record<string, string>; // yalnız kimlikler + kind
}

/** Gönderim sonucu: gone = token geçersiz (silinir), retry = geçici hata. */
export type SendResult = { ok: true } | { ok: false; gone: boolean; retry: boolean; error: string };

const enc = new TextEncoder();

function b64url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof input === "string" ? enc.encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function signJwt(header: Record<string, unknown>, claims: Record<string, unknown>, key: CryptoKey, alg: AlgorithmIdentifier | EcdsaParams): Promise<string> {
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  // WebCrypto ECDSA imzası zaten JWS'in istediği r||s (P1363) biçimindedir.
  const sig = await crypto.subtle.sign(alg, key, enc.encode(input));
  return `${input}.${b64url(sig)}`;
}

// APNs ---------------------------------------------------------------------------------------

export interface ApnsConfig {
  keyP8: string;
  keyId: string;
  teamId: string;
  bundleId: string;
  sandbox: boolean;
}

export function apnsConfigFromEnv(): ApnsConfig | null {
  const keyP8 = Deno.env.get("APNS_KEY_P8");
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  if (!keyP8 || !keyId || !teamId) return null;
  return {
    keyP8,
    keyId,
    teamId,
    bundleId: Deno.env.get("APNS_BUNDLE_ID") ?? "com.enescevik.gina",
    // Geliştirme build'leri sandbox token üretir; TestFlight/App Store production.
    sandbox: Deno.env.get("APNS_ENV") === "sandbox",
  };
}

let apnsJwt: { token: string; at: number } | null = null;

async function apnsToken(cfg: ApnsConfig): Promise<string> {
  // Apple: token 20-60 dk arası yenilenmeli; 50 dk önbellek.
  if (apnsJwt && Date.now() - apnsJwt.at < 50 * 60 * 1000) return apnsJwt.token;
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(cfg.keyP8), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const token = await signJwt(
    { alg: "ES256", kid: cfg.keyId },
    { iss: cfg.teamId, iat: Math.floor(Date.now() / 1000) },
    key,
    { name: "ECDSA", hash: "SHA-256" },
  );
  apnsJwt = { token, at: Date.now() };
  return token;
}

export async function sendApns(cfg: ApnsConfig, deviceToken: string, msg: PushMessage): Promise<SendResult> {
  const host = cfg.sandbox ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  try {
    const res = await fetch(`${host}/3/device/${deviceToken}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${await apnsToken(cfg)}`,
        "apns-topic": cfg.bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-collapse-id": msg.kind,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        aps: { alert: { title: msg.title, body: msg.body }, sound: "default" },
        ...msg.data,
      }),
    });
    if (res.ok) return { ok: true };
    const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason ?? `http_${res.status}`;
    const gone = res.status === 410 || reason === "Unregistered" || reason === "BadDeviceToken" || reason === "DeviceTokenNotForTopic";
    if (reason === "ExpiredProviderToken" || reason === "InvalidProviderToken") apnsJwt = null;
    return { ok: false, gone, retry: !gone && (res.status === 429 || res.status >= 500 || reason === "ExpiredProviderToken"), error: `apns:${reason}` };
  } catch (e) {
    return { ok: false, gone: false, retry: true, error: `apns:${(e as Error).message}` };
  }
}

// FCM HTTP v1 ----------------------------------------------------------------------------------

export interface FcmConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export function fcmConfigFromEnv(): FcmConfig | null {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
    if (!sa.project_id || !sa.client_email || !sa.private_key) return null;
    return { projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key };
  } catch {
    return null;
  }
}

let fcmAccess: { token: string; exp: number } | null = null;

async function fcmAccessToken(cfg: FcmConfig): Promise<string> {
  if (fcmAccess && Date.now() < fcmAccess.exp - 60_000) return fcmAccess.token;
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(cfg.privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: cfg.clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    key,
    { name: "RSASSA-PKCS1-v1_5" },
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`fcm_oauth_${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  fcmAccess = { token: body.access_token, exp: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

export async function sendFcm(cfg: FcmConfig, deviceToken: string, msg: PushMessage): Promise<SendResult> {
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${cfg.projectId}/messages:send`, {
      method: "POST",
      headers: { authorization: `Bearer ${await fcmAccessToken(cfg)}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title: msg.title, body: msg.body },
          data: msg.data,
          android: { priority: "high", collapse_key: msg.kind, notification: { channel_id: "default" } },
        },
      }),
    });
    if (res.ok) return { ok: true };
    const err = ((await res.json().catch(() => ({}))) as {
      error?: { status?: string; details?: { errorCode?: string }[] };
    }).error;
    const code = err?.details?.find((d) => d.errorCode)?.errorCode ?? err?.status ?? `http_${res.status}`;
    if (res.status === 401) fcmAccess = null;
    const gone = res.status === 404 || code === "UNREGISTERED";
    return { ok: false, gone, retry: !gone && (res.status === 401 || res.status === 429 || res.status >= 500), error: `fcm:${code}` };
  } catch (e) {
    return { ok: false, gone: false, retry: true, error: `fcm:${(e as Error).message}` };
  }
}
