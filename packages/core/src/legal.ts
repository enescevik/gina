/** Only a reviewed, same-site publication may enable legal links and purchases. */
export const LEGAL_DOCUMENTS = ["gizlilik-politikasi", "kvkk-aydinlatma-metni", "kullanim-kosullari", "abonelik-kosullari", "cerez-politikasi", "hesap-ve-veri-silme", "kvkk-basvuru-formu"] as const;
export type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];
export function legalPublication(base: string | undefined, version: string | undefined): { base: string; version: string } | null {
  if (!base || !version || !/^\d{4}-\d{2}-\d{2}\.[1-9]\d*$/.test(version)) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || url.hostname !== "ginafamily.com" || url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return { base: url.origin, version };
  } catch { return null; }
}
export function legalDocumentUrl(publication: ReturnType<typeof legalPublication>, document: LegalDocument, locale: string): string | null {
  if (!publication || !LEGAL_DOCUMENTS.includes(document)) return null;
  return `${publication.base}/legal/${document}?lang=${locale.toLowerCase().split(/[-_]/)[0] === "en" ? "en" : "tr"}`;
}
export function privacyRequestMailto(kind: "privacy" | "deletion", locale: string): string {
  const english = locale.toLowerCase().startsWith("en");
  const subject = kind === "deletion" ? (english ? "GINA account deletion request" : "GINA hesap silme talebi") : (english ? "GINA personal data request" : "GINA kişisel veri başvurusu");
  return `mailto:destek@ginafamily.com?subject=${encodeURIComponent(subject)}`;
}
