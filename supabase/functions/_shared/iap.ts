// Mağaza doğrulama ve abonelik yazma yardımcıları: iap-verify, iap-reconcile, apple-notifications
// ve google-rtdn aynı kodu kullanır. Bağımlılık yok; yalnız WebCrypto (Deno ve Node'da çalışır).
//
// Apple: StoreKit 2 JWS'leri (signedTransaction, signedRenewalInfo, signedPayload) x5c zinciriyle
// gelir. Zincir [yaprak, ara, kök] olmalı; kök gömülü Apple Root CA - G3 ile bayt bayt aynı olmalı;
// her sertifika bir üstüyle imzalı, Apple OID'leri yerinde ve geçerlilik tarihi tutmalı; JWS imzası
// yaprak anahtarla ES256 doğrulanır. (OCSP iptal kontrolü yapılmaz; App Store Server API anahtarı
// tanımlıysa durum ayrıca API'den tazelenir.)
// Google: purchaseToken yalnız Play Developer API'den (subscriptionsv2.get) okunan durumla işlenir.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { planForProduct, upsertSubscription, type SubscriptionUpsert } from "./entitlement.ts";

export type SubStatus = SubscriptionUpsert["status"];

/** HTTP koduyla birlikte taşınan, istemciye dönebilecek hata. */
export class IapError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  detail?: string;
  constructor(code: string, httpStatus = 400) {
    super(code);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

const env = (name: string): string | undefined => {
  const d = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno;
  return d?.env.get(name) ?? undefined;
};

export const APPLE_BUNDLE_ID = () => env("APPLE_BUNDLE_ID") ?? "com.enescevik.gina";
export const GOOGLE_PACKAGE_NAME = () => env("GOOGLE_PLAY_PACKAGE_NAME") ?? "com.enescevik.gina";

// ---------------------------------------------------------------------------------------------
// base64 / base64url
// ---------------------------------------------------------------------------------------------

export function b64ToBytes(b64: string): Uint8Array {
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const pad = norm + "===".slice((norm.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const utf8 = new TextEncoder();
/** TS 5.7+ Uint8Array<ArrayBufferLike> → BufferSource uyumu (WebCrypto çağrıları için). */
const bs = (u: Uint8Array) => u as unknown as BufferSource;
const strToB64Url = (s: string) => bytesToB64Url(utf8.encode(s));

function decodeJsonPart<T>(part: string): T {
  return JSON.parse(new TextDecoder().decode(b64ToBytes(part))) as T;
}

/** İmzayı doğrulamadan JWS gövdesini okur (yalnız günlük/ipucu için). */
export function peekJws<T>(jws: string): T | null {
  try {
    return decodeJsonPart<T>(jws.split(".")[1] ?? "");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Asgari DER/X.509 okuyucu
// ---------------------------------------------------------------------------------------------

interface Tlv {
  tag: number;
  start: number; // başlık dâhil
  contentStart: number;
  end: number;
}

function readTlv(buf: Uint8Array, pos: number): Tlv {
  if (pos + 2 > buf.length) throw new Error("der_eof");
  const tag = buf[pos];
  let len = buf[pos + 1];
  let hdr = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) throw new Error("der_len");
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + buf[pos + 2 + i];
    hdr += n;
  }
  const end = pos + hdr + len;
  if (end > buf.length) throw new Error("der_eof");
  return { tag, start: pos, contentStart: pos + hdr, end };
}

function children(buf: Uint8Array, parent: Tlv): Tlv[] {
  const out: Tlv[] = [];
  let p = parent.contentStart;
  while (p < parent.end) {
    const t = readTlv(buf, p);
    out.push(t);
    p = t.end;
  }
  return out;
}

function decodeOid(bytes: Uint8Array): string {
  const parts: number[] = [];
  let v = 0;
  for (let i = 0; i < bytes.length; i++) {
    v = v * 128 + (bytes[i] & 0x7f);
    if (!(bytes[i] & 0x80)) {
      if (parts.length === 0) {
        const first = v < 80 ? Math.floor(v / 40) : 2;
        parts.push(first, v - first * 40);
      } else parts.push(v);
      v = 0;
    }
  }
  return parts.join(".");
}

function decodeTime(buf: Uint8Array, t: Tlv): number {
  const s = new TextDecoder().decode(buf.subarray(t.contentStart, t.end));
  let year: number;
  let rest: string;
  if (t.tag === 0x17) {
    const yy = Number(s.slice(0, 2));
    year = yy >= 50 ? 1900 + yy : 2000 + yy;
    rest = s.slice(2);
  } else if (t.tag === 0x18) {
    year = Number(s.slice(0, 4));
    rest = s.slice(4);
  } else throw new Error("der_time");
  const [mo, d, h, mi, se] = [0, 2, 4, 6, 8].map((i) => Number(rest.slice(i, i + 2)));
  return Date.UTC(year, mo - 1, d, h, mi, se || 0);
}

const OID_EC_PUBLIC_KEY = "1.2.840.10045.2.1";
const CURVES: Record<string, { name: "P-256" | "P-384"; size: number }> = {
  "1.2.840.10045.3.1.7": { name: "P-256", size: 32 },
  "1.3.132.0.34": { name: "P-384", size: 48 },
};
const SIG_HASH: Record<string, "SHA-256" | "SHA-384"> = {
  "1.2.840.10045.4.3.2": "SHA-256",
  "1.2.840.10045.4.3.3": "SHA-384",
};
/** Yaprak (App Store imzalama) ve ara (Apple WWDR) sertifikalarında beklenen Apple uzantıları. */
const OID_APPLE_LEAF = "1.2.840.113635.100.6.11.1";
const OID_APPLE_INTERMEDIATE = "1.2.840.113635.100.6.2.1";

interface Cert {
  der: Uint8Array;
  tbs: Uint8Array;
  sigHash: "SHA-256" | "SHA-384";
  signature: Uint8Array; // DER ECDSA-Sig-Value
  issuer: Uint8Array;
  subject: Uint8Array;
  notBefore: number;
  notAfter: number;
  spki: Uint8Array;
  curve: { name: "P-256" | "P-384"; size: number };
  extensions: Set<string>;
}

function parseCert(der: Uint8Array): Cert {
  const root = readTlv(der, 0);
  const [tbsT, algT, sigT] = children(der, root);
  if (!tbsT || !algT || !sigT || sigT.tag !== 0x03) throw new Error("cert_format");
  const algOid = decodeOid(der.subarray(children(der, algT)[0].contentStart, children(der, algT)[0].end));
  const sigHash = SIG_HASH[algOid];
  if (!sigHash) throw new Error(`cert_sig_alg:${algOid}`);

  let fields = children(der, tbsT);
  if (fields[0]?.tag === 0xa0) fields = fields.slice(1); // version
  const [, , issuerT, validityT, subjectT, spkiT, ...rest] = fields; // serial, signature, ...
  const [nb, na] = children(der, validityT);
  const [spkiAlgT] = children(der, spkiT);
  const [keyOidT, curveOidT] = children(der, spkiAlgT);
  if (decodeOid(der.subarray(keyOidT.contentStart, keyOidT.end)) !== OID_EC_PUBLIC_KEY) throw new Error("cert_key_type");
  const curve = CURVES[decodeOid(der.subarray(curveOidT.contentStart, curveOidT.end))];
  if (!curve) throw new Error("cert_curve");

  const extensions = new Set<string>();
  const extWrap = rest.find((t) => t.tag === 0xa3);
  if (extWrap) {
    const [extSeq] = children(der, extWrap);
    for (const ext of children(der, extSeq)) {
      const [oidT] = children(der, ext);
      extensions.add(decodeOid(der.subarray(oidT.contentStart, oidT.end)));
    }
  }

  return {
    der,
    tbs: der.subarray(tbsT.start, tbsT.end),
    sigHash,
    signature: der.subarray(sigT.contentStart + 1, sigT.end), // ilk bayt: kullanılmayan bit sayısı
    issuer: der.subarray(issuerT.start, issuerT.end),
    subject: der.subarray(subjectT.start, subjectT.end),
    notBefore: decodeTime(der, nb),
    notAfter: decodeTime(der, na),
    spki: der.subarray(spkiT.start, spkiT.end),
    curve,
    extensions,
  };
}

/** DER ECDSA imzasını (SEQUENCE{r,s}) WebCrypto'nun beklediği r||s biçimine çevirir. */
function derSigToRaw(sig: Uint8Array, size: number): Uint8Array {
  const seq = readTlv(sig, 0);
  const [r, s] = children(sig, seq);
  const out = new Uint8Array(size * 2);
  for (const [i, t] of [r, s].entries()) {
    let v = sig.subarray(t.contentStart, t.end);
    while (v.length > size && v[0] === 0) v = v.subarray(1);
    if (v.length > size) throw new Error("sig_size");
    out.set(v, i * size + (size - v.length));
  }
  return out;
}

const equalBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

async function importEcKey(cert: Cert): Promise<CryptoKey> {
  return await crypto.subtle.importKey("spki", bs(cert.spki), { name: "ECDSA", namedCurve: cert.curve.name }, false, ["verify"]);
}

async function certSignedBy(child: Cert, parent: Cert): Promise<boolean> {
  if (!equalBytes(child.issuer, parent.subject)) return false;
  const key = await importEcKey(parent);
  return await crypto.subtle.verify(
    { name: "ECDSA", hash: child.sigHash },
    key,
    bs(derSigToRaw(child.signature, parent.curve.size)),
    bs(child.tbs),
  );
}

// ---------------------------------------------------------------------------------------------
// Apple JWS doğrulaması
// ---------------------------------------------------------------------------------------------

/**
 * Apple Root CA - G3 (herkese açık kök sertifika; https://www.apple.com/certificateauthority/).
 * SHA-256 parmak izi: 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79
 */
export const APPLE_ROOT_CA_G3_B64 =
  "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u" +
  "IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS" +
  "b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49" +
  "AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517" +
  "IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA" +
  "MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM" +
  "6BgD56KyKA==";

export interface AppleJwsOptions {
  /** Test için farklı kök (DER base64). Üretimde verilmez. */
  rootCertB64?: string;
  /** Sertifika geçerliliğinin kontrol edildiği an (ms); verilmezse gövdedeki signedDate, yoksa şimdi. */
  at?: number;
}

/** StoreKit 2 / ASSN V2 JWS'ini doğrular ve gövdesini döndürür; geçersizse IapError('invalid_jws', 422). */
export async function verifyAppleJws<T extends object>(jws: string, opts: AppleJwsOptions = {}): Promise<T> {
  const fail = (why: string): never => {
    throw Object.assign(new IapError("invalid_jws", 422), { detail: why });
  };
  const parts = jws.split(".");
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) fail("format");
  let header: { alg?: string; x5c?: string[] };
  let payload: T & { signedDate?: number };
  try {
    header = decodeJsonPart(parts[0]);
    payload = decodeJsonPart(parts[1]);
  } catch {
    return fail("json");
  }
  if (header.alg !== "ES256") fail("alg");
  if (!Array.isArray(header.x5c) || header.x5c.length !== 3) fail("x5c");

  let leaf: Cert, inter: Cert, root: Cert;
  try {
    [leaf, inter, root] = header.x5c!.map((c) => parseCert(b64ToBytes(c)));
  } catch {
    return fail("cert_parse");
  }
  if (!equalBytes(root.der, b64ToBytes(opts.rootCertB64 ?? APPLE_ROOT_CA_G3_B64))) fail("root");
  if (!leaf.extensions.has(OID_APPLE_LEAF)) fail("leaf_oid");
  if (!inter.extensions.has(OID_APPLE_INTERMEDIATE)) fail("intermediate_oid");

  const at = opts.at ?? (typeof payload.signedDate === "number" ? payload.signedDate : Date.now());
  for (const c of [leaf, inter, root]) if (at < c.notBefore || at > c.notAfter) fail("cert_validity");

  if (!(await certSignedBy(inter, root))) fail("intermediate_sig");
  if (!(await certSignedBy(leaf, inter))) fail("leaf_sig");
  if (leaf.curve.name !== "P-256") fail("leaf_curve");

  const key = await importEcKey(leaf);
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    bs(b64ToBytes(parts[2])),
    bs(utf8.encode(`${parts[0]}.${parts[1]}`)),
  );
  if (!ok) fail("signature");
  return payload;
}

/** JWSTransactionDecodedPayload (yalnız kullandığımız alanlar). */
export interface AppleTransaction {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  purchaseDate?: number;
  expiresDate?: number;
  type?: string;
  appAccountToken?: string;
  environment?: string; // Production | Sandbox | Xcode
  revocationDate?: number;
  revocationReason?: number;
  isUpgraded?: boolean;
  offerType?: number;
  signedDate?: number;
}

/** JWSRenewalInfoDecodedPayload. */
export interface AppleRenewalInfo {
  originalTransactionId?: string;
  autoRenewProductId?: string;
  autoRenewStatus?: number; // 1 açık, 0 kapalı
  isInBillingRetryPeriod?: boolean;
  gracePeriodExpiresDate?: number;
  expirationIntent?: number;
  environment?: string;
  signedDate?: number;
}

/** App Store Server API abonelik durumu: 1 aktif, 2 bitmiş, 3 billing retry, 4 grace, 5 iptal. */
export type AppleApiStatus = 1 | 2 | 3 | 4 | 5;

export interface StoreState {
  platform: "apple" | "google";
  storeKey: string; // Apple originalTransactionId / Google purchaseToken
  productId: string; // kanonik plan_products.product_id
  status: SubStatus;
  expiresAt: string;
  autoRenewing: boolean;
  /** İstemcinin satın almaya yazdığı aile kimliği (appAccountToken / obfuscatedExternalAccountId). */
  accountToken: string | null;
  /** Aynı store_key için daha eski bir durumun yenisini ezmemesi için sürüm (ms). */
  version?: number;
  /** Android plan değişiminde yerini aldığı eski purchaseToken. */
  replacesStoreKey?: string | null;
  raw: unknown;
}

/** Apple işlem + yenileme bilgisinden (ve varsa API durumundan) abonelik durumunu çıkarır. */
export function appleState(
  tx: AppleTransaction,
  renewal: AppleRenewalInfo | null,
  apiStatus: AppleApiStatus | null = null,
  now = Date.now(),
): StoreState {
  if (tx.bundleId !== APPLE_BUNDLE_ID()) throw new IapError("bundle_mismatch", 422);
  if (!tx.expiresDate) throw new IapError("not_a_subscription", 422);
  let status: SubStatus;
  let expires = tx.expiresDate;
  const graceUntil = renewal?.gracePeriodExpiresDate ?? 0;
  if (apiStatus === 5 || tx.revocationDate) status = "revoked";
  else if (apiStatus === 4 || (graceUntil > now && tx.expiresDate <= now)) {
    status = "grace";
    expires = Math.max(graceUntil, tx.expiresDate);
  } else if (apiStatus === 1 || (apiStatus === null && tx.expiresDate > now)) status = "active";
  else if (apiStatus === 3 || renewal?.isInBillingRetryPeriod) status = "on_hold";
  else status = "expired";
  return {
    platform: "apple",
    storeKey: tx.originalTransactionId,
    productId: tx.productId,
    status,
    expiresAt: new Date(expires).toISOString(),
    autoRenewing: renewal ? renewal.autoRenewStatus === 1 : status === "active",
    accountToken: tx.appAccountToken ? tx.appAccountToken.toLowerCase() : null,
    version: tx.purchaseDate ?? tx.signedDate,
    raw: { transaction: tx, renewal, apiStatus },
  };
}

// ---------------------------------------------------------------------------------------------
// App Store Server API (anahtar tanımlıysa)
// ---------------------------------------------------------------------------------------------

function pemBody(pem: string): Uint8Array {
  return b64ToBytes(pem.replace(/-----[^-]+-----/g, "").replace(/\\n/g, ""));
}

export function appleApiConfigured(): boolean {
  return !!(env("APPLE_IAP_KEY_ID") && env("APPLE_IAP_ISSUER_ID") && env("APPLE_IAP_KEY_P8"));
}

async function appleApiToken(): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    bs(pemBody(env("APPLE_IAP_KEY_P8")!)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const iat = Math.floor(Date.now() / 1000);
  const head = strToB64Url(JSON.stringify({ alg: "ES256", kid: env("APPLE_IAP_KEY_ID"), typ: "JWT" }));
  const body = strToB64Url(
    JSON.stringify({ iss: env("APPLE_IAP_ISSUER_ID"), iat, exp: iat + 600, aud: "appstoreconnect-v1", bid: APPLE_BUNDLE_ID() }),
  );
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, bs(utf8.encode(`${head}.${body}`))));
  return `${head}.${body}.${bytesToB64Url(sig)}`;
}

