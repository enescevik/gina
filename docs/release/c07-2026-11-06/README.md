# C07 — Operatör rolleri, yönetim kuyrukları ve P05 aile bağlantısı (B01–B04 / P05)

6 Kasım 2026. Dal: `worktree-agent-aac0ce6cbd0728b43`. Taban: main `b8bef9e`, sonra main `e23828e` (C02/C04/C05/C06) birleştirildi. **Durum: KOD HAZIR + izole TEST EDİLDİ. Yayımlanmadı.** Main'e push edilmedi. Migration üretime uygulanmadı. Demo/üretim DB'sine dokunulmadı, `db reset` yapılmadı. Fiziksel cihaz kabulü yapılmadı.

Eski görev bağlantısı: B01 (iş kuyruğu, /billing), B02 (içerik yaşam döngüsü ve yayın rolü), B03 (Birlikte Prova oluşturma, önizleme, dağıtım; ortak inceleme), B04 (destek "atanmamış", hazır yanıtlar, duyuru hedefi), P05 (mobil kütüphane, paylaşım ve grup). Kart: `docs/CLAUDE-REMAINING-WORK.md` §4A C07.

## Commit'ler

| Commit | İçerik |
|---|---|
| `31b6f25` | Migration `20261106270000_operator_access.sql` ve pgTAP `113_operator_access.test.sql` |
| `08d2a10` | Backoffice rol matrisi, sayfalama, hazır yanıtlar, push hedefi, tablet satırları |
| `8d216d5`, `e81c162` | Mobil P05 (alt ajan; ayrı worktree dalı `worktree-agent-a2201a96369afad5f`) ve izole mobil UI kontrolleri |
| `2b354d0` | Mobil dalın birleştirilmesi |
| `143e9e6` | Sayfa düzeyi sorgular rol Layout'u içinde; yayın ekibinde inceleme kutuları gizli; 097 yeni "atanmamış" tanımı; Playwright harness'i |
| `edc3627` | main birleştirmesi (yalnız `i18n/{tr,en}.json` sonu çakıştı; iki taraf korundu) |
| bu rapor | README, kanıt dosyaları |

## Rol matrisi (UI ve RPC birlikte)

Tam yönetici her role sahiptir (`gina.has_operation_role` zaten öyleydi). Operatör yetkisi her çağrıda `operations_members` tablosundan canlı okunur. Süresi dolan veya iptal edilen rol aynı JWT ile bir sonraki çağrıda `forbidden` alır.

