# Q02 — Uçtan uca işlev, yetki ve performans kabulü (gece 6 Kasım 2026)

Kaynak: main `5ef5cd3` üzerine Q02 dalı (`worktree-agent-a9eb2726f64636c46`). Bütün koşumlar bu Mac'teki Docker Desktop içinde, `gina_completion_audit` boş şablonundan türetilen **tek kullanımlık** veritabanı kopyalarında ve yalnız 127.0.0.1'e açılan geçici GoTrue/PostgREST(/Realtime/Storage) konteynerlerinde yapıldı. Üretim, canlı web/yönetim, mevcut yerel demo ailesi ve gerçek AI sağlayıcısı kullanılmadı; `db reset` çalıştırılmadı. Uygulama kodu ve migration değiştirilmedi; kusurlar aşağıda iş kimliğiyle kayıtlıdır.

**Test sayısı tek başına "hiç açık yok" garantisi değildir.** Kalan riskler en sonda açık yazılmıştır.

## Özet

| Koşum | Sonuç | Kayıt |
| --- | --- | --- |
| Mevcut izole servis sözleşmesi (`test-isolated-services.py --with-realtime --with-storage`) | **280/280** geçti (eski "149" paketi realtime+storage+edge ile 280'e büyümüş) | `regression-isolated-services.json` |
| Yeni uçtan uca aile zinciri (`test-e2e-family-chain.py`) | **296/296** geçti | `chain-checks.json`, `chain-details.json` |
| Yeni pgTAP yetki matrisi `093_q02_cross_family_matrix.test.sql` | **47/47** geçti | `sql-checks-093.json` |
| Tüm pgTAP dosyaları izole boş DB'de (`test-q02-sql.py`) | **87 dosya, 2.557 iddia**, 0 başarısız | `sql-checks.json` |
| Performans ölçümü (`test-q02-perf.py`) | 26 ölçüm, 24 EXPLAIN, 2 deney | `perf.json` |

Bulunan kusur/öneri: 1 yüksek (RLS satır-başı değerlendirme), 4 orta, 3 düşük, 1 risk notu; hiçbirinde yetki aşımı, çift puan/kota tüketimi veya taslak kaybı **gözlenmedi**.

## Kurulum ve çalıştırma

Gerekenler: çalışan yerel Supabase stack'i (`supabase_db_gina`, `supabase_auth_gina`, `supabase_rest_gina`, `supabase_network_gina`; `--with-realtime/--with-storage` için ilgili konteynerler), boş `gina_completion_audit` şablonu, kurulu çalışma alanı bağımlılıkları (`@supabase/supabase-js` `apps/mobile` üzerinden çözülür), Node 22, Python 3. Başka ajanların `gina_http_*`/`gina_a3_*` konteynerleriyle çakışmamak için Q02 koşucuları `gina_q02c_` (zincir), `gina_q02p_` (perf), `gina_q02sql_` (pgTAP) öneklerini kullanır; her koşum sonunda kendi konteyner ve veritabanını siler.

```sh
# 1) mevcut 280 kontrol regresyonu
python3 scripts/test-isolated-services.py --run-local --with-realtime --with-storage
# 2) uçtan uca aile zinciri (iki aile, ikişer veli, tek çocuk telefonu + ortak tablet, destek, tam admin)
python3 scripts/test-e2e-family-chain.py --run-local
# 3) yeni pgTAP dosyası / bütün pgTAP dosyaları, izole boş DB'de
python3 scripts/test-q02-sql.py --run-local --only 093
python3 scripts/test-q02-sql.py --run-local
# 4) performans ölçümü ve EXPLAIN kanıtı
python3 scripts/test-q02-perf.py --run-local
```

`scripts/q02_isolated.py`, mevcut `test-isolated-services.py` kurulumunu **değiştirmeden** yeniden kullanır: kaynak metinde dört benzersiz sabiti (konteyner öneki, Node koşucusu, zaman aşımı, alt süreç ortamına `GINA_QA_DB`/`GINA_QA_JWT_SECRET`) yer değiştirir ve klonda `postgres` rolüne `auth.users` üzerinde SELECT/DELETE verir (bkz. Q02-8). Sır yazdırılmaz.

## 1. Zincir testi — ne doğrulandı

Aktörler: Aile A (kurucu veli a1, davet koduyla katılan a2), Aile B (b1, b2, iptal denemesi için b3), A'da iki çocuk; tek çocuğa ayarlı telefon (`devA`), iki çocuğa ayarlı ortak tablet (`tabA`); B'de bir çocuk ve telefon; `operations_members` destek rolü; `admins` satırıyla tam admin. Her olumlu adımda aynı istek yabancı aile/rol tarafından yinelendi ve reddi doğrulandı (`chain-details.json` içindeki etiketler).

| Adım | Olumlu akış | Yabancı/rol reddi (örnek etiketler) |
| --- | --- | --- |
| Kayıt → aile | parola girişi, `create_family`, `join_family`, claim'de `family_id/role` | yabancı aile satırı görünmez, yanlış davet kodu reddi |
| Çocuk | `save_child_setup` (eş veli dahil), paralel aynı istek tek kimlik | b1 çocuk güncelleme 0 satır, destek/admin REST'te 0 çocuk, yabancı PIN ayarı 42501 |
| Cihaz eşleme | ücretsiz planda 2. cihaz `plan_limit_devices`, pro ile ortak tablet; PIN girişleri | yabancı `configure_child_device`, kullanılmış eşleme kodu, yabancı `revoke_device` etkisiz (bkz. Q02-5) |
| Görev/rutin | eş veli görev oluşturur; **aynı revizyonla iki velinin eş zamanlı düzenlemesi → tek kazanan**, `task_routine_changed` | yabancı/cihaz görev ekleme, yabancı/destek rutin değişikliği |
| Çocuk gönderimi | çift dokunma (aynı `client_id`, paralel) tek satır; **kopuk ağ**: yanıt düşürüldü → aynı kimlikle tekrar → tek satır; **yavaş ağ** (1,5 s) sonrası tekrar tek satır | tablette c2 c1'in görevini, B cihazı/B velisi A görevini tamamlayamaz |
| Veli onayı | iki veli `review_task_once` paralel → bir onay, `already_reviewed`; yıldız bir kez | yabancı, cihaz, destek, admin `review_task` reddi |
| Ödül | paralel aynı `idempotency_key` → tek istek; paralel iki veli onayı → tek düşüm; yetersiz yıldız reddi | başka çocuk aynı anahtar `request_conflict`, yabancı cihaz/veli/destek reddi, yabancı ödül geçmişi reddi |
| Not | özel not eş veliye kapalı; paylaşınca güncel metin açık, geçmiş kapalı; `child` notu yalnız o çocuğun cihazında; arşiv/geri alma (geri gelen not özel) | eş veli düzenleme/arşiv 42501, yabancı aile 0 not, destek 0 not |
| Prova atama | taslak: yavaş ağ → kayıp yanıt → tekrar, **tek sürüm**; eski sürüm reddi; ikinci taslak kaldır/geri al (makbuz tekrarı); çift dokunma atama; **ücretsiz planda eş zamanlı iki atama → kota bir kez**, kaybeden taslak korunur | b1 A çocuğuna taslak 42501, yabancı/tablet c2 sınav okuyamaz, c2 `start_exam_attempt` reddi |
| Çocuk cevabı | cevap anahtarı yok; çift dokunma aynı revizyon; **telefon+tablet aynı çocuk, aynı beklenen revizyon → tek kazanan**, kaybeden üzerine yazmaz; bitince geç düzenleme reddi | B cihazı soru listesi boş |
| Veli inceleme | eş veli inceler; iki veli eş zamanlı puan → `review_changed`; çocuk tek puan görür | yabancı, destek, **admin** inceleme 42501 |
| Dönem raporu / okul puanı | `change_child_education` eş zamanlı → `education_changed`; dönem listesi; dönem raporu; puan kaydı ve eş zamanlı düzenleme → `school_grade_changed`; dönem sayfası | yabancı/admin dönem ve rapor 42501, bilinmeyen dönem `report_period_invalid` |
| Arşiv / geri alma | eş zamanlı arşiv → `archive_changed`; eski cihaz JWT'si anında boş; görevler duraklar; geri alma sonrası cihaz yeniden yapılandırmaya kadar kapalı; puan geçmişi korunur | yabancı/cihaz arşiv reddi |
| Jeton/rol iptali | süresi dolmuş JWT 401; imzası bozuk JWT 401; **üyeliksiz sahte `family_id` claim'i 0 satır/RPC reddi**; `admins` satırı yokken sahte `admin` claim'i reddi; gerçek admin satırı silinince eski jeton reddi; b3 üyeliği silinince eski jeton 0 satır/yazamaz; tablet iptali eski jetonla 0 satır; destek iptali anında | — |
| Silme | veli `children` satırını REST ile silebildi (bkz. Q02-6); eş veli hesabı silinince aile kalır, eski jeton kapalı, notları gider; son veli silinince aile, çocuklar, sınavlar, makbuzlar ve anonim cihaz kullanıcısı gider; B dokunulmamış | yabancı çocuk silme 0 satır |

Zaman damgaları: yavaş ağ taklidi 1.508 ms / 1.514 ms gidiş-dönüş (`timing_ms`).

## 2. Dayanıklılık — kanıt özeti

- **Veri/puan/kota iki kez tüketilmedi:** görev tamamlama, onay, ödül isteği/onayı, cihaz limiti, ücretsiz plan Prova kotası paralel çağrılarda tek etki; makbuz (`help_receipts`/`mutation_receipts`) ve danışma kilitleri işliyor.
- **Yetki aşılmadı:** 60'tan fazla yabancı aile/rol denemesinin tamamı 42501/hata veya boş sonuç. Claim tek başına yetmez: `gina.is_parent()` üyeliği, `gina.is_device()` cihaz/çocuk atamasını, `gina.is_admin()` `admins` satırını her istekte yeniden okur.
- **Taslak kaybolmadı:** yavaş ve kopuk ağda `save_prova_draft` tek sürümle kaldı; kota yarışını kaybeden taslak listede kaldı; iki oturumda kaybeden çizim üzerine yazmadı.
- Kopuk ağ taklidi: `scripts/test-e2e-family-chain.mjs` içindeki `lossy` proxy, sunucu işlemi tamamladıktan **sonra** istemci soketini yanıt vermeden kapatır (gerçek "yanıt kayboldu" durumu) veya yanıtı 1,5 s tutar.

## 3. Performans — ölçüm ve kanıt (`perf.json`)

Tohum: 250 görev şablonu (220 aynı çocuk), 300 tamamlama, 400 yıldız olayı, 220 okul puanı, 50 hazır kaynak, 27 sınav, 20 soruluk çizimli Prova (soru başına 10 çizgi × 40 nokta ≈ 16,5 KB belge). Ölçümler gerçek PostgREST yolu üzerinden `supabase-js` ile, ısınma sonrası 15 tekrar (yazmalar 20–25). Mutlak değerler **Docker Desktop/Mac yerel** değerleridir; aynı makinede başka ajan koşumları sürerken alınan ilk turda p50'ler 2–5× daha yüksekti (ör. çocuk yıldız okuması 1.073 ms, çocuk bugün listesi 641 ms). Üretim gecikmesi değildir; **görece** farklar anlamlıdır.

| Sorgu (uygulamadaki kaynak) | satır | bayt | p50 ms | p95 ms | EXPLAIN exec ms | Plan |
| --- | --- | --- | --- | --- | --- | --- |
| Veli ana ekran `task_templates` by family (`parent/index.tsx`) | 250 | 64.023 | 49,4 | 61,6 | 34,0 | **Seq Scan** task_templates, filtrede `gina.is_parent()` |
| Veli ana ekran `task_completions` hafta | 28 | 8.168 | 10,7 | 16,6 | 7,5 | index child_date |
| Veli ana ekran `star_events` by family (tüm defter, istemcide toplam) | 400 | 24.846 | 88,6 | 152,1 | 130,1 | **Seq Scan** star_events, satır başı `is_parent()` |
| Veli onay kuyruğu (`status=done`) | 43 | 16.663 | 30,0 | 90,3 | 24,6 | partial index |
| Görevler ekranı `task_templates` by child (`tasks-screen.tsx`) | 220 | 105.703 | 56,4 | 114,6 | 179,3 | **Seq Scan** (kısmi index yalnız `active`) |
| Çocuk bugün `task_templates` active (`use-child-today.ts`) | 198 | 43.858 | **199,0** | 250,4 | — | cihaz RLS satır başı `is_device()` |
| Çocuk yıldız defteri `star_events` by child | 300 | 3.634 | **242,3** | 334,2 | 425,2 | index var; **satır başı `is_device()`** (2.961 blok) |
| `school_grade_records` sayfa 1 / 2 (50'lik) | 50 | 10.450 | 17,6 / 15,5 | 32,9 / 25,2 | 16,4 | RPC, sayfalı |
| `learning_progress_education` / `learning_progress` 30 gün | 1 | 1.843 | 14,5 / 14,9 | 28,2 / 30,7 | 19,4 | RPC |
| Kaynak seçici `learning_sources` limit 30 (`learning-plan.tsx:435`) | 30 | 3.111 | 22,8 | 37,4 | 19,2 | index family+created |
| Prova listesi `exams` + attempts limit 100 | 27 | 14.357 | 43,7 | 164,9 | 21,7 | Seq Scan exams (27 satır) |
| İnceleme `exam_answers` + belgeler (`review/[attemptId].tsx`) | 20 | **333.754** | 47,0 | 115,7 | 18,6 | pkey; yük bayt ağırlıklı |
| Çocuk `get_saved_exam_answers_v3` | 20 | **333.394** | 46,7 | 109,9 | 50,0 | RPC |
| `get_attempt_questions` | 20 | 2.982 | 13,5 | 29,1 | — | RPC |
| Yazma: `submit_exam_answer_v3` çizimli | 1 | — | 16,7 | 83,5 | — | RPC |
| Yazma: taslak kaydet + ata (5 soru) | 1 | — | 13,2 | 23,9 | — | RPC |

### Deney A — RLS'te yardımcı fonksiyonları tek seferde değerlendirme (yalnız tek kullanımlık DB'de)

`pg_policies`'ten okunan 13 politika metinsel olarak `gina.is_parent()` → `(select gina.is_parent())` (aynı şekilde `is_device/family_id/child_id`) biçimine çevrildi ve aynı sorgular yeniden açıklandı/ölçüldü:

| Sorgu | EXPLAIN önce → sonra (ms) | REST p50 önce → sonra (ms) |
| --- | --- | --- |
| çocuk `star_events` toplamı (`child_star_balance_sum`, cihaz rolü) | 425,2 → **24,6** (17×) | 242,3 → **17,8** |
| çocuk bugün görevleri (cihaz rolü) | — | 199,0 → **19,1** |
| veli ana ekran `task_templates` | 34,0 → 5,2 | 49,4 → 16,8 |
| veli ana ekran `star_events` | 130,1 → 2,6 | — |
| görevler ekranı by child | 179,3 → 6,0 | — |
| `school_grade_records` (RPC, security definer) | 16,4 → 23,4 (etkisiz, beklenen) | — |

### Deney B — index adayları (aynı DB'de oluşturuldu, sonra DB silindi)

`star_events(family_id)`, `task_templates(family_id)`, `task_templates(child_id,sort_order)`, `exams(family_id,created_at desc)`. 250–400 satırlık tablolarda planlayıcı yalnız `task_templates(child_id,sort_order)`'ı seçti; diğerlerinde seq scan kaldı. Bu, üretim için olumsuz kanıt değildir: üretimde bu tablolar **tüm ailelerin** satırlarını tutar ve `family_id` filtresi indexsiz kalınca her ana ekran açılışı tüm tabloyu tarar. Bugünkü üretim hacmi küçük olduğundan öncelik orta.

## 4. Bulgular (kanıt + iş kimliği + öncelik)

| Kimlik | Öncelik | Bulgu ve kanıt | Önerilen düzeltme (uygulama değiştirilmedi) |
| --- | --- | --- | --- |
| **Q02-1** | **Yüksek** (performans) | RLS politikaları `gina.is_parent()`/`is_device()`/`family_id()`/`child_id()` çağrılarını **satır başına** değerlendiriyor; `is_device()` her satırda `devices`+`device_allows` alt sorgularını çalıştırıyor. Çocuk cihazında 300 satırlık yıldız defteri 242 ms, 198 görev 199 ms p50; aynı sorgular InitPlan biçiminde 18–19 ms (`perf.json → experiment.rls_initplan`, EXPLAIN 2.961 shared hit → 24,6 ms). | Yeni migration: etkilenen politikaları `(select gina.is_parent())` deseniyle yeniden tanımla (en az 13 politika listelendi; aynı desen diğer tablolarda da var). Alternatif/ek: `is_device()` sonucunu tek istek içinde sabitleyen `stable` sarmalayıcı. 077/079/086 pgTAP'ları değişmeden geçmeli. |
| **Q02-2** | Orta | Eksik indexler: `star_events(family_id)` yok (yalnız child); `task_templates(family_id)` yok, `task_templates(child_id)` yalnız `where active` (veli ekranı duraklatılmışları da okur → seq scan 250/220 satır); `exams` için `(family_id, created_at)` yok. Kanıt: `perf.json → explains` seq scan'ler, `index_candidates`. | Migration ile dört index; `task_templates_child_idx`'in kısmi koşulunu kaldırmak veya `(child_id, sort_order)` eklemek. |
| **Q02-3** | Orta | Veli ana ekranı ve çocuk ekranı yıldız bakiyesini **tüm `star_events` defterini çekip istemcide toplayarak** hesaplıyor (`parent/index.tsx:68`, `use-child-today.ts:83`): 400 satır/25 KB bugün, her onay/ödülle doğrusal büyür. | Sunucu tarafı toplam (ör. `gina.child_star_balance` üzerine veli/cihaz için RPC veya `child_id,sum(delta)` görünümü). |
| **Q02-4** | Orta | Prova inceleme ve çocuk cevap okuma tüm soruların çizim belgelerini tek yanıtta getiriyor: 20 soru × 16,5 KB = **334 KB** (`review/[attemptId].tsx:37`, `get_saved_exam_answers_v3`). Gerçek çizimler 40 noktalı 10 çizgiden büyüktür; tablette 20+ soruda yük MB'a çıkar. | Belgeleri soru başına/tembel yükle (`get_answer_review` zaten tekil ve 160 bayt); liste için belge olmadan özet kolonları. |
| **Q02-5** | Düşük | `revoke_device` yabancı veya olmayan cihaz kimliğinde hata vermeden `null` döndürüyor (etki yok, `foreign_revoke_device_has_no_effect` geçti; `chain-details.json → notes.foreign_revoke_device_response`). `get_attempt_questions` yabancı cihaza boş liste döndürüyor (sızıntı yok). | `revoke_device` için `device_not_found` istisnası; istemci "iptal edildi" yerine hata gösterebilsin. |
| **Q02-6** | Orta (ürün kuralı) | Veli, REST ile `children` satırını **doğrudan kalıcı silebiliyor** (`children_parent_all for all`): makbuz, revizyon, önizleme veya eş veli onayı yok; görev/tamamlama/sınav/puan kanıtı cascade ile sessizce gidiyor (`notes.parent_direct_child_delete rows:1`, `deleted_child_tasks_gone`). §3 "silme ayrı işlemdir, kanıt sessizce değişmez" ilkesiyle ve açık "kalıcı silmenin kapsamlı önizlemesi" işiyle çelişir. | `children` DELETE politikasını kaldır; kalıcı silmeyi `get_child_archive_preview` + makbuzlu RPC ile ve arşivden sonra sun. |
| **Q02-7** | Düşük | Kaynak seçicileri `limit(30)` ile sabit, sayfalama yok (`learning-plan.tsx:435`, `learning-plan-import.tsx:98`); 50 dosyada 20'si seçilemez. | Sayfalama veya arama; en azından "daha fazla" düğmesi. |
| **Q02-8** | Risk notu | Hesap silme tetikleyicisi (`gina.prepare_account_deletion`, SECURITY DEFINER, sahibi `postgres`) anonim cihaz kullanıcılarını `auth.users`'tan siler; bu, `postgres` rolünün `auth.users` üzerinde DELETE yetkisine bağlıdır. Yerel stack ve şablonda yetki var; test klonunda OWNER değişimi ACL'yi sildiği için "Database error deleting user" üretti (koşucu düzeltildi). Üretimde yetki **doğrulanmadı** (üretime bağlanılmadı). | Q03 kontrol listesine: üretimde `select has_table_privilege('postgres','auth.users','DELETE')` salt okunur kontrolü; `015_account_lifecycle` ve `093` pgTAP'ları yetkiyi varsayar. |
| Q02-9 | Bilgi | Dönem oluşturulmadan önce kaydedilen Prova denemesi yeni dönem raporunda görünmez, `unknown` döneminde kalır (tasarım gereği, `new_period_report_excludes_earlier_attempt`). | UI'da "dönemi belirsiz kayıtlar" görünür/erişilir olmalı; kontrol edilmedi. |

Ek gözlemler (kusur değil): `complete_task`/`request_reward`/`save_prova_draft`/`review_task_once` kayıp yanıt ve çift dokunmada doğru; `restore` edilen paylaşılan not özel olarak geri geliyor (tasarım gereği, kullanıcıya açıklanmalı); ücretsiz plan cihaz ve Prova limitleri yarış altında tek tüketim.

## 5. Kalan risk ve sınırlar

- Zincir Realtime/Storage/Edge ile değil, yalnız Auth+REST ile koştu; o yüzeyler 280'lik regresyonda kapsandı (gerçek WebSocket, Storage ve Deno `learning-source`). AI daima deterministik sahte sağlayıcı.
- Hesap silme **veritabanı etkisi** (admin `deleteUser` → tetikleyiciler) test edildi; `delete-account` Edge işleyicisinin parola/OTP yeniden doğrulaması bu gece HTTP ile çalıştırılmadı (birim testleri repoda).
- Performans sayıları yerel Docker'dan; aynı makinede eşzamanlı ajan yükü sonuçları 2–5× oynattı. Üretim pgbouncer/ağ gecikmesi dahil değil. Index kararları 250–400 satırda değil üretim hacminde yeniden değerlendirilmeli.
- Fiziksel iPhone/iPad/Android, dokunma tepkisi, bellek ve çizim akıcılığı ölçülmedi (Q02 "açılma, dokunma tepkisi, bellek" maddesi açık). Ekran okuyucu/erişilebilirlik Q00'da.
- Yabancı rol denemeleri RPC/REST yüzeyinde seçilmiş 60+ adımı kapsar; her RPC için tam matris değildir.
- `q02_isolated.py` mevcut koşucuyu metin yer değiştirmeyle sarar; `test-isolated-services.py` içindeki sabitler değişirse koşucu açıkça `q02_launcher_anchor_missing` ile durur.
- Bu rapor üretimde hiçbir şeyin değiştiğini iddia etmez; düzeltmeler (Q02-1…Q02-7) sabah koordinatör tarafından dağıtılacaktır.

## Dosyalar

- `scripts/q02_isolated.py` — izole servis kurulumunu yeni koşuculara açan sarmalayıcı.
- `scripts/test-e2e-family-chain.py` + `.mjs` — 296 kontrollük zincir; `chain-checks.json`, `chain-details.json`.
- `scripts/test-q02-sql.py` — izole boş DB'de pgTAP (tümü veya `--only`); `sql-checks.json`, `sql-checks-093.json`.
- `supabase/tests/093_q02_cross_family_matrix.test.sql` — 47 iddia.
- `scripts/test-q02-perf.py` + `q02-perf.mjs` — ölçüm, EXPLAIN, deneyler; `perf.json`.
- `regression-isolated-services.json` — main üzerinde 280 kontrol.
