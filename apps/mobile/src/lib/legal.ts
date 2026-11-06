import { legalPublication, legalDocumentUrl, type LegalDocument } from "@gina/core";
// Set only after the approved documents are published and checked. No default approval.
export const publishedLegal = legalPublication(process.env.EXPO_PUBLIC_LEGAL_BASE_URL, process.env.EXPO_PUBLIC_LEGAL_VERSION);
export const legalUrl = (document: LegalDocument, locale: string) => legalDocumentUrl(publishedLegal, document, locale);
