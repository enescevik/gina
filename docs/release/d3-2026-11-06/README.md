# D3 — C07/C10 yönetim kalanları

6 Kasım 2026. Dal `worktree-agent-a7f2f0827570a234f`. Taban main `88b31be`. **Durum: KOD HAZIR + izole TEST EDİLDİ. Yayımlanmadı.** Main'e push edilmedi. Migration üretime uygulanmadı. Üretim ve demo DB'sine dokunulmadı, `db reset` yapılmadı.

## Commit'ler

| Commit | İçerik |
|---|---|
| `bfbd79d` | Migration `20261106370000_operator_scope_admin_and_question_notes.sql` ve pgTAP `123_operator_scope_admin_and_question_notes.test.sql` |
| `053bd5f` | Backoffice (kapsam ekranı, teslim hataları sayfası, soru notu, uygulama içi onay, menü ipucu, yönetici iptali), mobil paylaşım/katkı zinciri, core tipleri ve i18n |
| bu rapor | README, Playwright harness'i, kanıt dosyaları; `/questions` onay başlığı düzeltmesi |

## Ne yapıldı

### 1. Operatör kapsamı yönetimi (`/operator-scopes`)

- Sunucu:
  - `admin_operator_scopes()`: yayın operatörleri, rol durumu, kapsamlar, etkin yerler.
  - `admin_set_operator_scope(p_request_id, p_user_id, p_place_id, p_grant, p_reason, p_allow_global default false)`.
- Yalnız tam yönetici (`gina.assert_admin()`, canlı `admins` satırı). Operatör, veli ve sahte admin claim'i `forbidden` alır.
- İdempotent:
  - aynı istek kimliği aynı sonucu döndürür (`replayed`);
  - aynı istek farklı içerikle gelirse `request_conflict`;
  - var olan kapsamı vermek veya olmayanı kaldırmak `unchanged` döner ve denetim yazmaz.
- Denetim: her gerçek değişiklik `audit_log`'a `operations.scope.granted|removed` olarak yazılır (gerekçe, yer, kalan kapsam sayısı).
- Kurallar:
  - kapsam yalnız etkin yayın rolüne verilir (`operator_role_required`);
  - tam yönetici kapsamlanmaz (`operator_is_admin`);
  - pasif yer verilmez (`place_not_found`).
- **Son kapsam kilidi:** C10 kuralına göre kapsam satırı olmayan yayın operatörü bütün bölgelere duyuru gönderebilir. Son kapsamı kaldırmak yetkiyi genişletir. Bu yüzden `p_allow_global=true` olmadan `scope_last_would_widen` döner. Ekran bunu uygulama içi onayla ("Kaldır ve bütün bölgelere aç") ister.
- Ekran: operatör başına kart, rol durumu, kapsam çipleri (bölge/okul yolu), yer seçimi ve gerekçe. Ağ hatasında aynı değişiklik aynı istek kimliğiyle gönderilir. Menüde yalnız yöneticiye görünür.

### 2. Başarısız e-posta/SMS teslimleri (`/notifications`)

- C10'un `channel-failures.tsx` bileşeni yayın ekibinin "Bildirim teslimi" sayfasına bağlandı.
- Yeni okuma RPC'si `release_channel_failure_page(p_channel, p_reason, p_before, p_before_id, p_limit≤100)`:
  - gerçek keyset sayfalama: `(created_at, id) desc`;
  - süzgeçler: kanal (e-posta/SMS) ve neden (başarısız, hizmet ayarı eksikti, mükerrer, yeniden sıraya alınabilir);
  - `total`, `requeues_left`, `max_requeues=3` döner;
  - adres, payload ve doğrulama kodu dönmez.
- Yeniden sıraya alma C10'un `release_requeue_channel` RPC'sidir; değişmedi. En çok 3 kez yapılır, sonra satırda "Sınır doldu" yazar. Çift tıklama `already_queued` döner.

### 3. Soru bazlı katkı ret notu

- `gina.contribution_sets.question_notes jsonb` eklendi. Değer soru anahtarı → not eşlemesidir.
- Yazma:
  - yalnız retle yazılır;
  - sonradan değiştirilemez (`contribution_notes_immutable`);
  - kabul edilmiş kopyaya yazılamaz (`question_notes_reject_only`). Bu kontrol tetikleyicidedir.
