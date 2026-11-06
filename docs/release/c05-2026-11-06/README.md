# C05 — MEB kaynağından gerçek soru ilişkisine kadar (M01/P02/B02)

6 Kasım 2026. Kart: [CLAUDE-REMAINING-WORK §C05](../../CLAUDE-REMAINING-WORK.md), sözleşme: [MEB-SCENARIO-PROTOCOL](../../learning/MEB-SCENARIO-PROTOCOL.md), önceki iş: [M01 raporu](../overnight-2026-11-06/M01-REPORT.md).
Dal: `worktree-agent-acd9e108109caabb7` (kaynak main `fcfe8e5`). **Main'e push edilmedi, PR açılmadı, üretime/hosted Edge'e dağıtım yapılmadı, `db reset` yapılmadı.**

**Durum: KOD HAZIR / İZOLE ORTAMDA TEST EDİLDİ — yayımlanmadı.** Gerçek AI ile soru üretimi kabulü: **C08/C14'e bağlı, BEKLİYOR** (bu ortamda gerçek sağlayıcı kullanılmadı; zincir deterministik sağlayıcı sınırıyla kanıtlandı).

## Eski görev kimliği bağlantısı

M01 (kaynak edinme/sürümleme/soru→çıktı izi), P02 (aile katalog seçimi), B02 (yönetim inceleme akışı). M01 kalan sınırlarının bu kartla durumu aşağıda «M01 sınırları» tablosunda.

## Commit'ler

| Commit | İçerik |
|---|---|
| `e2239ad` | Migration `20261106250000_curriculum_pipeline_ops.sql` + pgTAP `111_curriculum_pipeline_ops.test.sql` |
| `4dc3be5` | Edge: dizin sayfası kayıttan; `Deno.resolveDns` yoksa açık `dns_unavailable` (fail-closed); çalışma zamanı probu; Python işletim adımı `--process-queue`; çıkarıcı yıl/dönem/sabit anahtar |
| `7033ac0` | Zincir testi (izole DB + Supabase edge-runtime + deterministik sağlayıcı) |
| `45c3fe6` | Backoffice dizin hedefleri/çıkarma kuyruğu/aday rozetleri; mobil katalog tam dönem nedeni ve eskime |
| `0cfcc35` | pgTAP iki saat dilimi, backoffice + mobil Playwright turları; onaylı kopya yoksa eskime notu gösterilmez |
| (bu rapor) | `docs/release/c05-2026-11-06/README.md` |

## Değişen dosyalar

- DB: `supabase/migrations/20261106250000_curriculum_pipeline_ops.sql`, `supabase/tests/111_curriculum_pipeline_ops.test.sql`.
- Edge: `supabase/functions/curriculum-source-fetch/{handler.ts,handler.test.ts,runtime-probe.ts}`, `supabase/functions/_shared/curriculum-source.ts`.
- Python: `scripts/fetch-curriculum-sources.py`, `scripts/extract-meb-scenarios.py`, `scripts/test-meb-scenarios.py`.
- Test altyapısı (yalnız yerel QA, dağıtılmaz): `scripts/test-curriculum-pipeline-chain.py`, `scripts/c05-generation-edge.ts`, `scripts/c05-edge-runtime/{main,probe}/index.ts`, `scripts/test-c05-backoffice-ui.cjs`, `scripts/test-c05-mobile-catalog-ui.cjs`.
- UI: `apps/backoffice/src/components/curriculum-pipeline.tsx` (yeni), `apps/backoffice/src/components/curriculum-review.tsx` (bileşeni bağlama + aday rozeti, 6 satır), `apps/mobile/src/app/parent/prova/catalog.tsx` (yalnız güncellik/kaynak satırları; C01 okul onayı etiketine dokunulmadı).
- Sahiplik dışı küçük ek: `packages/core/src/i18n/{tr,en}.json` içine 2 anahtar (`catalogFlow.freshness.stale`, `catalogFlow.freshness.notFetched`); başka anahtar değişmedi.
- Kanıt: `chain-checks.json`, `pgtap-istanbul/`, `pgtap-utc/`, `ui/*.png`.

## Ne yapıldı

**1. Yeni yıl/dönem kaynak hedefi (yönetim).** `gina.curriculum_source_targets` (aile/yıl/dönem başına tek resmî dizin sayfası; yalnız `https://…meb.gov.tr/`; `meb.ai`/EBA CDN dizin olamaz). 2026–27/1 için M01'de canlı kontrol edilen sayfa başlangıç kaydı. `admin_save_curriculum_source_target` (idempotent makbuz, `created|updated|unchanged`, denetim kaydı, kaynağı olan hedefin adresi değiştirilemez), `admin_list_curriculum_source_targets`, servis için `get_curriculum_source_target`. Edge artık dizini sabit koddan değil bu kayıttan okur; kayıt yok/emekli → `unpublished` + `requested{year,term}`, ağ yok, başka dönem yok. DB tetikleyicisi kayıtsız yıl/dönem veya farklı dizin sayfasıyla kaynak kaydını reddeder (`curriculum_target_missing`).

