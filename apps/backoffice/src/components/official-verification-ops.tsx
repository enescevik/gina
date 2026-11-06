import { useState } from "react";

/**
 * C01 — resmî kaynak doğrulaması (exam_blueprints.official_source_verified).
 * Sunucu sözleşmesi: yalnız `service_role` ve yalnız katalog kopyasında (`distribution_kind='school_catalogue'`)
 * işaretlenir; yönetici JWT'si (authenticated) ile `blueprint_provenance_locked` döner ve bunun için RPC yoktur.
 * Backoffice service_role anahtarı taşımaz, aile kopyalarını da okuyamaz. Bu nedenle bu bölüm salt okunurdur:
 * işletim adımını seçili senaryo sürümüyle doldurulmuş olarak gösterir; hiçbir istek göndermez.
 */
export function officialVerificationSql(catalogueId: string, revision: number) {
  const id = /^[0-9a-f-]{36}$/i.test(catalogueId) ? catalogueId : "<katalog-id>";
  const rev = Number.isInteger(revision) && revision > 0 ? String(revision) : "<revizyon>";
  const where = `where distribution_kind = 'school_catalogue'
  and school_confirmed
  and source_context->>'catalogue_id' = '${id}'
  and source_context->>'revision' = '${rev}'
  and not official_source_verified`;
  return `-- 1) Önizleme (yazmaz): bu senaryo sürümünün doğrulanmamış aile kopyası sayısı
select count(*) from public.exam_blueprints
${where};

-- 2) İşaretle: yalnız service_role; okul onayı, ad, satırlar, sınav/puan değişmez
begin;
set local role service_role;
update public.exam_blueprints
   set official_source_verified = true, official_verified_at = now()
${where};
commit;`;
}

export function OfficialVerificationOps(
  { candidate }: {
    candidate: { id: string; revision: number; label: string; status: string } | null;
  },
) {
  const [copied, setCopied] = useState(false);
  const command = candidate
    ? officialVerificationSql(candidate.id, candidate.revision)
    : null;
  return (
    <details
      className="my-5 rounded-3xl border border-[#e5dcf3] bg-white p-5"
      data-testid="official-verification-ops"
    >
      <summary className="cursor-pointer font-bold">
        Resmî kaynak doğrulaması (işletim adımı)
      </summary>
      <div className="mt-3 space-y-3 text-sm">
        <p>
          Okul onayı ile resmî kaynak doğrulaması ayrıdır. Veli katalogdan
          “okulumun senaryosu” diye seçince kopya <strong>okul onaylı</strong>{" "}
          olur; resmî doğrulama ise yalnız sunucu (service_role) tarafından ve
          yalnız katalog kopyalarında işaretlenir.
        </p>
        <p>
          Bu panel <strong>salt okunurdur</strong>: yönetici oturumuyla
          işaretleme yapılamaz (sunucu <code>blueprint_provenance_locked</code>{" "}
          döner) ve aile kopyaları burada listelenmez. İşaretleme, üretim
          veritabanına erişimi olan işletim sorumlusunun aşağıdaki komutu
          çalıştırmasıyla yapılır; önce önizleme sayısı kontrol edilir.
        </p>
        {candidate
          ? (
            <>
              <p>
                Seçili senaryo: <strong>{candidate.label}</strong> · revizyon{" "}
                {candidate.revision}
                {candidate.status === "published"
                  ? ""
                  : " · katalogda açık değil (kopyası olmayabilir)"}
              </p>
              <pre
                className="max-w-full overflow-x-auto whitespace-pre rounded-2xl bg-slate-900 p-4 text-xs text-slate-100"
                aria-label="İşletim komutu"
              >
                {command}
              </pre>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(command!).then(
                    () => setCopied(true),
                    () => setCopied(false),
                  );
                }}
              >
                {copied ? "Kopyalandı" : "Komutu kopyala"}
              </button>
            </>
          )
          : (
            <p>
              Komutu görmek için listeden bir senaryo seçin.
            </p>
          )}
        <p>
          Komut yalnız seçili sürümün kopyalarını işaretler; daha eski
          sürümlerin kopyaları ayrı komutla ve ayrı kontrolle işaretlenir.
          Veli tarafında “Resmî kaynakla doğrulandı” satırı bir sonraki
          yenilemede görünür.
        </p>
      </div>
    </details>
  );
}