| Bölüm | admin | destek | içerik | finans | yayın |
|---|---|---|---|---|---|
| `/dashboard` (yalnız kendi rolünün iş kuyruğu; aile sayaçları yalnız yönetici) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/families`, `/overrides`, `/ai`, `/operations`, `/questions` | ✓ | — | — | — | — |
| `/support`, `/ideas`, `/support-replies` | ✓ | ✓ | — | — | — |
| `/billing` | ✓ | — | — | ✓ | — |
| `/library`: Tüm içerik | ✓ | — | ✓ | — | ✓ (salt okuma, AI isteği yok) |
| `/library`: Taslak paketler, Katkılar | ✓ | — | ✓ | — | — |
| `/library`: Koleksiyonlar, Haklar/ödüller, Senaryo kaynakları | ✓ | — | — | — | — |
| `/library-publication` önizleme | ✓ | — | ✓ (salt önizleme) | — | ✓ |
| `/library-publication` yayın / geri çekme kararı | ✓ | — | — | — | ✓ |
| `/groups` oluşturma, önizleme, dağıtım, iptal | ✓ | — | ✓ | — | — |
| `/groups` katılım hakkı politikası | ✓ | — | — | — | — |
| `/cohort-review` | ✓ | — | ✓ | — | — |
| `/announcements`, `/notifications` | ✓ | — | — | — | ✓ |
| `/help-articles`, `/education-calendars` (değişmedi) | ✓ | — | ✓ | — | — |

Kontrol: `ui/ui-checks.json` → `role_matrix_ui_and_rpc`.

Kimseye tam yönetici yetkisi veya `/families` açılmadı. Aile bilgisi ihtiyacı ile sunucu izni ayrı tutuldu:

- Finans: `admin_families_search` (aile adı, paket, eşleşme işareti; e-posta ve çocuk adı dönmez) ve `finance_workspace` kullanılır.
- Destek: aile bilgisini yalnız talep bağlamında görür. `admin_families_search` B01'de destek için açılmıştı; C07'de UI'da kullanılmıyor.

## Sunucu (`20261106270000_operator_access.sql`)

- `gina.has_any_operation_role(text[])`, `gina.assert_operation_role(text[])`.
- **Yeniden kapılama:** aşağıdaki fonksiyonların gövdesi `pg_get_functiondef` ile aynen yeniden kurulur. Yalnız tek `gina.assert_admin()` satırı değiştirilir. Satır tam bir kez bulunmazsa migration durur (`c07_regate_unexpected_body`). Yardımcı fonksiyon migration sonunda silinir.
  - İçerik:
    - kütüphane: `admin_learning_library`, `admin_review_contribution`, `admin_list_library_draft_packages`, `admin_get_library_import`, `admin_get_library_reviews`, `admin_review_library_question`, `admin_list_contribution_sets`, `admin_get_contribution_set`, `admin_decide_contribution_set`, `admin_library_content_items`, `admin_library_group_integrity`;
    - AI ön inceleme: `admin_content_prereviews`, `request_content_prereview`, `enqueue_content_prereview`;
    - Birlikte Prova: `admin_group_exams`, `admin_group_package_catalog`, `admin_create_group_exam`, `admin_create_reviewed_group_exam`, `admin_cancel_group_exam`;
    - ortak inceleme: `admin_cohort_review_queue`, `admin_cohort_review_detail`, `admin_save_cohort_review`, `admin_publish_cohort_results`.
  - İçerik ve yayın: `admin_library_publication`, `admin_library_package_trail`.
  - Yayın: `admin_set_library_publication`. Yayın kuralları aynen korunur: inceleme parmak izi, medya, sürüm.
  - `contribution_review_trail` ve `group_exam_phases`: yönetici dalı içerik rolüne de açıldı. Veli dalı aynı kaldı.
  - Yönetici yazması olarak kalanlar: `admin_group_policy`, `admin_set_library_quota`, `admin_save_contribution_reward`, `admin_save_library_collection`, `admin_add_library_item`, `admin_publish_library_item`, `admin_import_library_bundle`, curriculum RPC'leri (C05), overrides ve AI.
- **B01 iş kuyruğu "sorumlusuz":** `tickets_unassigned` artık açık veya işlemdeki destek talebinde `assignee_id is null` demektir. Neden kodu `no_assignee`. `admin_support_queue(p_assignee='none')` ile aynı sayıyı verir. 097 test 15 bu tanıma göre güncellendi (eski beklenti "operatör cevabı yok" idi).
- **Hazır yanıtlar:**
  - Tablolar:
    - `gina.support_canned_replies`: TR/EN, kategori, sıra, arşiv, sürüm. Aynı dilde etkin başlık tekil.
    - `gina.support_canned_commands`: istek makbuzu.
  - Mevcut 5 TR metin taşındı; 5 EN karşılığı eklendi.
  - `support_canned_replies(p_locale, p_ticket, p_include_archived)`: varsayılan dil talep eden ailenin `families.locale` değeridir.
  - `save_support_canned_reply(...)` davranışı:
    - yalnız destek rolü;
    - beklenen sürüm (`canned_reply_changed`);
    - aynı istek kimliği tekrar gelirse `replayed`; farklı içerikle gelirse `request_conflict`;
    - dil değiştirilemez;
    - denetim kaydı.
- **İçerik sayfalama:** `admin_library_content_page(p_kind, p_status, p_prereview, p_cursor, p_limit≤200)` gerçek keyset sayfalamadır.
  - Sıra `(updated_at, kind, id) desc`.
  - AI süzgeci sunucudadır.
  - Senaryo adayları `curriculum_candidate` türüyle listede yer alır ve AI ön inceleme durumunu taşır. Adayın yönetici kararı kendi akışındadır (C05).
  - Bozuk cursor `cursor_invalid` döner.
- **Duyuru push hedefi:** `admin_announcement_push_audience(p_id, p_revision)` yayın rolüne açıktır. push-send ile aynı koşulları sayar: velinin o ailede cihaz kaydı + duyuru tercihi + açık oturum. Döner: `eligible`, `devices` ve `blocked{no_device, opted_out, signed_out}`.

## Backoffice

- `Layout`:
  - Yeni `roles` (herhangi biri yeter) özelliği var. Layout içindeki sorgular `OperatorAccessContext` ile operatörde de yüklenir; sunucu yine her RPC'de kontrol eder.
  - Açık oturumda bir rol kaldırılırsa veri gizlenir ve "Yetkiniz kaldırıldı" gösterilir (`seenRoles`). Eskiden yalnız "yetki gerekiyor" yazıyordu.
  - Operatör menüsünde yalnız izinli bölümler görünür. Giriş ve `/` operatörü kendi iş kuyruğuna (`/dashboard`) götürür.
- İş kuyruğu: yönetici ekranına giden kalemler (senaryo, geçici hak, AI) operatörde bağlantı yerine "Yönetici ekranı" etiketiyle gösterilir. "Sorumlusu atanmamış talepler" kalemi `/support?assignee=none` açar; süzgeç bu değerle başlar.
- `/billing`:
  - Aile listesi `admin_families_search` ile gelir: 50'şer kayıt, cursor ile "Sonraki 50", çocuk adı veya e-posta parçasıyla eşleşme işareti.
  - Süzgeç değişince liste ve cursor sıfırlanır.
  - "İlk 50" sınırı kalktı. `finance_workspace` artık yalnız özet, ayrıntı ve bildirimler için kullanılır.
- `/library` Tüm içerik:
  - Ortak `useKeysetList` kullanır (`lib/keyset.ts`): süzgeç anahtarı değişince sıfırlanır; aynı kimlik ikinci kez gelirse `page_out_of_order`.
  - "İlk 200" uyarısı kalktı.
  - Senaryo adayında AI rozeti var. Paket satırında "Yayın önizlemesi" bağlantısı var.
  - Yayın ekibi görünümü salt okumadır.
- `/library-publication`: içerik ekibi önizler; form kilitlidir ve "Önizleme modundasınız" notu görünür. Yayın kararı yayın ekibi ve yöneticidedir.
- `/groups`: katılım hakkı politikası yalnız yönetici. Oluşturma, önizleme ve dağıtım içerik ekibine açık.
- `/support-replies` (yeni): TR/EN sekmeleri; ekle, düzenle, arşivle ve geri al. Ağ hatasında aynı istek kimliği yeniden gönderilir. Görüşmede "Hazır yanıt ekle" ailenin dilini seçer; TR/EN arasında geçilebilir. Metin yalnız taslağa eklenir, gönderilmez.
- `/announcements` önizleme: push kartı gerçek sayıyı gösterir (ulaşılabilir veli ve cihaz, engel nedenleri) ve "sağlayıcı kabulü teslim değildir" notunu taşır.
- Tablet (768) sıkışıklıkları:
  - `/families`: satır 768–1279 aralığında 3 sütun; işlemler alt satırda. 4 sütun ≥1280.
  - `/billing`: aile listesi kaydırma alanı 250 → 420 px.
- i18n: backoffice metinleri mevcut düzende bileşen içinde. Yeni anahtarlar yalnız mobil tarafta, `packages/core/src/i18n` dosyalarına eklendi.

## Mobil P05 (alt ajan; ayrıntı `mobile/ui-checks.json`)

- `library.tsx`:
  - `family_library_credits` hak özeti;
  - `library_policy_preview` politika önizlemesi;
  - aynı birim yeniden edinildiğinde "hak kullanmadı" bildirimi (sunucu sayımı edinim öncesi ve sonrası karşılaştırılır).
- `share.tsx`:
  - zincir `contribution_review_trail` ile kurulur: ret → düzeltme → yeniden gönderim;
  - düzeltme `begin_question_contribution(..., p_supersedes)` ile gönderilir; görselli kopya için Edge `supersedes` yolu kullanılır;
  - ortak kaynaklı grupta atomik kabul korunur; kısmi kabul yoktur ve bu açıklanır.
- `groups.tsx`:
  - `group_exam_phases` aşamaları;
  - `get_group_result` için `ranking_reason` açıklaması ve "Ara sayım" etiketi.
- Yeni bileşenler: `apps/mobile/src/components/prova-library/{library-credits,contribution-trail,group-phases}.tsx`.
- i18n: yalnız yeni anahtarlar eklendi (`libraryCredits.*`, `contributionTrail.*`, `groupPhases.*`).

## Testler (gerçekten çalıştırıldı)

Ayrım: hepsi **izole** ortamda koştu. Ortam: `gina_completion_audit` boş şablonundan geçici klon + geçici GoTrue/PostgREST. **Mock yok.** Gerçek sağlayıcı (push, e-posta, AI) çağrılmadı; push yalnız hedef sayısıdır.

- **pgTAP 113** (`113_operator_access.test.sql`): **191/191**. Kapsam:
  - 5 rol × 24 RPC izinli ve yasak matrisi;
  - veli, süresi dolmuş operatör ve sahte admin claim'i reddi; anon yetkisizliği;
  - aynı JWT ile içerik rolü iptali, yayın rolü süre bitimi ve `admins` satırı silinmesi;
  - yeniden kapılanan gövdelerin yayın kurallarını koruması; `admin_group_policy` yönetici olarak kalır;
  - sorumlusuz tanımı ve `admin_support_queue(none)` eşitliği; destek kuyruğunda finans kalemi yok;
  - hazır yanıtlar: varsayılan dil, ailenin dili, idempotency, `request_conflict`, tekil başlık, kategori, eski sürüm, dil değişmezliği, arşiv, denetim sayısı, içerik rolü yazamaz;
  - 232 kayıtta 100+100+32 kesişimsiz sayfalama; limit kırpma; cursor ve tür hatası; aday süzgeci ve AI durumu; sayısal olmayan sınıf; AI ve durum süzgeci; ekip notu sızmaz;
  - push hedefi ayrımı ve toplamın alıcı sayısına eşitliği;
  - içerik rolünün grup fazı ve katkı izine erişimi; destek rolünün reddi; veli dalı değişmedi.
- **Tam pgTAP** (main birleştirmesi sonrası, `scripts/test-q02-sql.py --run-local`):
  - `Europe/Istanbul`: **112 dosya / 4635 kontrol, 0 başarısız** (`pgtap-europe-istanbul/sql-checks.json`).
  - `UTC`: **112 dosya / 4635 kontrol, 0 başarısız** (`pgtap-utc/sql-checks.json`).
  - Birleştirme öncesi ara koşularda iki **önceden var olan kararsız test** görüldü. İkisi de yalnız başına yeniden koşulunca geçti:
    - `102_rls_grant_hygiene` test 5: `string_agg(..., ',' order by 1)` sabite göre sıralıyor, iki fonksiyon adının sırası rastgele (`sql-checks-premerge-102-flake.json`);
    - `095_notification_channels` test 99: "bozulmuş" imza son karakteri `'0'` yapıyor; imza zaten `0` ile bitiyorsa bozulmuyor (1/16 olasılık).
    - Bu iki dosya C07'nin değil; düzeltilmedi.
- **Backoffice:** `pnpm --filter @gina/backoffice typecheck` → `✓ Types generated successfully`, tsc hatasız. `lint` → `eslint .` hatasız. `build` → statik dışa aktarım başarılı (`/support-replies` dahil).
- **Mobil:** `pnpm exec tsc --noEmit` → 0. `pnpm exec expo lint` → 0.
- **Core:** `pnpm --filter @gina/core test` → `Test Files 55 passed`, `Tests 391 passed` (birleştirme sonrası).
- **Backoffice Playwright** (`harness/{run.py,build.py,tour.cjs}`, Chrome headless, 1280×800 ve 768×1024, birleştirme sonrası koşu): **13/13** (`ui/ui-checks.json`, 38 ekran `ui/screenshots/`):
  - `role_matrix_ui_and_rpc`: 5 rol × 13 sayfa; operatör menüsünde yasak bağlantı yok; aynı tarayıcı oturumunun token'ıyla 12 RPC izinli ve yasak.
  - `operator_dashboard_scoped_workqueue`: her operatör yalnız kendi rol başlığını görür; `admin_dashboard` isteği yapılmaz.
  - `support_unassigned_is_assignee_based`: kalem 1 (DB ile aynı); "Aç" → `assignee=none`; atanmış talep listede yok.
  - `canned_replies_managed_tr_en_idempotent`: çift tıklamada 1 satır ve 1 denetim; arşivlenen yanıt görüşmede çıkmaz; eski sürüm reddedilir; EN aile varsayılanı; TR'ye geçiş; ekleme mesaj göndermez.
  - `team_note_not_leaked`: veli `get_help_ticket` çıktısında, içerik ekranında ve hazır yanıt yanıtında ekip notu yok.
  - `billing_keyset_beyond_50_and_filter_reset`: 50 → 100 → 134 (DB toplamı), tekrar yok; arama → 10 satır (cursor sıfırlandı); ayrıntı açılır.
  - `content_keyset_beyond_200_candidate_badge_filter_reset`: 50 × 4 + 32 = 232 (DB'deki görünüm + aday sayısı); aday süzgeci → 1 satır, `needs_admin` rozeti; süzgeç geri alınınca 50'ye sıfırlanır; AI süzgeci sunucuda; içerik sekmeleri: Tüm içerik / Taslak / Katkılar.
  - `release_library_view_and_publication_role`: yayın ekibinde tek sekme ve seçim kutusu yok. İçerik önizlemesi kilitli; yayın ekibinde kilit yok. İçerik `admin_set_library_publication` → 403; yayın ekibi yayın kuralına ulaşır (`library_publication_input`).
  - `content_group_create_preview_distribute_once`: içerik ekibi paket seçti, önizleme 3 adımı gösterdi, onay sonrası çift tıklandı → 1 grup, `created_by` içerik operatörü.
  - `content_cohort_review_queue`: içerik ekibi ortak inceleme kuyruğunu açar.
  - `announcement_push_audience_real_counts`: "Ulaşılabilir: 1 veli · 2 cihaz", kapatmış 1, cihazı yok 2. Duyuru taslak kaldı; outbox'a kayıt yazılmadı.
  - `role_revocation_in_open_tab`: içerik, finans ve destek için açık sekmede SQL ile iptal → odak yenilemesi → "Yetkiniz kaldırıldı". Veri kaldırıldı; aynı token ile RPC 403.
  - `no_page_errors`: sayfa hatası yok. Her ekran görüntüsünde yatay sayfa taşması yok.
  - Bu tur birleştirme öncesi 3 koşuda gerçek hatalar buldu ve düzeltildi:
    - sayfa düzeyindeki sorgular (groups, library) Layout dışında kaldığı için operatörde yüklenmiyordu;
    - yayın ekibinde kullanılamayan seçim kutuları görünüyordu.
  - Test hataları da düzeltildi: `/ideas` destek sayfası beklentisi; RPC matrisinin kendi `admin_dashboard` çağrısının sayılması.
- **Mobil Playwright** (alt ajan, 390×844 ve 1280×800, `scripts/test-c07-mobile-ui.cjs`, birleştirme öncesi): **8/8** (`mobile/ui-checks.json`, 15 ekran). Kapsam:
  - kredi ve politika önizlemesi;
  - aynı edinim iki kez → `library_redemptions=1`, `monthly.used=1`;
  - ret zinciri ailede görünür; başka ailenin zinciri `contribution_not_found`;
  - `contribution_unchanged`;
  - düzeltme çift dokunmada tek satır; `supersedes_id` bağlı; ikinci düzeltme `contribution_supersede_taken`;
  - grup kaydı çift dokunma ve yeniden denemede tek kayıt;
  - bitmemiş deneme `ranked=false`, `unfinished`, `interim` ve kesin tabloda yok;
  - taşma, UUID veya JSON yok.
- **Temizlik:** her harness koşusu `{"…_rest": true, "…_auth": true, "db_dropped": true}` yazdı. Son kontrol: `docker ps -a | grep gina_c07` → 0; `pg_database like 'gina_c07%'` → 0. Geliştirme DB'si `gina_c07dev_audit` silindi. Fixture, parolalar ve anon JWT yalnız scratch klasöründe tutuldu; repoda yok.

## UI referans karşılaştırması

Yeni tasarım yönü üretilmedi. Mevcut yönetim bileşenleri ve `globals.css` sınıfları kullanıldı. Onaylı referansla piksel karşılaştırması **yapılmadı**; kanıt yalnız çalışan uygulamanın ekran görüntüleridir.

## Kalan sınırlar

- **Yayımlanmadı.** Yayın sırası: önce migration `20261106270000`, sonra backoffice ve mobil. Migration yayımlanmadan yeni sayfalar `admin_library_content_page` / `support_canned_replies` / `admin_announcement_push_audience` için hata verir.
- Yeniden kapılama metin değişimiyle yapılır. Bu migration'dan **sonra** aynı fonksiyonları `create or replace` ile yeniden tanımlayan bir migration, yetkiyi tekrar yöneticiye daraltır. pgTAP 113 matrisi bunu yakalar.
- Destek rolü sunucuda `admin_families_search` çağırabilir (B01 kararı). C07 UI'ı bunu kullanmıyor; daraltılması ayrı karar ister.
- Hazır yanıt yönetimi destek ekibinin tamamına açık; ayrı "destek lideri" rolü yok.
- Push hedefi sayıdır; gerçek push gönderilmedi. Kanal sağlayıcıları X01/X02'ye bağlı.
- Tablet (768) içerik tablosu kendi kapsayıcısında yatay kayar; sayfa taşmaz. Kart görünümüne çevrilmedi.
- Soru bazlı ret gerekçesi veliye gösterilemiyor. `contribution_review_trail` yalnız kopya düzeyinde not taşıyor; ortak kaynakta sorunlu üye serbest notla anlatılıyor. Sunucu sözleşmesi gerekir (`steps[].questions[]` veya ret kararında `question_notes`). Bu turda **eklenmedi**.
- Mobil açıklar:
  - görselli düzeltmenin Edge + Storage yolu izole testte koşulmadı;
  - EN, tablet ve native cihaz görünümü sınanmadı;
  - `unreadable`, `unscored`, `results_not_published` ve `no_consent` nedenleri yalnız metin eşlemesiyle var.
- C05 kendi senaryo adayı listesine (curriculum-review) ayrıca aday ve AI rozeti ekledi. C07 rozeti birleşik içerik listesindedir; ikisi aynı `content_prereviews` kaydını okur.
- Fiziksel cihaz, ekran okuyucu ve klavye kabulü yok. C15 kapsamı.