**2. Çıkarım `queued` → `done|failed` + idempotent import.** Görünür işletim adımı: `python3 scripts/fetch-curriculum-sources.py --process-queue --api-url <URL>` (yönetici oturumu env değişkenlerinden). Kuyruktaki her sürümü aynı politika ile yeniden indirir, SHA-256 eşleşmesini doğrular (değişmişse `hash_changed_since_fetch` ile `failed`), mevcut `extract-meb-scenarios.py` + `prepare-curriculum-review.py` ile adayları üretir ve `admin_record_curriculum_extraction` ile kaydeder. Sunucu kuralları: her aday aynı hash'ten, aynı yıl/dönem/dersten olmalı (`curriculum_extraction_hash_mismatch`, `curriculum_term_mismatch`, `curriculum_scope_mismatch`), sayılar tutmalı; aynı paket tekrar → `unchanged`, aynı bayt için farklı çıktı → `curriculum_extraction_conflict` (üzerine yazmaz); istek kimliği (sürüm+paket) deterministik olduğundan kayıp yanıt tekrar oynatılır. Erişilemeyen dosya `failed` değil, kuyrukta kalır. Anahtarlar resmî dosya adından (hash ekli yerel ad değil) ve kaynağın yıl/döneminden üretilir; yeni sürüm aynı anahtarı yeni hash ile taşır.

**3. Aday inceleme ve ayrı yayın.** Yayın, adayın sunucu sürümü **onaylı** değilse `curriculum_source_not_approved` (sunucu sürümü hiç olmayan eski manifest içe aktarımları önceki kuralla kalır). Yeni onaylı sürümün adayı yayımlanınca aynı anahtarlı eski yayımlı aday yalnız **yeni seçimlere** kapanır (`replaced_previous`); ailenin dondurulmuş kopyası, atanmış sınav ve sorular değişmez; eski kopyadan yeni üretim `curriculum_unavailable` ile ücretsiz durur.

**4. Aile seçimi / güncellik.** `get_curriculum_source_status` (v1 sözleşmesi değişmeden, ek): tam istenen yıl/dönem, `target_registered`, `reason: no_official_index | source_not_fetched`, `substituted:false`, `stale` (son başarılı kontrol ≥ 7 gün veya doğrulanamadı) ve `stale_days`. Mobil katalog bunu kullanır; eskime notu yalnız onaylı kopya varsa gösterilir.

**5. Soru/çıktı/blok ilişkisi ve içerik uygunluğu.** Değişmeyen `prova-generate` + `finishGeneration` zinciri, yayımlanmış senaryonun normalize blok/çıktı metnini sağlayıcıya verir; satırlar `catalogue_id, source_sha256, block_id, outcome_ids, source_cells, rubric, shared_source_id` taşır. `content_fit: pending_human_review` artık başarı sayılmıyor: her senaryo bağlı soru için tetikleyici `gina.scenario_question_fit` kaydı açar; `review_scenario_question_fit` (veli, gerekçe ≥ 10 karakter, açık onay, ölçülen çıktılar sorunun blok çıktılarının alt kümesi, `fit` için en az bir çıktı, revizyon/çakışma ve makbuz idempotency), `get_scenario_question_fit` özeti `accepted` yalnız **her** soru gerekçeli `fit` ise true. E01 bağlantısı: AI önerisi `record_scenario_question_fit_suggestion` (yalnız servis; E01 verdict biçimi `decision_reason/confidence/findings/recommendation`) ayrı alanda tutulur ve kararı değiştirmez (`ai_is_decision:false`). Katalog adaylarında E01 AI ön incelemesi backoffice listesinde ayrı rozet olarak görünür.

**6. Hosted Edge DNS/SSRF gerçek runtime'da.** `runtime-probe.ts` korumayı kapatmadan `checkUrl/fetchWithPolicy` çağırır. Hem `deno run` (2.9.8) hem **Supabase edge-runtime v1.77.8 imajında kullanıcı işçisi** içinde: `Deno.resolveDns` var ve çalışıyor (`odsgm.meb.gov.tr` → `95.0.196.220`); gerçek DNS'i `127.0.0.1` dönen adlar (`localtest.me`, `127.0.0.1.nip.io`) izinli host adına bağlansa bile `non_public_address`; http/localhost/169.254.169.254/port/kullanıcı bilgisi/`meb.ai` son host reddi; `Deno.resolveDns` kaldırılınca `dns_unavailable` ve **0 HTTP isteği**; resmî dizin + `meb.ai` 302 → `cdn.eba.gov.tr` gerçek indirme.

