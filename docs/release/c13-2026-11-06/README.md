# C13 — P0 bütünleşik güvenlik, performans ve geri yükleme (Q02/Q03) — 6 Kasım 2026

**Durum: KOD HAZIR + İZOLE TEST EDİLDİ. YAYIMLANMADI** (migration/Edge üretime gönderilmedi; C14 kapsamı).
Kart: `docs/CLAUDE-REMAINING-WORK.md` §4A C13. Eski görev kimlikleri: Q02 (uçtan uca yetki/performans), Q03 (güvenlik/geri dönüş).
Kaynak: main `cf391d8` (≥ `0a87406`, C01–C11 birleşik, 139 migration); dal `worktree-agent-a5c9983a25ff83ce2` (main'e push yok).
Bütün DB koşuları bu Mac'te Docker içinde **tek kullanımlık** klon DB'lerde (`gina_completion_audit` şablonu + migration'lar) ve
yalnız 127.0.0.1'e açılan geçici GoTrue/PostgREST/Realtime/Storage/Deno süreçlerinde. Üretim DB'sine yazılmadı, `db reset`
yok, sır okunmadı/yazdırılmadı. Canlıya yalnız oturumsuz, salt okunur ~15 HTTP isteği (başlık + Access) atıldı.

**"Hiç açık yok" garantisi verilmez.** Testler seçilmiş senaryoları ve otomatik sentezlenmiş argümanlarla persona taramasını
kapsar; semantik tam matris, penetrasyon testi veya hosted kanıt değildir. Kalan sınırlar §7'de.

## Özet

| Önem | Adet | Bulgular (durum) |
|---|---|---|
| Yüksek | 0 | — (yetki aşımı, çift yıldız/kota/hak, taslak kaybı gözlenmedi) |
| Orta | 2 | C13-AUTH-1 eşleme kodu numaralandırma (AÇIK, öneri) · C13-PERF-1 `routines_for_day`/`plan_for_days` (DÜZELTİLDİ) |
| Düşük | 10 | C13-AUTH-2 admin aile soruları (DÜZELTİLDİ) · C13-RST-1 ACL kontrol listesi (DÜZELTİLDİ) · C13-RST-2 süper kullanıcısız geri yükleme (AÇIK) · C13-RST-3 Storage içerik türü (AÇIK) · C13-SCAN-3 (DÜZELTİLDİ) · C13-SCAN-5 (DÜZELTİLDİ) · C13-SCAN-1/2/6 (AÇIK) · C13-TOOL-1 q02 başlatıcı (DÜZELTİLDİ) |
| Bilgi | 9 | C13-AUTH-3 PostgREST exp toleransı · C13-AUTH-4 sessiz no-op silme · C13-PERF-2 yanıt boyutları · SCAN-4/7/8/9/10/11 |

(Düşük: AUTH-2, RST-1/2/3, SCAN-1/2/3/5/6, TOOL-1 = 10; bilgi: AUTH-3/4, PERF-2, SCAN-4/7/8/9/10/11 = 9.)

## 1. Yetki zinciri

### 1a. Persona × bütün RPC/tablo taraması — `scripts/security/c13-rpc-fuzz.sql` (yeni)

`authenticated`'ın çalıştırabildiği **321 public fonksiyonun tamamı** ve okuyabildiği **64 tablo/görünüm**, 14 persona ile
çağrıldı (**5.390 çağrı**, her biri zorla geri alınan alt işlemde): A velisi, B velisi, sahte A claim'li B velisi, A çocuk 1
cihazı, kardeş (çocuk 2) cihazı, kardeş cihazı + sahte `child_id`, iptal edilmiş cihaz, B cihazı, destek/içerik/finans/yayın
operatörleri, sahte admin claim'i, tam admin. Argümanlar ad/türden sentezlenir (`p_child_id` → A çocuk 1, `p_attempt_id` →
A denemesi…); A verisi nöbetçi metin taşır. Sonuçta personanın görmemesi gereken nöbetçi görünürse `leak`.

- Pozitif kontrol: A velisi 19 fonksiyon + 14 tabloda kendi nöbetçisini, A cihazı 8 fonksiyonda çocuk-1 nöbetçisini gördü
  (dedektör çalışıyor).
- **Sonuç (migration sonrası): yabancı aile / kardeş / iptal cihaz / sahte claim sızıntısı 0.** Kalan 2 satır beklenen
  operatör kapsamı: finans `finance_workspace` aile adı+plan, destek `get_help_ticket` talep konusu.
- Migration öncesi ek bulgu: **tam admin, `question_bank` (ve iki görünümü) üzerinden aileye özel soruları okuyabiliyordu**
  → C13-AUTH-2.
- Rol matrisi (`ok_personas_by_function`): `admin_*` uçları yalnız tam admin + doğru dar rol; ör. `admin_library_content_page`
  içerik+yayın, `support_canned_replies`/`list_help_attachments` destek, `release_channel_failures` yayın,
  `finance_workspace` finans, `admin_curriculum_pipeline`/`admin_search_families` yalnız tam admin. Yazma işlevlerinden
  yabancı personaya "ok" dönenler incelendi: `delete_learning_source`, `cancel_unstarted_generation` kendi ailesine kapsamlı
  no-op; `set_child_goal` cihazda claim'deki kendi çocuğunu kullanır; `request_pairing` iptal cihazın yeniden eşleme akışı.
- Kanıt: `rls/rls-matrix.json` → `c13_rpc_fuzz` (+ `operator_roles` sütunu: 84 fonksiyon dar rolle kapılı).

### 1b. pgTAP 119 — `supabase/tests/119_c13_authz_hardening.test.sql` (74 iddia)

Katalog bekçileri (anon yalnız `get_shared_child_view`+`unsubscribe_with_token`; tüm security definer fonksiyonlarda
`search_path`; servis rolüne ayrılmış C08/C09/C10 fonksiyonları authenticated/anon'a kapalı; hiçbir politika yardımcıyı
çıplak çağırmıyor) + `plan_for_days`/`routines_for_day` (veli, kendi cihazı, kardeş, kardeş+sahte claim, iptal cihaz, yabancı
aile, sahte aile claim'i, tam admin; 43 gün reddi) + ders bağlantıları, eğitim değişimi, tatil önerisi, AI notu kabulü/
kullanımı, haftalık inceleme, bildirim kanalı, eşleme önizlemesi + eski açık-soru düzeltmesi + dar operatör rolleri
(süresi dolmuş/geri alınmış rol, sahte admin) + C13-AUTH-2 + `plan_version_on` anlam kenarları.
**A/B:** migration'sız DB'de 119 → 3/74 düşer (admin aile sorusu okuma/ekleme/güncelleme) — `pgtap-ab/`.

### 1c. Uçtan uca zincir — gerçek GoTrue + PostgREST + Deno Edge (`scripts/test-e2e-family-chain.c13.mjs`, yeni bölüm)

`python3 scripts/test-e2e-family-chain.py --run-local` (çıktı klasörü `GINA_QA_CHAIN_OUT=docs/release/c13-2026-11-06/chain`):
**404/404 kontrol** (Q02 zinciri + C13 bölümünde 79). C13 bölümü: 42 gün plan + 43 gün reddi; cihazın kendi haftası,
kardeş/yabancı veli/yabancı cihaz reddi; `routines_for_day`; ders bağlantısında **çift dokunma tek makbuz**, **kopuk ağ
(sunucu işledi, yanıt kayboldu) → aynı istekle tekrar**, **iki velinin aynı anda aynı derse farklı bağlantısı → tek kazanan,
diğeri `subject_link_changed`**; AI notu kabulü/kullanım; haftalık inceleme; eski düzeltme önizleme/uygula (yabancı veli,
destek reddi); eşleme önizlemesi; bildirim kanalları; gerçek hesaplarla içerik/finans/yayın/destek rolleri ve 10 çapraz red;
imzası geçerli ama satırı olmayan sahte operatör/admin claim'i; **açık oturumda içerik rolü geri alınınca eski jeton reddi**;
süresi dolmuş jeton 401; sahte aile claim'i; anon. Edge: değişmemiş `curriculum-source-fetch` ve `content-prereview`
işleyicileri yerel Deno sürecinde (`scripts/test-e2e-family-chain.c13-edge.ts`): anon/veli/cihaz/yayın operatörü/sahte admin
403; drain yalnız sistem; yanlış cron sırrı 403; 300 KiB gövde 400.
Mevcut Q02 zinciri (yarışlar, kopuk/yavaş ağ, revizyon, iptal edilen üyelik/cihaz/admin/destek, silme) aynı koşuda geçti.

### 1d. Mevcut izole servis sözleşmesi (Realtime + Storage + Edge)

`python3 scripts/test-isolated-services.py --run-local --with-realtime --with-storage` → **473/473 kontrol**, temizlik tam (`regression-isolated-services.json`).
Bu paket gerçek WebSocket Realtime, Storage API ve Deno Edge (learning-source, delete-account, channel-unsubscribe,
prova-generate/grade…) ile C03/C08/C10 sözleşmelerini içerir; C13'te değiştirilmedi.

## 2. Performans — önce/sonra (ayrıntı: `perf/perf.md`)

Tek koşu, aynı tohum, A-B-A (önce → aday uygulanmış → geri alınmış), gerçek GoTrue jetonuyla PostgREST p50/p95 ve
`EXPLAIN (ANALYZE, BUFFERS)` + `track_functions`. Docker'da başka ajanlar çalışıyordu (±%50 gürültü); yalnız aynı koşudaki
fazlar karşılaştırılabilir. Tohum üst sınır: bir çocukta 220 rutin.

| Ekran | Sorgu | Rol | Önce p50/p95 | Sonra p50/p95 | EXPLAIN önce → sonra |
|---|---|---|---|---|---|
| Çocuk Bugün | `plan_for_days` 7 gün | cihaz | 277 / 479 | **120 / 134** | 419 → 149 ms |
| Çocuk Bugün | 4 isteğin paralel toplamı | cihaz | 356 / 484 | **121 / 164** | — |
| Takvim hafta | 2 çocuk × 7 gün | veli | 282 / 419 | **130 / 178** | — |
| Takvim 42 gün | `plan_for_days` | veli | 1732 / 1872 | **776 / 881** | 1803 → 774 ms (`plan_version_on` 9282× 1057 → 75 ms) |
| Görev listesi | `routines_for_day` | veli | 449 / 598 | **31 / 44** | 545 → 21 ms, 10.943 → 2.918 blok, çağrı 2640 → 220 |
| Prova inceleme | `exam_answers` (20 çizimli, 994 KB) | veli | 44 / 58 | 38 / 55 | 2–5 ms (yük aktarım) |
| Yönetim içerik listesi | `admin_library_content_page` | içerik | 17 / 32 | 15 / 21 | 17 → 16 ms |
| Büyük liste | 500 kaynak / 500 not / 120 talep + 90 ek | veli | 3–11 | 5–8 | index kullanılıyor |

RLS InitPlan: 112 politikada (C01–C11 dahil) çıplak yardımcı çağrısı **0**; tablo okumalarında `is_parent`/`is_device`
istek başına 1–2 kez. Değişmeyen önce-2 fazı farkın adaydan geldiğini gösterir. Düzeltme `20261106330000_c13_hardening.sql`
§2'de (gövde/yetki aynı; 4000 rastgele girdide `plan_version_on` 0 fark; REST yanıtlarının sha256'sı eşit).

## 3. Taramalar (ayrıntı: `scans/scans.md`)

- `pnpm audit` prod: 0 kritik/yüksek, 2 orta (glob, minimatch — Expo CLI zinciri, proje yamalı); dev: 1 orta, 1 düşük
  (deepmerge yamalı). Trivy 0.70: 2 MEDIUM, aynı. Deno npm (15 girdi): 0. Q03 ile aynı (C13-SCAN-1, izleniyor).
- Sızıntı taraması 2.532 dosya: gerçek sır/kişi verisi yok; allowlist dışı eşleşmeler sentetik test değerleri (SCAN-8).
- Storage: iki **özel** kova (`gina-private-sources` 10 MiB png/jpeg/pdf, `gina-curriculum-sources` 5 MiB xlsx),
  `storage.objects` istemci politikası 0, `getPublicUrl` yok. İmzalı okuma 120 s; imzalı **yükleme** belirteci 7200 s
  (platform sabiti, C13-SCAN-2).
- Access: backoffice ana + rastgele önizleme 12/12 Access girişine 302. Veli webi CSP/HSTS/X-Frame/COOP şablonla aynı;
  Q03-HTTP-1/2 düzeltmesi depoda ama **canlıda değil** (gina-web yeniden yayını bekliyor, C13-SCAN-6).
- Edge statik inceleme: channel-unsubscribe (imzalı/tek kullanımlık jeton, servis RPC, 2 KB), curriculum-source-fetch
  (canlı `admins` satırı, 4 KB, host/IP/yönlendirme denetimi), content-prereview (sabit zamanlı cron sırrı, rol RPC'si),
  delete-account (parola/≤300 s OTP). SCAN-3 ve SCAN-5 bu turda kapatıldı.

## 4. Geri yükleme tatbikatı (ayrıntı: `restore/README.md`)

`python3 scripts/security/c13-restore-drill.py --run-local` → **çıkış 0, 60,2 s; `restore-database.mjs --execute` çıkış 0, ACL kontrolü 0 satır** (RST-1 düzeltmesinden sonra ikinci koşu). Kaynak: 139 migration + gerçek GoTrue ile iki
veli, gerçek Storage API'ye iki PDF; `pg_dump --data-only -n auth -n storage -n public -n gina`; Storage baytları `tar`;
hedefte `scripts/restore-database.mjs` dry-run → yanlış onay reddi → `--execute --target-confirm` (replica); hedefe yeni
GoTrue/PostgREST/Storage. Sonuç: 11 tablo sayımı ve içerik özetleri eşit; 13 ilişki sorgusu eşit, yetim 0; **gerçek GoTrue
parola girişi 200, JWT `gina.family_id` kaynakla aynı**; **imzalı URL ile dosya açıldı, sha256 orijinal yüklemeyle aynı**;
veli JWT'si kendi kaynak/çocuk satırlarını okur, yabancı veli 0, anon 401; Storage negatifleri 400.
**Bu yerel süper kullanıcı dökümüdür; hosted geri yükleme kanıtı sayılmaz.** Hosted adımlar AÇIK (§7).

## 5. Bulgular

| Kimlik | Önem | Kanıt | Etki | Düzeltme | Kalan |
|---|---|---|---|---|---|
| **C13-AUTH-1** | Orta | `request_pairing` 6 haneli kod (10⁶), 10 dk ömür; `preview_device_pairing` (C06, yazmasız, STABLE) ve `pair_device`/`pair_child_device` çağrı başına deneme sınırı yok (`pg_proc` taraması: hız sınırlayıcı yok). Herhangi bir kayıtlı veli (kendi ailesini kurabilir) kodları yüksek hızda deneyebilir. | Bekleyen yabancı bir tableti kendi ailesine bağlama; mağdur veli eşlemenin "kullanılmış" olduğunu görür, çocuğun cihazına saldırganın içeriği gidebilir. Mağdur aile verisi okunmaz (anonim cihaz kullanıcısında veri yok). | **Uygulanmadı.** Sunucu tarafında başarısız denemeyi kalıcı saymak `pair_device`'ın hata fırlatan sözleşmesiyle (hata işlemi geri alır) mümkün değil; eski 26/27 istemci de doğrudan `pair_device` çağırıyor. Öneri: ağ geçidinde kullanıcı/IP başına hız sınırı (hosted), uzun vadede daha uzun kod veya cihazda onay adımı; önizlemeye kalıcı deneme sayacı. | AÇIK — C14 öncesi ürün/altyapı kararı |
| **C13-AUTH-2** | Düşük (gizlilik) | Persona taraması: tam admin `question_bank`, `current_question_bank`, `standalone_question_bank` üzerinden aileye özel soru kökü/çözümü okuyup yazabiliyordu (`question_bank_admin_all` aile filtresi yok). Backoffice yalnız `family_id is null` kullanıyor. | Platform sahibi rolünde, aile içeriği gizlilik ilkesine aykırı erişim. | Migration §1: politika `family_id is null` ile sınırlandı (InitPlan korunur). pgTAP 119 #59–66; A/B'de migration'sız 3 iddia düşer. | — |
| **C13-PERF-1** | Orta (perf) | §2 tablosu; `routines_for_day` satır başına 12 çağrı, `plan_for_days` 42 günde 9282 `plan_version_on`. | Görev ekranı ve takvim gecikmesi rutin sayısıyla katlanıyor. | Migration §2: lateral fonksiyon çağrısı + tek geçişli `plan_version_on`. | `plan_for_days` 42 gün hâlâ ~0,8 s (220 rutin); küme tabanlı yeniden yazım P2 öneri. |
| **C13-PERF-2** | Bilgi | 42 gün plan 1,07 MB, 7 gün 179 KB (her gün tam ders programı); Prova inceleme 20 çizim ≈ 1 MB. | Mobil ağda aktarım DB süresinden baskın. | Sözleşme değişikliği gerektirir (istemci/ürün kararı). | AÇIK |
| **C13-RST-1** | Düşük | `post-restore-acl-check.sql` bilinçli anon istisnası `unsubscribe_with_token`'ı tanımıyordu → başarılı geri yükleme "BAŞARISIZ". | Yanlış alarm; runbook'un "0 satır" beklentisi üretimde yanıltıcı. | İstisna eklendi; dev DB'de 0 satır; tatbikat tekrar koşuldu. | Canlıda bir kez salt okunur çalıştırma (hesap sahibi). |
| **C13-RST-2** | Düşük | `--trigger-mode disable-user` süper kullanıcısız denendi: `permission denied for table audit_log_entries`. | Hosted'da bu betikle Auth verisi geri yüklenemez. | Runbook güncellendi; Supabase PITR/yedek aracı. | AÇIK (hesap sahibi) |
| **C13-RST-3** | Düşük | Storage file backend içerik türü xattr'ta; tar kopyası taşımadı. | Geri gelen nesne `application/octet-stream`. | Runbook'a not. | Hosted nesne kopya prosedürü AÇIK |
| C13-SCAN-1 | Düşük | glob/minimatch/deepmerge duyuruları (yamalı, araçlar sürüm görür). | — | Q03-DEP-1 ile aynı. | izleniyor |
| C13-SCAN-2 | Düşük | İmzalı yükleme belirteci 7200 s (`learning-source/handler.ts:115`). | Sızan belirteçle 2 saat içinde yükleme (upsert kapalı, finalize sha/boyut/biçim denetler). | Öneri: finalize'a ~15 dk tazelik, `awaiting_upload` temizliği 24 → 2 saat. | AÇIK |
| C13-SCAN-3 | Düşük | `curriculum-source.ts` zaman aşımı yalnız başlıkları kapsıyordu. | Yavaş gövde Edge işçisini tutabilir. | Gövde okuması aynı son tarihe bağlandı + Deno testi. | — |
| C13-SCAN-5 | Düşük | `content-prereview` gövdeyi sınırsız `req.json()` ile çağıran kontrolünden önce okuyordu. | Anon anahtarla büyük gövde. | 256 KiB sınır, 400 + Deno testi + zincirde canlı Deno süreci. | — |
| C13-SCAN-6 | Düşük | Canlı `/s/probe` iki Referrer-Policy; `/_expo/static/<yok>.js` 200 HTML immutable. | Q03-HTTP-1/2. | Depoda var (67bfdc1). | gina-web yayını (C14) |
| C13-TOOL-1 | Düşük | `scripts/q02_isolated.py` sabitleri eskimiş (Node zaman aşımı 420, `grant all on auth.users`) → `test-e2e-family-chain.py`/`test-q02-perf.py` başlamıyordu. | Q02 zinciri ve perf koşucusu çalışmıyordu. | Sabitler güncellendi; zincir 404/404 koştu. | — |
| C13-AUTH-3 | Bilgi | PostgREST `exp`'e ~30 s saat kayması toleransı tanır (exp−20 s jeton 200; exp−120 s 401). | Beklenen davranış. | — | — |
| C13-AUTH-4 | Bilgi | `delete_learning_source` yabancı/olmayan kimlikte hata vermeden no-op (Q02-5 deseni). | Etkisi yok; istemci başarı sanabilir. | Öneri: `source_not_found`. | AÇIK (küçük) |
| SCAN-4/7/8/9/10/11 | Bilgi | `scans/scans.md` | — | — | — |

## 6. Test çıktıları (gerçekten koşuldu, 6 Kasım)

| Test | Sonuç | Kanıt |
|---|---|---|
| pgTAP tamamı, Europe/Istanbul (`test-q02-sql.py --run-local`) | **118 dosya, 5.160 iddia, 0 hata** | `pgtap-istanbul/sql-checks.json` |
| pgTAP tamamı, UTC (`--timezone UTC`) | **118 dosya, 5.160 iddia, 0 hata** | `pgtap-utc/sql-checks.json` |
| pgTAP 119 A/B (`--only 119 --skip-migration 20261106330000`) | 71/74; beklenen 3 düşüş (C13-AUTH-2) | `pgtap-ab/` |
| Uçtan uca zincir (`test-e2e-family-chain.py --run-local`) | **404/404** (C13 bölümü 79, Edge 12 dahil), temizlik tam | `chain/chain-checks.json`, `chain/chain-details.json` |
| İzole servisler `--with-realtime --with-storage` | **473/473**, kapsayıcı+DB temizlendi | `regression-isolated-services.json` |
| RLS matrisi + persona taraması (`rls-matrix.py --run-local --with-fuzz`) | 190 tablo, RLS kapalı 0; 637 fonksiyon, search_path eksik 0; anon fonksiyon 2; politikasız yazma 0; sentetik başarısız 0; 321 fonksiyon + 64 tablo × 14 persona = 5.390 çağrı, beklenmeyen sızıntı 0 | `rls/rls-matrix.json` |
| Geri yükleme tatbikatı (2. koşu, RST-1 sonrası) | replica hedefi `pass: true` (sayım/özet/ilişki eşit, ACL 0, GoTrue 200, imzalı URL sha256 eşit); disable-user hedefi başarısız (RST-2, beklenen kayıt); temizlik doğrulandı | `restore/restore-drill.json` |
| Performans (A-B-A) | §2 | `perf/*.json` |
| `pnpm typecheck` / `pnpm lint` | 4/4 · 2/2 görev başarılı | — |
| `pnpm --filter @gina/core test` | **414/414** (58 dosya) | — |
| `node --test scripts/*.test.mjs` | **104/104** | — |
| Deno (CI'daki 9 komut: 1 check + 8 test) | **402 geçti, 0 hata**; ayrıca `deno check` content-prereview, curriculum-source-fetch, C13 Edge başlatıcı temiz | — |
| Backoffice `pnpm build` (yer tutucu public env) | başarılı | — |
| Mobil web `expo export -p web` (yer tutucu public env) | başarılı | — |

CI (GitHub Actions) bu dalda çalıştırılmadı (push yok). Fiziksel cihaz yok.

## 7. Kalan sınır / BEKLİYOR

- **Hosted:** Supabase PITR/günlük yedek durumu ve gerçek hosted geri yükleme provası (hesap sahibi); süper kullanıcısız
  Auth+Storage+public geri yükleme yolu (RST-2); hosted Storage nesne kopyası (bayt + Content-Type, RST-3);
  `post-restore-acl-check.sql`'in canlıda bir kez salt okunur çalıştırılması; canlı `pg_policies`/ACL karşılaştırması.
- **C13-AUTH-1** eşleme kodu numaralandırma: ağ geçidi hız sınırı / ürün kararı gerekli.
- **Mobil dokunma tepkisi, çizim akıcılığı, bellek, gerçek ağ gecikmesi** ölçülmedi (fiziksel cihaz yok) → C15.
- Üretim hacmi/`pg_stat_statements` yok; perf mutlak değerleri yerel Docker.
- Persona taraması argüman sentezlidir; her RPC için semantik tam matris değildir. Realtime kanal yetkisi yalnız mevcut
  izole sözleşmede (C13'te yeni Realtime yüzeyi eklenmedi).
- Backoffice canlı başlıkları Access arkasında okunamadı. Trivy önbellekli DB ile koştu.
- Migration ve Edge düzeltmeleri **yayımlanmadı**; `20261106330000` C14 koordineli yayınında `drop/create policy` ile kısa
  ACCESS EXCLUSIVE kilit alır (küçük tablo). content-prereview ve curriculum-source-fetch yeniden dağıtım ister.

## 8. Değişen dosyalar

- `supabase/migrations/20261106330000_c13_hardening.sql` (C13-AUTH-2, C13-PERF-1)
- `supabase/tests/119_c13_authz_hardening.test.sql` (74 iddia)
- `supabase/functions/_shared/curriculum-source.ts` (+ test), `supabase/functions/content-prereview/handler.ts` (+ test)
- `scripts/test-e2e-family-chain.mjs` (C13 bölümü, çıktı klasörü env), `scripts/test-e2e-family-chain.c13.mjs`,
  `scripts/test-e2e-family-chain.c13-edge.ts`, `scripts/q02_isolated.py`
- `scripts/security/c13-rpc-fuzz.sql`, `scripts/security/rls-matrix.py` (`--with-fuzz`, operatör rol sütunu),
  `scripts/security/post-restore-acl-check.sql`, `scripts/security/c13-restore-drill.py`, `scripts/security/c13-perf.{py,mjs}`,
  `scripts/security/c13-deno-npm-audit.mjs`
- `docs/security/RESTORE-RUNBOOK.md` (C13 bölümü), `docs/release/c13-2026-11-06/**`

Ekran dosyalarına dokunulmadı (C12). UI değişmedi → onaylı referans karşılaştırması gerekmez.
