# M01 — OYSS kaynak edinme, sürümleme ve soru→çıktı izi (gece raporu)

6 Kasım 2026, 00:10 Europe/Istanbul. Ajan: Claude Fable 5.1 (gece M01 geliştirme ajanı). Kaynak commit: main `de969c1`. Çalışma dalı: `worktree-agent-a7dd597271aa7c733` (ayrı worktree; **main'e push edilmedi**, PR açılmadı). Üretim Supabase'e dokunulmadı; yerel demo DB sıfırlanmadı; gerçek ücretli AI çağrısı yapılmadı; katalog yayımlanmadı; soru üretilmedi; okul seçimi varsayılmadı; "MEB onaylı" iddiası eklenmedi.

Durum: **KOD HAZIR / YEREL TEST EDİLDİ** — yayımlanmadı. Migration gerekti: evet, tek dosya `supabase/migrations/20261106010000_curriculum_source_fetch.sql`.

## Commit listesi (eskiden yeniye)

| Commit | İçerik |
|---|---|
| `b62f85a` | `scripts/fetch-curriculum-sources.py` (edinme/sürümleme politikası), canlı hash kontrolü manifest + verification'a işlendi, `test-meb-scenarios.py` +11 test |
| `1ed69fe` | Migration `20261106010000_curriculum_source_fetch.sql`, pgTAP `087_curriculum_source_fetch.test.sql` (54 kontrol), `scripts/test-curriculum-source-fetch.py --run-local` |
| `e7b5148` | Edge Function `supabase/functions/curriculum-source-fetch/` (+ `_shared/curriculum-source.ts`, `readAdmin`), Deno testleri, config.toml / README / CI kaydı |
| `9ea5251` | Provenance genişletmesi: `catalogue-plan.ts`, `generation-result.ts`, `prova-generate/index.ts` (şema/prompt v5), Deno testleri +8 |
| `87d43e9` | `packages/core` şemaları + RPC tipleri, backoffice `curriculum-review.tsx` kaynak sürüm paneli, mobil `parent/prova/catalog.tsx` güncellik satırı, TR/EN anahtarlar |
| `8581fce` | `--extract-revisions`: bekleyen sürümleri mevcut Python çıkarıcıyla ayrı dosyaya çıkarma; OUTCOME-INDEX canlı kontrol notu |
| (bu rapor) | `docs/release/overnight-2026-11-06/M01-REPORT.md` |

30 dosya, +2823/−38 satır.

## Canlı hash karşılaştırması (gerçekten yapıldı)

Komut: `python3 scripts/fetch-curriculum-sources.py docs/learning/catalog/2026-2027-term1` — 2026-11-05T20:26:33Z (UTC).

- Resmî dizin `https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724` → HTTP 200, 44 bağlantı, sayfadaki yayın tarihi **07.09.2026**, güncelleme **10.09.2026**.
- Manifest'teki 16 `meb.ai/ankmebN` bağlantısının her biri dizin sayfasında mevcut; her biri 302 ile `https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/<dosya>.xlsx` adresine gitti (zincir: `[302, 200]`), çözümlenen URL manifest ile aynı.
- **16/16 dosyada SHA-256 ve bayt sayısı depodaki kopya ile aynı** (`unchanged: 16, new_revision: 0, unverified: 0`). Örnek: `ilkmat2.xlsx` `d5429b5962a0…` 23.454 bayt; `turkce2.xlsx` `6405d02aaaad…` 31.410 bayt.
- ZIP dizin denetimi: hiçbir dosyada makro yok; `sosyal2.xlsx` ve `cografya4.xlsx` içinde `xl/externalLinks/` parçası var → `external_links_present` bayrağı (yalnız kaydedildi; hiçbir bağlantı takip edilmedi, formül çalıştırılmadı).
- Kayıt: `sources/manifest.json` her girdiye `last_checked_at` + `freshness: {status: "verified", last_approved_sha256}` eklendi (eski alanlar ve dosyalar değişmedi; çıkarıcı aynı girdiyi okur). `verification.json` → `live_checks[0]` (tarih, dizin tarihleri, 16 sonuç). Hash değişimi olmadığı için yeni revizyon oluşmadı; değişseydi `revisions[]` altında `diff_review_required` olarak eklenir, onaylı dosya/hash silinmezdi (testle kanıtlı).

Bu kontrol dosya bütünlüğü kanıtıdır; 648 adayın editoryal onayı veya yayını anlamına gelmez.

## Yapılanlar (protokol maddeleriyle)

**1. Kaynak edinme/sürümleme işi.** `curriculum-source-fetch` Edge Function (admin JWT; `readAdmin`: canlı Auth kullanıcısı + `gina.admin` claim + `public.admins` satırı). Girdi `target {exam_family, school_year, term, exam_no?, grade?, subject, programme?, link_url?}` + `request_id`. Akış: bilinen resmî dizin → sayfa okuma → ders bağlantısı (metin eşleşmesi; ortaokul/lise İngilizce gibi çift eşleşmede **tahmin yok**, `ambiguous_subject_link` ile adaylar döner; açık `link_url` yalnız sayfada geçen bağlantı olabilir) → her hop'ta host + çözümlenen IP denetimi → indirme (15 s, 5 MB) → yalnız ZIP merkez dizini okunarak denetim (girdi ≤500, açılma ≤40 MB, `..`/mutlak yol reddi, `xl/workbook.xml` zorunlu, makro/haricî link bayrağı) → SHA-256 → özel bucket `gina-curriculum-sources` → `record_curriculum_source_fetch`. İzinli hostlar: `odsgm.meb.gov.tr`, `*.meb.gov.tr`, `cdn.eba.gov.tr`; `meb.ai` yalnız yönlendirme adımı. HTTP, kullanıcı bilgisi/port, loopback/özel/link-local/multicast/IPv4-mapped/benzersiz-yerel adresler reddedilir. Sayfa ve belge içeriği veri sayılır. Aynı politika Python tarafında da uygulanır (`scripts/fetch-curriculum-sources.py`).

**2. Revizyon kuralı (SQL).** `gina.curriculum_sources` (kaynak başına güncellik durumu: `verified|unverified|pending_review|diff_review_required|withdrawn`), `gina.curriculum_source_revisions` (hash başına tek satır; `unique(source_id,sha256)`), `gina.curriculum_fetch_commands` (makbuz). Aynı hash → yalnız `last_checked_at`; yeni hash → onaylı kopya varsa `diff_review_required`, yoksa `pending_review`, `extraction_status='queued'`; ağ/politika hatası → `unverified` + son onaylı kopyanın tarihi. `admin_review_curriculum_source_revision` approve/withdraw/dismiss; withdraw aynı hash'in yayımlı adaylarını `withdrawn` yapar (yeni seçim/üretim durur), **`exam_blueprints` ve `catalog_blueprint_links` snapshot'ı değişmez** (pgTAP ile doğrulandı). Veli için `get_curriculum_source_freshness` → durum, son kontrol, son onaylı tarih/hash, `alternative: "free_study"`, `officially_verified: false`; bilinmeyen yıl/dönem → `unpublished`, başka yıl seçilmez.

**3. Çıkarıcı ile bağ.** Daha az riskli yol seçildi: Deno'ya taşıma yapılmadı; sunucu işi revizyonu kaydedip çıkarmayı kuyruğa alır (`extraction_status='queued'`), Python tarafı `--extract-revisions` ile bekleyen sürümleri mevcut `extract-meb-scenarios.py` mantığıyla ayrı `scenario-candidates.<hash12>.json` (publishable=false) dosyasına çıkarır; onaylı `scenario-candidates.json` üzerine yazılmaz.

**4. Provenance genişletmesi.** `cataloguePlan` artık `scenario {scenario_version, catalogue_id, revision, content_hash, source{url,sha256,sheet,header_cell}, blocks[{block_id, topic, count, outcome_ids, source_cells}]}` ve her blok için `normalized_text` üretir; `outcome_id` = resmî kod, yoksa `cell:<hücre>`. `GeneratedQuestion` opsiyonel `block_id, outcome_ids[], question_type, cognitive_demand, intended_difficulty, rubric{criteria[{text,points}], alternative_answers[]}, shared_source_id`; çıktı seviyesinde `shared_sources[]`. Doğrulayıcı: katalog bağlı işte blok eşleşmesi, çıktı kümesi üyeliği (boş küme ret), tür/kind tutarlılığı, bilişsel talep/güçlük sözlükleri, açık uçluda rubrik zorunlu; birleşik blok sayısı çıktı sayısıyla çarpılmaz (fazla soru ret); ortak metin tek kimlik, kullanılmayan/yinelenen/sarkan kimlik ret. Provenance satırına `scenario_version, catalogue_id, catalogue_revision, source_sha256, source_sheet, block_id, source_cells, outcome_ids, question_type, cognitive_demand, intended_difficulty, rubric, shared_source(_id), content_fit: "pending_human_review"` eklendi (kod etiketi içerik uygunluğu sayılmaz). Geriye uyumlu: senaryo yokken alanlar opsiyonel, eski çıktılar geçerli (test). `prova-generate` şeması/promtu `v5-scenario-provenance`; AI'ya URL değil normalize blok/çıktı metninin gittiği `catalogue-plan.test.ts` içinde `senaryo_kapsami` serileştirmesiyle kanıtlandı. Ek: `planPoolSelection` — 20'lik havuzdan 7'lik senaryo seçimi, eksik çıktı/adet açık raporlanır, dolgu yapılmaz.

**UI (asgari).** Backoffice `curriculum-review.tsx`: salt okunur "Kaynak güncelliği ve sürümleri" paneli (durum, son kontrol, onaylı hash/tarih, sürüm listesi, çıkarma durumu, bayraklar, resmî bağlantı). Mobil `parent/prova/catalog.tsx`: kapsam özetinin altında güncellik satırı (doğrulandı / doğrulanamadı + son onaylı tarih / fark incelemesi bekliyor / geri çekildi / yayımlanmamış) ve `serbest çalışma` notu. Başka ekran değişmedi.

## Test çıktıları (gerçek çalıştırmalar)

- **Python** `python3 scripts/test-meb-scenarios.py` → `Ran 16 tests … OK` (4 eski + 12 yeni: HTTPS/host, meb.ai yalnız hop, özel/loopback/link-local/mapped IP (hop başına), yabancı/HTTP yönlendirme, döngü, boyut, ZIP sınırları/format, sayfa metni veri, aynı hash → yalnız last_checked_at, yeni hash → eskiyi silmeden revizyon, tekrar → çift revizyon yok, ağ hatası → unverified, bilinmeyen dönem → URL yok, depo manifest'i tarihli kontrol taşır, bekleyen sürüm çıkarımı). `test-curriculum-candidates.py` → 9 OK; `test-curriculum-review.py` → 4 OK.
- **Deno** CI listesi + yeni dosyalar: `deno test … (24 dosya)` → **194 passed, 0 failed**. Yeni/genişletilen: `_shared/curriculum-source.test.ts` 6, `curriculum-source-fetch/handler.test.ts` 7 (403 → ağ/DB yok; admin token; unpublished/grade_out_of_scope → fetch yok; mutlu yol + tekrar; belirsiz bağlantı; politika hataları → unverified; DB 403/409/500), `catalogue-plan.test.ts` +3, `generation-result.test.ts` +5. `deno check` prova-generate, curriculum-source-fetch, learning-source temiz.
- **pgTAP** `python3 scripts/test-curriculum-source-fetch.py --run-local` (boş `gina_completion_audit` şablonundan geçici DB, tüm migration'lar uygulanır, sonunda silinir): `056` 46 ok, `057` 43 ok, **`087` 54 ok**; yarış testleri: aynı hash eş zamanlı iki makbuz → `["unchanged","new_revision"]`, tek revizyon, tek audit kaydı; farklı hash'ler eş zamanlı → ikisi de kaydedildi, hiçbiri onaylanmadı.
- **TypeScript/Vitest**: `packages/core` vitest 260/260 (40 dosya), `tsc` temiz; `apps/backoffice` `tsc --noEmit` temiz (önceden var olan `globals.css` typegen uyarısı dışında), eslint temiz; `apps/mobile` `tsc --noEmit` temiz, eslint temiz.

Kabul maddeleri eşlemesi: 1 (doğru yıl/dönem/sınıf/ders; bilinmeyen okul) → handler/pgTAP; 2 (eksik dosya, ağ, yeni hash, geri çekme; eski sınav sabit) → pgTAP 087 + Python; 3 (birleşik blok, 20→7 seçim, yanlış adet/tür) → catalogue-plan/generation-result testleri; 4 (blok/çıktı/rubrik izi; kod etiketi ≠ uygunluk) → generation-result testleri + `content_fit`; 5 (manuel kaynak yükseltilemez, roller, eşzamanlılık) → mevcut testler + 087 + yarış scripti; 6 (SSRF, boyut/ZIP, format, talimat, tekrar) → Deno + Python + 087. **7 (telefon/tablet fiziksel önizleme) yapılmadı.**

## Kalan sınırlar (yapılmadı / doğrulanmadı)

1. **Yayın yok.** Migration üretime uygulanmadı, Edge Function deploy edilmedi, bucket üretimde yok. Canlı indirme yalnız Python scriptiyle bu makineden yapıldı; Edge Function gerçek ağa karşı çalıştırılmadı.
2. **Supabase edge runtime'da `Deno.resolveDns`** desteği doğrulanmadı. Çözücü başarısızsa fonksiyon **fail-closed** (`dns_failed` → `unverified` makbuzu) davranır; deploy sonrası tek çağrıyla doğrulanmalı. IP kontrolü ile bağlantı arasında küçük bir DNS yeniden bağlama penceresi kalır (bağlantı IP'ye sabitlenmez).
3. **Prompt/şema v5** canlı üretimi etkiler: `prova-generate` artık yeni alanları şemada zorunlu ister (boş değer kabul edilir; katalog bağlı işte doğrulanır). Gerçek sağlayıcıyla denenmedi (ücretli çağrı yok). Mevcut sistem promptundaki "bağlı soru üretme" kuralı ile ortak metin desteği yan yana duruyor; ortak kaynak yalnız senaryo gerektirdiğinde kullanılmalı.
4. **Anlamsal uygunluk** (soru gerçekten çıktıyı ölçüyor mu, çözüm doğru mu) otomatikleştirilmedi; provenance `content_fit: "pending_human_review"` ile açık bırakıldı. AI ikinci göz/insan inceleme akışı yok.
5. **Backoffice paneli salt okunur**; onay/geri çekme/reddetme yalnız `admin_review_curriculum_source_revision` RPC ile (UI düğmesi yok). Edge Function'ı tetikleyen yönetici düğmesi de yok.
6. **Kaynak → aday bağı sunucuda otomatik değil**: yeni revizyonun çıkarımı kuyruğa alınır; adayların `admin_import_curriculum_candidates` ile içe alınması hâlâ elle (Python çıktısı). `extraction_status` sunucuda `queued`'dan ileri taşınmaz.
7. **Dizin ayrıştırma** sayfa yapısına bağlı (anchor + "Yayın/Güncelleme Tarihi" regex); ÖDSGM sayfa biçimi değişirse `subject_link_not_found` döner, URL uydurulmaz. 2. dönem ve sonraki yıllar için dizin bilerek tanımsız.
8. **Dosya saklama**: Python tarafı depoda (git) saklar; sunucu tarafı bucket yükleme hatasında kaydı `storage_path=null` ile sürdürür.
9. **Fiziksel cihaz / Q00 incelemesi** yapılmadı; mobil satır yalnız tip/lint düzeyinde doğrulandı.
10. `supabase test db` (CLI) bu makinede yok; pgTAP testleri `docker exec psql` ile boş klonda çalıştırıldı (mevcut `test-reward-history.py` yöntemiyle).

## Yeniden çalıştırma

```sh
python3 scripts/fetch-curriculum-sources.py docs/learning/catalog/2026-2027-term1 --dry-run
python3 scripts/test-meb-scenarios.py
python3 scripts/test-curriculum-source-fetch.py --run-local
deno test --frozen-lockfile --config supabase/functions/deno.json supabase/functions/_shared/curriculum-source.test.ts supabase/functions/curriculum-source-fetch/handler.test.ts supabase/functions/_shared/catalogue-plan.test.ts supabase/functions/_shared/generation-result.test.ts
```