## Testler (gerçekten çalıştırıldı)

Ayrım: **gerçek** = resmî ÖDSGM/EBA ağına gerçek HTTPS, gerçek Postgres/Auth/PostgREST, gerçek Supabase edge-runtime imajı; **izole** = tek kullanımlık DB/konteynerler, sentetik `example.invalid` kullanıcılar; **deterministik/mocked** = AI sağlayıcı sınırı (`api.anthropic.com` çağrısı yerel olarak yanıtlanır), Deno birim testlerinde ağ/DB sahteleri.

| Test | Komut | Sonuç |
|---|---|---|
| Zincir (gerçek kaynak + izole + edge-runtime + deterministik AI) | `GINA_QA_PLAYWRIGHT_PATH=… GINA_C05_MOBILE_WEB=… python3 scripts/test-curriculum-pipeline-chain.py --run-local --with-ui` | **39/39** ([chain-checks.json](chain-checks.json)); konteynerler ve DB silindi |
| pgTAP 111 | `python3 scripts/test-q02-sql.py --run-local --only 111` | **106/106** |
| Tam pgTAP, Europe/Istanbul | `python3 scripts/test-q02-sql.py --run-local --timezone Europe/Istanbul --out docs/release/c05-2026-11-06/pgtap-istanbul` | **107 dosya, 4102 kontrol, 0 hata** |
| Tam pgTAP, UTC | `… --timezone UTC --out docs/release/c05-2026-11-06/pgtap-utc` | **107 dosya, 4102 kontrol, 0 hata** |
| 056/057/087 + yarışlar | `python3 scripts/test-curriculum-source-fetch.py --run-local` | 46/43/54 ok; aynı hash eşzamanlı → tek revizyon |
| Katalog yarışları | `test-curriculum-races.py`, `test-catalogue-selection-races.py` (geçici şablonla, sonra silindi) | 3/3, 4/4 senaryo geçti |
| Deno (CI satırı 52, 26 dosya) | `deno test --frozen-lockfile --config supabase/functions/deno.json …` | **234 passed, 0 failed** (yeni: kayıt tabanlı dizin, `resolveDns` yok → fail-closed) |
| Deno check | `curriculum-source-fetch/index.ts`, `runtime-probe.ts`, `prova-generate/index.ts`, `scripts/c05-generation-edge.ts`, edge-runtime main | temiz |
| Python | `test-meb-scenarios.py` 22 OK (6 yeni: gerçek `turkce2.xlsx` → depodaki 46 adayla birebir aynı anahtar/blok/çıktı; değişen bayt; 2. dönem tablosu reddi; sonraki yıl anahtarı; bozuk dosya; deterministik istek kimliği ve erişilemeyen kuyruk öğesi), `test-curriculum-candidates.py` OK, `test-curriculum-review.py` OK |
| Core | `pnpm --filter @gina/core test` | 52 dosya, 366 test geçti |
| Backoffice | `pnpm --filter @gina/backoffice typecheck` / `lint` / `build` (yer tutucu `NEXT_PUBLIC_SUPABASE_URL=http://gina-c05ui.invalid`) | çıkış 0 / 0 / 0 |
| Mobil | `npx tsc --noEmit`, `npx eslint src/app/parent/prova/catalog.tsx`, `npx expo export -p web` (yer tutucu kök) | temiz / temiz / export tamam |

### Zincir testinin kanıtladıkları (`chain-checks.json`)

