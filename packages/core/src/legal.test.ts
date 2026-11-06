import { describe, expect, it } from "vitest";
import { legalPublication, legalDocumentUrl, privacyRequestMailto } from "./legal";

describe("legal publication boundary", () => {
  it("does not enable purchases or links with only a domain or draft version", () => {
    for (const version of [undefined, "", "draft", "2026-11-06.0"]) expect(legalPublication("https://ginafamily.com", version)).toBeNull();
    expect(legalDocumentUrl(null, "gizlilik-politikasi", "tr")).toBeNull();
  });
  it("rejects untrusted origins, credentials and malformed roots", () => {
    for (const base of ["http://ginafamily.com", "https://ginafamily.com.evil.test", "https://evil.test", "https://user@ginafamily.com", "https://ginafamily.com:8443", "https://ginafamily.com/legal", "https://ginafamily.com?next=evil", "https://ginafamily.com/#draft"]) expect(legalPublication(base, "2026-11-06.1")).toBeNull();
  });
  it("builds only the approved origin's document URLs in the selected language", () => {
    const publication = legalPublication("https://ginafamily.com/", "2026-11-06.1");
    expect(legalDocumentUrl(publication, "gizlilik-politikasi", "en-US")).toBe("https://ginafamily.com/legal/gizlilik-politikasi?lang=en");
    expect(legalDocumentUrl(publication, "kullanim-kosullari", "tr-TR")).toBe("https://ginafamily.com/legal/kullanim-kosullari?lang=tr");
  });
  it("creates an email draft without embedding user data or a destructive action", () => {
    const url = new URL(privacyRequestMailto("deletion", "tr"));
    expect(url.protocol).toBe("mailto:");
    expect(url.pathname).toBe("destek@ginafamily.com");
    expect(url.searchParams.get("subject")).toBe("GINA hesap silme talebi");
    expect([...url.searchParams.keys()]).toEqual(["subject"]);
  });
});