- Yeni 7 parametreli `admin_decide_contribution_set(..., p_question_notes jsonb)`:
  - içerik rolü (C07 kapısı);
  - notları doğrular: nesne olmalı, anahtar bu kopyanın sorusu olmalı, metin 3–1000 karakter (`question_notes_invalid`);
  - kabulde not reddedilir (`question_notes_reject_only`);
  - kararı mevcut 6 parametreli fonksiyona bırakır ve notları aynı işlemde yazar;
  - aynı istek aynı notla tekrar gelirse aynı sonucu döndürür; farklı notla gelirse `request_conflict`;
  - denetim: `contribution_set.question_notes`.
- Notsuz çağrı (eski 6 parametreli ya da boş `{}`) birebir eski davranıştır.
- **Atomik kabul korundu:** kabul yine bütün grubun öğretmen alanlarını ister (`contribution_review_required`). Not hiçbir zaman kısmi kabule dönüşmez.
- Okuma:
  - `admin_get_contribution_set` → `question_notes`;
  - `contribution_review_trail` → `steps[].questions[] = {key, position, excerpt, note}`.
  - Notsuz ve eski adımlarda dizi boştur. Veli görünümünde iç kimlik yok.
  - İki gövde C07'nin `pg_get_functiondef` yöntemiyle genişletildi: yalnız bir alan eklendi. Beklenen parça tam bir kez bulunmazsa migration durur. C07 rol kapıları aynen kaldı.
- Yönetim (`/library?tab=review`):
  - her soruda "Bu soru için düzeltme notu" alanı var;
  - soru sekmesinde "· not" işareti görünür;
  - karar kartında hangi sorulara not yazıldığı özetlenir;
  - not varken "Kabul et" kapalıdır;
  - reddedilmiş kopyada soru notu salt okunur gösterilir.
  - Bekleyen karar kuyruğu (`contribution` journal) notları da saklar. Eski kayıtlar geçerli kalır.
- Mobil:
  - `contribution-trail.tsx`: reddedilen adımda "Soru bazında düzeltme notları" görünür (sıra, kısa kök, not) ve "Diğer N soru için düzeltme istenmedi; grup yine birlikte gönderilir." yazar.
  - `app/parent/prova/share.tsx`: düzeltme ekranında aynı liste görünür.
  - i18n'e yalnız yeni anahtarlar eklendi: `contributionTrail.questionNotes`, `questionLabel`, `questionsOk_*` (tr/en).

### 4. C12 yönetim P2'leri