- **Gerçek resmî kaynak:** Edge (`curriculum-source-fetch`, değiştirilmemiş, edge-runtime imajında) resmî dizini okudu (44 bağlantı, yayın 07.09.2026, güncelleme 10.09.2026), `https://meb.ai/ankmeb4` 302 → `https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/turkce2.xlsx`, 31.410 bayt, SHA-256 `6405d02aaaad…` = depodaki manifest. Sonuç `new_revision / pending_review / queued`, `officially_verified:false`.
- **Tekrar:** aynı dosya → `unchanged`, aynı revizyon kimliği, toplam revizyon 1.
- **Çıkarım/import:** işletim adımı `done`, **46** aday (depodaki Türkçe çıkarımıyla aynı sayı); ikinci çalıştırma iş bulmadı; aynı paket yeniden → `unchanged`, aday sayısı 46.
- **İnceleme/yayın:** kaynak onayı olmadan yayın reddi → kaynak onayı → aday incelemesi → ayrı yayın.
- **Aile:** veli `verified`, `officially_verified:false`, `stale:false`; yalnız yayımlı senaryoyu görür; dondurulmuş kopya kaydedildi.
- **Üretim (deterministik sağlayıcı):** yanlış adet çıktısı `502`, **0 satır**; doğru çalıştırmada senaryo `tr-2026-2027-t1-turkce2-g5-c6` toplam 6 / bloklar B1:2, B2:1, B3:1, B4:1, B5:1 → **6 soru, blok başına sayılar birebir**; her soru `catalogue_id`, `source_sha256`, blok çıktılarının alt kümesi `outcome_ids`, kaynak hücreleri ve rubrik taşır; B1'in iki sorusu tek ortak kaynak kimliğini paylaşır, ayrı sayılır; sağlayıcıya URL değil tam normalize çıktı metni gitti.
- **İçerik uygunluğu:** 6 soru `pending_human_review`, `accepted:false`; bir gerekçeli `fit` sonrası 1/6, hâlâ `accepted:false`.
- **Değişen kaynak:** yeni hash → `diff_review_required`; soru satırları + dondurulmuş kopya + blueprint md5 öncesi/sonrası aynı; veli son onaylı hash'i görür.
- **Kaynak yok/eski/erişilemez/yanlış dönem:** 2. dönem kayıtsız → `unpublished` (`requested.term=2`); 2027–28 → `unpublished`; yabancı alan adlı hedef reddi; kayıtlı ama var olmayan resmî sayfa → `unverified (index:http_status:404)`, revizyon yok, `free_study`; veli 2. dönemde 1. dönem senaryosu görmez; 9 gün eski kontrol → `stale:true, stale_days:9`.

### UI (Playwright, izole servisler, sistem Chrome)

Backoffice 1280×800, [ui/01–07](ui/): dizin hedefleri (başlangıç + emekli 2. dönem), `meb.ai` adresi gerekçeli reddi, yeni yıl hedefinin indirme yapmadan eklenmesi, başarısız çıkarmanın nedeni (`worksheet_path`) ve işletim komutu, aday listesinde kaynak sürümü + ayrı AI ön inceleme rozeti (yönetici kararı değil), eski kaynak uyarısı ve **UI'dan gerçek Edge çağrısı** (gerçek indirme, aynı hash, uyarı kalktı). Yönetici aile üyesi değil. 8/8 kontrol.
Mobil web export 390×844, [ui/m1–m3](ui/): 1. dönem yayımlı senaryo + eskime notu; 2. dönem «doğrulanamadı» + serbest çalışma, 1. dönem senaryosu yok, sahte «onaylı kopya» iddiası yok; 2027–28 «dizin kayıtlı ama dosya incelenmedi, başka dönem kullanılmaz». 5/5 kontrol. Sayfa hatası ve yatay taşma yok.
Onaylı tasarım referansı bu ekranlar için yok; karşılaştırma mevcut backoffice/mobil bileşen düzeniyle (aynı kart/etiket/tablo bileşenleri) yapıldı. Fiziksel cihaz testi yapılmadı.

Deneme geçmişi: zincir 1. koşu edge-runtime'da `packages/` bağlanmadığı için işçi açılmadı (test altyapısı), 2. koşu 35/35; mobil tur 1. koşu senaryo listesi «okulun senaryosunu biliyorum» seçimi gerektirdiği için, 2. koşu boş durumda bu seçenek olmadığı için düştü (test sırası). 2. koşuda onaylı kopyası olmayan kaynakta eskime notunun «son onaylı kopyaya dayanır» demesi yanıltıcı bulundu; ürün düzeltildi (yalnız onaylı kopya varsa gösterilir), 3. koşu temiz.

## Negatif / yetki / idempotency

pgTAP 111 (106 kontrol): veli hedef okuyamaz/ekleyemez, kayıt araması yalnız servis; yabancı/http/`meb.ai`/CDN/benzer ad/ardışık olmayan yıl/3. dönem/fazla anahtar reddi; makbuz tekrarı birebir, aynı istek farklı içerik `request_conflict`; kayıtsız yıl/dönem ve farklı dizin sayfası `curriculum_target_missing`; emekli hedef kullanılmaz; veli çıkarım kaydedemez; hash/dönem/ders/sayı uyuşmazlıkları; `done` sonrası farklı çıktı ve `failed` çakışması; başarısızdan yeniden deneme; onaysız sürümden yayın reddi; değişen kaynakta atanmış sınav/sorular/kopya/blueprint birebir aynı; eski kopyadan rezervasyon yok; uygunluk incelemesinde kısa gerekçe/onaysız/boş çıktı/blok dışı çıktı/bilinmeyen karar reddi, başka aile 42501 ve boş liste, AI önerisi biçimi ve kararı değiştirmemesi, makbuz tekrarı, eski revizyon çakışması, `accepted` yalnız tümü `fit`; üretim anı provenance etiketi yeniden yazılmaz; tabloya doğrudan erişim yok.