interface AppleStatusResponse {
  data?: {
    lastTransactions?: {
      originalTransactionId: string;
      status: AppleApiStatus;
      signedTransactionInfo: string;
      signedRenewalInfo: string;
    }[];
  }[];
}

/**
 * Get All Subscription Statuses: originalTransactionId'nin güncel durumunu Apple'dan çeker.
 * Ortam bilinmiyorsa önce üretim, 404'te sandbox denenir.
 */
export async function fetchAppleState(originalTransactionId: string, environment?: string): Promise<StoreState | null> {
  const token = await appleApiToken();
  const hosts =
    environment === "Sandbox"
      ? ["https://api.storekit-sandbox.itunes.apple.com"]
      : environment === "Production"
        ? ["https://api.storekit.itunes.apple.com"]
        : ["https://api.storekit.itunes.apple.com", "https://api.storekit-sandbox.itunes.apple.com"];
  for (const host of hosts) {
    const res = await fetch(`${host}/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 404) continue;
    if (!res.ok) throw new IapError(`apple_api_${res.status}`, 502);
    const body = (await res.json()) as AppleStatusResponse;
    const last = body.data
      ?.flatMap((g) => g.lastTransactions ?? [])
      .find((t) => t.originalTransactionId === originalTransactionId);
    if (!last) return null;
    const tx = await verifyAppleJws<AppleTransaction>(last.signedTransactionInfo);
    const renewal = last.signedRenewalInfo ? await verifyAppleJws<AppleRenewalInfo>(last.signedRenewalInfo) : null;
    return appleState(tx, renewal, last.status);
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Google Play Developer API
// ---------------------------------------------------------------------------------------------

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export function googleApiConfigured(): boolean {
  return !!env("GOOGLE_PLAY_SA_KEY");
}

let googleToken: { value: string; exp: number } | null = null;

async function googleAccessToken(): Promise<string> {
  if (googleToken && googleToken.exp > Date.now() + 60_000) return googleToken.value;
  const sa = JSON.parse(env("GOOGLE_PLAY_SA_KEY")!) as ServiceAccount;
  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const key = await crypto.subtle.importKey(
    "pkcs8",
    bs(pemBody(sa.private_key)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const iat = Math.floor(Date.now() / 1000);
  const head = strToB64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = strToB64Url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: tokenUri,
      iat,
      exp: iat + 3600,
    }),
  );
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, bs(utf8.encode(`${head}.${body}`))));
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${head}.${body}.${bytesToB64Url(sig)}`,
    }),
  });
  if (!res.ok) throw new IapError(`google_oauth_${res.status}`, 502);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  googleToken = { value: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

/** SubscriptionPurchaseV2 (yalnız kullandığımız alanlar). */
export interface GoogleSubscriptionV2 {
  subscriptionState?: string;
  acknowledgementState?: string;
  linkedPurchaseToken?: string;
  testPurchase?: unknown;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  lineItems?: {
    productId: string;
    expiryTime?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
    offerDetails?: { basePlanId?: string; offerId?: string };
  }[];
}

const androidApi = (path: string) =>
  `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(GOOGLE_PACKAGE_NAME())}/purchases/${path}`;

export async function fetchGoogleSubscription(purchaseToken: string): Promise<GoogleSubscriptionV2> {
  const res = await fetch(androidApi(`subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`), {
    headers: { authorization: `Bearer ${await googleAccessToken()}` },
  });
  if (res.status === 404 || res.status === 410 || res.status === 400) throw new IapError("invalid_purchase_token", 422);
  if (!res.ok) throw new IapError(`google_api_${res.status}`, 502);
  return (await res.json()) as GoogleSubscriptionV2;
}

/** Aboneliği onaylar (acknowledge); 3 gün içinde onaylanmayan satın alma Google tarafından iade edilir. */
export async function acknowledgeGoogle(subscriptionId: string, purchaseToken: string): Promise<void> {
  const res = await fetch(
    androidApi(`subscriptions/${encodeURIComponent(subscriptionId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`),
    {
      method: "POST",
      headers: { authorization: `Bearer ${await googleAccessToken()}`, "content-type": "application/json" },
      body: "{}",
    },
  );
  if (!res.ok && res.status !== 409) throw new IapError(`google_ack_${res.status}`, 502);
}

/** Android (abonelik, base plan) çiftini kanonik plan_products.product_id'ye çevirir. */
export async function canonicalAndroidProduct(db: SupabaseClient, subscriptionId: string, basePlanId: string): Promise<string> {
  const { data, error } = await db
    .from("plan_products")
    .select("product_id")
    .eq("android_product_id", subscriptionId)
    .eq("android_base_plan_id", basePlanId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new IapError(`unknown_product:${subscriptionId}/${basePlanId}`, 422);
  return data.product_id as string;
}

export const GOOGLE_PENDING_STATES = new Set(["SUBSCRIPTION_STATE_PENDING", "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED"]);

/**
 * subscriptionsv2 yanıtını duruma çevirir. Bekleyen (PENDING) ödemede null döner: yetki verilmez.
 * `revoked`: RTDN SUBSCRIPTION_REVOKED (12) geldiğinde zorlanır.
 */
export async function googleState(
  db: SupabaseClient,
  purchaseToken: string,
  sub: GoogleSubscriptionV2,
  opts: { revoked?: boolean } = {},
): Promise<StoreState | null> {
  const state = sub.subscriptionState ?? "SUBSCRIPTION_STATE_UNSPECIFIED";
  if (GOOGLE_PENDING_STATES.has(state)) return null;
  const item = sub.lineItems?.[0];
  if (!item?.offerDetails?.basePlanId) throw new IapError("not_a_subscription", 422);
  const productId = await canonicalAndroidProduct(db, item.productId, item.offerDetails.basePlanId);
  const expiresMs = item.expiryTime ? Date.parse(item.expiryTime) : Date.now();
  const map: Record<string, SubStatus> = {
    SUBSCRIPTION_STATE_ACTIVE: "active",
    SUBSCRIPTION_STATE_CANCELED: expiresMs > Date.now() ? "active" : "expired", // iptal edildi ama süre bitmedi
    SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "grace",
    SUBSCRIPTION_STATE_ON_HOLD: "on_hold",
    SUBSCRIPTION_STATE_PAUSED: "on_hold",
    SUBSCRIPTION_STATE_EXPIRED: "expired",
  };
  return {
    platform: "google",
    storeKey: purchaseToken,
    productId,
    status: opts.revoked ? "revoked" : (map[state] ?? "expired"),
    expiresAt: new Date(expiresMs).toISOString(),
    autoRenewing: item.autoRenewingPlan?.autoRenewEnabled === true,
    accountToken: sub.externalAccountIdentifiers?.obfuscatedExternalAccountId?.toLowerCase() ?? null,
    replacesStoreKey: sub.linkedPurchaseToken ?? null,
    raw: { subscription: sub, androidProductId: item.productId },
  };
}

/** Google'dan okuyup gerekirse onaylar; tek çağrıda tam akış. */
export async function refreshGoogle(
  db: SupabaseClient,
  purchaseToken: string,
  opts: { revoked?: boolean } = {},
): Promise<StoreState | null> {
  const sub = await fetchGoogleSubscription(purchaseToken);
  const state = await googleState(db, purchaseToken, sub, opts);
  const item = sub.lineItems?.[0];
  if (
    state &&
    item &&
    sub.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING" &&
    (state.status === "active" || state.status === "grace")
  ) {
    await acknowledgeGoogle(item.productId, purchaseToken);
  }
  return state;
}

// ---------------------------------------------------------------------------------------------
// Pub/Sub OIDC (google-rtdn)
// ---------------------------------------------------------------------------------------------

let googleJwks: { keys: (JsonWebKey & { kid?: string })[]; exp: number } | null = null;

/** Pub/Sub push isteğinin Authorization: Bearer OIDC JWT'sini doğrular. */
export async function verifyGoogleOidc(authHeader: string | null, audience: string, email?: string): Promise<boolean> {
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const header = decodeJsonPart<{ alg?: string; kid?: string }>(parts[0]);
    const claims = decodeJsonPart<{ iss?: string; aud?: string; exp?: number; email?: string; email_verified?: boolean }>(parts[1]);
    if (header.alg !== "RS256") return false;
    if (!googleJwks || googleJwks.exp < Date.now()) {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/certs");
      googleJwks = { keys: ((await res.json()) as { keys: (JsonWebKey & { kid?: string })[] }).keys, exp: Date.now() + 3600_000 };
    }
    const jwk = googleJwks.keys.find((k) => k.kid === header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, bs(b64ToBytes(parts[2])), bs(utf8.encode(`${parts[0]}.${parts[1]}`)));
    if (!ok) return false;
    if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") return false;
    if (claims.aud !== audience) return false;
    if (!claims.exp || claims.exp * 1000 < Date.now()) return false;
    if (email && (claims.email !== email || claims.email_verified !== true)) return false;
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// Tek yazma yolu
// ---------------------------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface ApplyContext {
  /** iap-verify: çağıran velinin ailesi. Bildirim/uzlaştırmada verilmez. */
  callerFamilyId?: string;
  purchaserUserId?: string | null;
}

export interface ApplyResult {
  familyId: string;
  productId: string;
  plan: string;
  status: SubStatus;
  expiresAt: string;
  skipped?: "stale";
}

/**
 * Mağaza durumunu ailenin store_subscriptions satırına yazar (iap-verify, iap-reconcile,
 * apple-notifications, google-rtdn hepsi bunu çağırır).
 * Aile eşlemesi: mevcut satır > accountToken (families.id) > çağıran veli.
 * Başka aileye bağlı bir işlem başka bir aileye taşınamaz (409 account_mismatch).
 */
export async function applyStoreState(db: SupabaseClient, state: StoreState, ctx: ApplyContext = {}): Promise<ApplyResult> {
  const plan = await planForProduct(db, state.productId).catch(() => {
    throw new IapError(`unknown_product:${state.productId}`, 422);
  });

  const { data: existing, error: exErr } = await db
    .from("store_subscriptions")
    .select("family_id, purchaser_user_id, raw, status, expires_at, product_id")
    .eq("store_key", state.storeKey)
    .maybeSingle();
  if (exErr) throw exErr;

  const token = state.accountToken && UUID_RE.test(state.accountToken) ? state.accountToken : null;
  let familyId: string | null;
  if (ctx.callerFamilyId) {
    if (token && token !== ctx.callerFamilyId) throw new IapError("account_mismatch", 409);
    if (existing && existing.family_id !== ctx.callerFamilyId) throw new IapError("account_mismatch", 409);
    familyId = ctx.callerFamilyId;
  } else if (existing) {
    familyId = existing.family_id as string;
  } else if (token) {
    const { data: fam } = await db.from("families").select("id").eq("id", token).maybeSingle();
    familyId = (fam?.id as string | undefined) ?? null;
  } else familyId = null;
  if (!familyId) throw new IapError("family_not_found", 404);

  const prevVersion = (existing?.raw as { version?: number } | null)?.version;
  if (prevVersion && state.version && state.version < prevVersion) {
    return {
      familyId,
      productId: existing!.product_id as string,
      plan: await planForProduct(db, existing!.product_id as string),
      status: existing!.status as SubStatus,
      expiresAt: existing!.expires_at as string,
      skipped: "stale",
    };
  }

  await upsertSubscription(db, {
    familyId,
    purchaserUserId: ctx.purchaserUserId ?? (existing?.purchaser_user_id as string | null) ?? null,
    platform: state.platform,
    productId: state.productId,
    storeKey: state.storeKey,
    status: state.status,
    expiresAt: state.expiresAt,
    autoRenewing: state.autoRenewing,
    raw: { version: state.version ?? null, ...(state.raw as object) },
  });

  // Android plan değişimi: eski token artık yetki vermez.
  if (state.replacesStoreKey) {
    await db
      .from("store_subscriptions")
      .update({ status: "expired", auto_renewing: false })
      .eq("store_key", state.replacesStoreKey)
      .eq("family_id", familyId);
  }

  return { familyId, productId: state.productId, plan, status: state.status, expiresAt: state.expiresAt };
}