- **Q00-C12-T2:** `/ai` (AI'ı kapat, model pasifleştir) ve `/questions` (global soru sil) artık `window.confirm` yerine uygulama içi `<dialog>` kullanır (`components/confirm-dialog.tsx`, `useConfirm`). Vazgeç ve Esc her zaman "hayır" sayılır.
- **Q00-A3-4:** masaüstü kenar menüde görünmeyen bölüm varsa her zaman görünür bir "↓ Aşağıda N bölüm daha" düğmesi çıkar ve menüyü kaydırır. Gizli kaydırma çubuğunda da ipucu verir.
- **Q00-A3-7 (yönetici kısmı):** `my_admin_access()` canlı `admins` kontrolüdür. Auth katmanı bunu rol yenilemesiyle birlikte çağırır: 30 sn'de bir, odakta ve görünürlükte. Claim yönetici diyor ama canlı kontrol `false` ise tek bir "Yönetici yetkiniz kaldırıldı" bildirimi çıkar, yönetici bölümleri menüden kalkar ve veri gizlenir. RPC yoksa veya hata verirse durum "bilinmiyor" sayılır ve iptal varsayılmaz.

## Testler (gerçekten çalıştırıldı)

Ortam: boş `gina_completion_audit` şablonundan geçici klon DB'ler; UI için geçici GoTrue + PostgREST konteynerleri. Mock yok. Gerçek e-posta/SMS/push/AI çağrısı yok.

| Test | Sonuç |
|---|---|
| pgTAP 123 (tek dosya, kendi dev DB'mde) | **116 ok, 0 not ok** |
| pgTAP 113 (C07 rol matrisi), 116 (C10), 098, 102, 110, 119 (aynı dev DB, D3 migration uygulanmış) | 191 / 81 / 155 / 16 / 47 / 74 ok, **0 not ok** |
| Tam pgTAP `Europe/Istanbul` (`scripts/test-q02-sql.py --run-local --out docs/release/d3-2026-11-06/pgtap-istanbul`) | **120 dosya / 5388 kontrol, 0 başarısız** (113: 191, 116: 81, 123: 116) |
| Tam pgTAP `UTC` (`--timezone UTC --out …/pgtap-utc`) | **120 dosya / 5388 kontrol, 0 başarısız** |
| `pnpm --filter @gina/backoffice typecheck` | `✓ Types generated successfully`, tsc hatasız |
| `pnpm --filter @gina/backoffice lint` | çıkış 0 (ilk koşuda `set-state-in-effect` hatası çıktı, düzeltildi) |
| `pnpm --filter @gina/backoffice build` | çıkış 0; `/operator-scopes`, `/notifications` statik çıktıda |
| `pnpm --filter @gina/core test` / `tsc --noEmit` | **59 dosya / 418 test geçti** (yeni `contribution-question-notes.test.ts` 3 test) / çıkış 0 |
| Mobil `pnpm exec tsc --noEmit` / `pnpm exec expo lint` | çıkış 0 / çıkış 0 |
| İzole servis + Playwright (`harness/d3-ui.cjs`, Chrome headless, tr-TR) | **10/10** ([ui/ui-checks.json](ui/ui-checks.json), 20 ekran `ui/screenshots/`) |

pgTAP 123 kapsamı:
- anon EXECUTE yüzeyi değişmedi; yeni RPC'ler worker'a kapalı; yeni tablo RLS'li ve özel.
- Kapsam:
  - release, içerik, destek, veli ve sahte admin claim'i reddi;
  - liste içeriği (süresi dolmuş rol pasif, pasif yer yok);
  - ver → tekrar (`replayed`) → çakışma → `unchanged`;
  - tek satır ve tek denetim; gerekçe ve verenin kaydı;
  - süresi dolmuş rol, içerik rolü, yönetici, pasif yer ve kısa gerekçe reddi;
  - kapsamın duyuru hedefini gerçekten daraltması (`announcement_scope_allowed`);
  - son kapsam kilidi ve açık onayla kaldırma; operatörün tekrar globale dönmesi;
  - açık oturumda `admins` silinince aynı JWT ile `forbidden`; `my_admin_access` true → false.
- Teslim sayfası:
  - veli ve içerik reddi;
  - 37 kayıt 10+10+10+7 sayfada kesişimsiz, tekrar yok;
  - kanal, neden ve birleşik süzgeç; limit kırpma; geçersiz kanal/neden; yarım cursor;
  - adres, payload veya kod sızmıyor; doğrulama kodu yeniden sıraya alınamaz;
  - 3 yeniden sıraya almadan sonra 4.'sü `channel_requeue_limit` ve satır artık sunulmuyor; 3 denetim.
- Soru notu:
  - veli ve yayın rolü reddi;
  - kabulle not reddi; geçersiz anahtar, kısa not, dizi ve sayı reddi (durum değişmez);
  - notlu ret, kırpılmış saklama, tekrar, farklı notla `request_conflict`, ikinci karar `contribution_changed`;
  - tek not denetimi ve tek ret denetimi;
  - yönetim ve içerik izi notu okur;
  - eski 6 parametreli ret değişmedi;
  - not yeniden yazılamaz;
  - veli izinde 2 soru, notlu soru, notsuz soru, kısa kök, sıra, genel not; iç kimlik yok;
  - başka aile göremez;
  - düzeltme zinciri: kabul edilen adımda not yok, reddedilen adımda not kalır; kabul edilmiş kopyaya not yazılamaz;
  - **grupta kısmi kabul hâlâ `contribution_review_required`**; not kısmi kabule dönüşemez; bütün grup kabulü 2 soruyu sayar;
  - rolü iptal edilen içerik operatörü `forbidden` alır.

Playwright (`ui/ui-checks.json`):
1. `operator_scope_screen_admin_only`: yayın operatörünün menüsünde bağlantı yok; sayfa açılmıyor; aynı token ile RPC 403.
2. `scope_grant_double_click_one_row_one_audit`: çift tıklama → 1 kapsam satırı, 1 denetim.
3. `scope_last_removal_needs_in_app_confirmation`: son kapsamda uyarılı onay çıkıyor; Vazgeç satırı koruyor; onay → kaldırıldı ve "bütün bölgeler" uyarısı; 2 denetim; tarayıcı diyaloğu 0.
4. `channel_failures_filters_paging_requeue_limit`:
   - 1–25 / 36 → 26–36 / 36 → geri;
   - SMS 4; yeniden sıraya alınabilir 33; başarısız 30;
   - 3/3 satırında "Sınır doldu" ve düğme yok;
   - yeniden sıraya alma → DB `pending:1`, 1 denetim; sınırdaki satır RPC'de `channel_requeue_limit`;
   - kartta adres yok.
5. `content_operator_rejects_with_question_note`: içerik operatörü 2. soruya not yazdı; not varken kabul kapalı; geri gönder → DB `rejected` + `q2` notu, 1 denetim; salt okunur not görünüyor.
6. `ai_and_questions_use_in_app_confirmation`: `/ai` kapatma onayı ve `/questions` silme onayı uygulama içinde; Vazgeç ve Esc hiçbir şeyi değiştirmedi; tarayıcı diyaloğu 0.
7. `sidebar_hidden_sections_hint`: 1280×640'ta "↓ Aşağıda 13 bölüm daha"; tıklayınca menü 211 px kaydı.
8. `admin_revocation_single_notice`: `/families` açıkken `admins` satırı silindi; odakta tek "Yönetici yetkiniz kaldırıldı" bildirimi; yönetici bölümleri menüden kalktı; aynı token ile RPC 403.
9. `parent_sees_question_notes_on_trail_and_fix_screen` (390×844, Expo web dışa aktarımı): paylaşım geçmişinde ve düzeltme ekranında "Soru bazında düzeltme notları", "2. soru · …", not metni, "Diğer 1 soru…" ve atomik kabul notu görünüyor.
10. `no_page_errors_no_overflow_no_raw_keys`: sayfa hatası yok; her ekranda yatay taşma, ham i18n anahtarı ve ham sunucu hatası yok.

Yönetim ekranları 1280×800 ve 768×1024'te çekildi; menü ipucu ayrıca 1280×640'ta. Harness ilk iki koşuda test hatası verdi, ürün hatası değildi:
- teslim sayfasında sınırdaki satırı yanlış sayfada aradı;
- onay başlığı gövde metniyle aynı olduğu için seçici iki öğe buldu. Başlık "Global soruyu sil" yapıldı.

Üçüncü koşu 10/10 geçti. Her koşu kendi `gina_d3_<hex>_audit` DB'sini ve 2 konteynerini sildi (`cleanup`: `containers_left: none`, `database_left: 0`). Dev DB `gina_d3dev_audit` silindi; scratch dışa aktarımı silindi.

## Bulgu (bu turda düzeltilmedi)

- **İçerik operatörü katkıyı kabul edemiyor.** C07, `admin_decide_contribution_set`'i içerik rolüne açtı. Ama kabul yolu içeride `admin_import_library_bundle`'ı çağırıyor ve bu fonksiyon C07'de bilerek yönetici yazması bırakıldı (`gina.assert_admin()`). Sonuç: içerik operatörü reddedebilir, kabulde `forbidden` alır. Bunu dev DB'de pgTAP 123 ilk koşusunda gördüm. 113 bu yolu sınamıyor. Düzeltmek C07'nin "içe aktarma yönetici yazmasıdır" kararını değiştirmek demek; karar gerektirdiği için dokunulmadı. pgTAP 123 ve UI'da kabuller yöneticiyle yapıldı.

## Kalan sınır

- **Yayımlanmadı.** Yayın sırası: önce migration `20261106370000`, sonra backoffice ve mobil.
  - Migration yoksa `/operator-scopes`, teslim hataları kartı ve soru notlu ret hata verir.
  - Mobil yeni alan isteğe bağlıdır; eski sunucuda liste görünmez.
  - Canlı yönetici kontrolü RPC yoksa devre dışı kalır.
- `packages/core/src/database.types.ts` yeniden üretilmedi. Paralel ajanlar aynı dosyayı değiştirdiği için yeni RPC'ler `adminRpc` ile (tipsiz çağrı + çalışma zamanı doğrulaması) çağrılıyor.
- Kapsam yalnız yayın rolü içindir (tablo kısıtı `role='release'`). Rol verme/kaldırma ekranı bu işin kapsamında değil; hâlâ `set_operation_member` RPC'si ile yapılıyor, UI'ı yok.
- Soru notları serbest metindir. Yapılandırılmış ret nedeni kataloğu yok. Eski (D3 öncesi) retlerde soru listesi boştur.
- Menü ipucu headless Chrome'da doğrulandı. Gerçek macOS kaydırma çubuğu davranışı ve ekran okuyucu kabulü C15'e kalır.
- Mobil yalnız 390×844 web dışa aktarımında sınandı. Native cihaz, EN dil ve tablet sınanmadı.
- C10'un `release_channel_failures(p_limit)` RPC'si yerinde duruyor. Kullanılmıyor, silinmedi.