## M01 kalan sınırları (1–8) — bu karttan sonra

| # | M01 sınırı | Durum |
|---|---|---|
| 1 | Yayın yok | **Değişmedi:** migration/Edge/bucket üretime uygulanmadı (talimat gereği). |
| 2 | Edge runtime'da `Deno.resolveDns` | **Yerel olarak doğrulandı:** Supabase edge-runtime v1.77.8 kullanıcı işçisinde mevcut ve çalışıyor; yoksa fail-closed kanıtlı. Hosted sürüm farklı olabilir: dağıtımdan sonra tek çağrı ile doğrulanmalı (prob dağıtılmaz). IP kontrolü ile bağlantı arasındaki DNS yeniden bağlama penceresi **hâlâ var** (bağlantı IP'ye sabitlenmiyor). |
| 3 | Prompt v5 gerçek sağlayıcı | **BEKLİYOR (C08/C14).** Deterministik sağlayıcıyla şema/sayı/blok/provenance zinciri kanıtlandı; içerik kalitesi kanıtlanmadı. |
| 4 | Anlamsal uygunluk | Sunucuda gerekçeli insan inceleme akışı + ayrı AI öneri alanı var; **veli için inceleme ekranı yok** (Prova inceleme UI'ı C04 kapsamı), AI uygunluk önerisini üreten çağrı yok. |
| 5 | Backoffice salt okunur / Edge düğmesi | Onay/geri çekme düğmeleri E01-UI ile gelmişti; bu kartla dizin hedefi formu ve çıkarma kuyruğu eklendi, «Resmî dizini kontrol et» gerçek Edge ile UI'dan doğrulandı. |
| 6 | Kaynak → aday otomatik değil | `queued → done|failed` görünür işletim adımı + idempotent sunucu kaydı ile çözüldü; **zamanlanmış/sunucu içi otomatik çıkarım yok** (bilinçli: Python çıkarıcı Deno'ya taşınmadı). |
| 7 | Dizin ayrıştırma sayfa yapısına bağlı | Değişmedi; 2. dönem/yeni yıl artık yönetici kaydıyla, URL tahmini yok. |
| 8 | Dosya saklama | İzole zincirde Storage çalıştırılmadı: `stored:false`, `storage_path=null` ile kayıt sürüyor; bucket yüklemesi üretimde doğrulanmalı. |

## Sayım uyarısı

Zincirde **1** resmî dosya (Türkçe) uçtan uca işlendi ve **1** senaryo yayımlandı. M01'deki 16 dosya hash kontrolü dosya bütünlüğüdür; **648 adayın editoryal onayı veya yayını anlamına gelmez**. Bu karttaki 46 aday yalnız izole DB'de içe alındı; gerçek katalogda onay/yayın yok. Yayımlanan tek senaryonun incelemesi sentetik test incelemesidir, gerçek editoryal onay değildir.

## Yayın

**Yayımlanmadı.** Yayın planına eklenecekler: migration `20261106250000_curriculum_pipeline_ops.sql` (≥ `20261106010000` ve E01 `20261106050000` sonrası), `curriculum-source-fetch` yeniden dağıtımı (dizin artık `get_curriculum_source_target` RPC'sinden), dağıtım sonrası tek doğrulama çağrısı (DNS + indirme), işletim adımının kim tarafından/ne sıklıkla koşacağı kararı.

## Kalan engel

- Gerçek AI soru üretimi ve içerik kalitesi kabulü: C08/C14 (sağlayıcı anahtarı/ücretli çağrı kararı).
- Veli içerik uygunluğu inceleme ekranı (C04) ve AI uygunluk önerisi üretimi.
- Hosted edge-runtime sürümünde DNS doğrulaması; DNS yeniden bağlama penceresi.
- Storage bucket yüklemesi izole zincirde yok.
- Fiziksel telefon/tablet kontrolü yapılmadı (mobil yalnız web export 390×844).
- Öğretmen/okul senaryo seçimi bilinmiyorsa uydurulmaz; okul onayı etiketi C01'de.
