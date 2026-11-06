# D7 — İçerik operatörü katkı kabulü ve operatör rol yönetimi

6 Kasım 2026. Dal `worktree-agent-a39547fe5e5b4d045`. Taban main `32a8f72` (D3 birleşmiş). **Durum: KOD HAZIR + izole TEST EDİLDİ. Yayımlanmadı.** Main'e push edilmedi. Migration üretime uygulanmadı. Üretim ve demo DB'sine dokunulmadı, `db reset` yapılmadı. Mobil dosyalara dokunulmadı.

## Commit'ler

| Commit | İçerik |
|---|---|
| `47f5ebb` | Migration `20261106390000_content_accept_and_role_admin.sql` ve pgTAP `125_content_accept_and_role_admin.test.sql` |
| `400197c` | Backoffice: `/operators` sayfası, menü bağlantısı, katkı kartı metni, kapsam ekranından bağlantı. Core: `operation-members.ts` (zod sözleşmeleri) ve testi |
| bu rapor | README, Playwright harness'i (`harness/d7-ui.cjs`), kanıtlar (`pgtap-*`, `ui/`) |

## Ne yapıldı

### 1. İçerik operatörü katkıyı kabul eder (yalnız taslak)

D3 bulgusu: kabul yolu içeride `admin_import_library_bundle`'ı çağırıyordu. Bu fonksiyon C07'de yönetici yazması bırakılmıştı. Bu yüzden içerik operatörü kabulde `forbidden` alıyordu.

Koordinatör kararı uygulandı. `admin_import_library_bundle`'ın genel yetkisi **genişletilmedi**.

- **Yeni iç yol `gina.import_contribution_bundle(uuid, jsonb)`:**
  - `security definer`; `public`, `anon`, `authenticated` ve `service_role`'a kapalı. Yalnız `admin_decide_contribution_set` içinden çağrılır.
  - Gövde `admin_import_library_bundle`'ın `pg_get_functiondef` çıktısıdır. Doğrulama, boyut, PNG, rubrik ve makbuz kuralları birebir aynıdır.
  - Değişen iki yer var: ad ve kapı. Kapı içerik rolünü ister (yönetici her rolü taşır). Ayrıca paket anahtarı bekleyen bir katkı kopyasının `contribution-<id>` anahtarı olmalı ve kaynak `family_contribution` olmalı. Değilse `contribution_import_only` döner.
  - Beklenen parça tam bir kez bulunmazsa migration durur.
- **`admin_decide_contribution_set` (6 parametre):** yalnız içe aktarma çağrısı iç yola çevrildi. C07 kapısı (`assert_operation_role(array['content'])`) ve gövdenin geri kalanı aynen duruyor.
- **Denetim:** onay/ret kaydına `details.decided_as` (`admin` | `content`), `package_id` ve `package_status='draft'` eklendi.
- **Yayın kararı değişmedi:** `admin_set_library_publication` yine yalnız yayın rolüne ve yöneticiye açık. Kabul yalnız `gina.library_import_packages` (durumu her zaman `draft`) yazar. `library_publications` veya `library_items` satırı oluşmaz.
- **Ekran:** `/library?tab=review` kodu değişmedi; içerik rolü artık kabul edebiliyor. Karar kartında ve başarı mesajında "Kabul yalnız ayrı bir kütüphane taslağı oluşturur; yayın kararı yayın ekibindedir." yazıyor.

### 2. Operatör rol yönetimi (`/operators`)

Sunucu (yalnız tam yönetici, `gina.assert_admin()` ile canlı `admins` satırı):

- **`admin_operation_members()`:** rolü olan kişiler ve her rolün durumu (`active`, `expired`, `revoked`), bitiş, veren, yayın rolünde kapsam sayısı. Ayrıca açık oturum sayısı (`auth.sessions`) ve son 10 `operations.member` denetim kaydı (zaman, yönetici, rol, ver/kaldır, bitiş, gerekçe). Tam yöneticiler listelenmez.
- **`admin_find_operator_account(p_email)`:** büyük/küçük harf duyarsız tam e-posta eşleşmesi. Arama yapmaz. Yanıt `found` ve `eligible`; uygun değilse neden: anonim hesap veya tablet (`operator_account_required`), ya da tam yönetici (`operator_is_admin`).
- **`admin_set_operation_member(p_request_id, p_user_id, p_role, p_expires_at, p_revoke, p_reason)`:**
  - Yazma mevcut `public.set_operation_member` ile yapılır. Onun kuralları (en çok 1 yıl, gelecek tarih, operatör hesabı) ve `operations.member` denetimi değişmedi.
  - Sonuç `granted`, `updated`, `revoked` veya `unchanged` olur.
  - Aynı istek kimliği aynı sonucu döndürür (`replayed`). Aynı istek farklı içerikle gelirse `request_conflict`.
  - Durumu değiştirmeyen istek `unchanged` döner ve denetim yazmaz.
  - Reddedilenler: tam yöneticiye rol verme (`operator_is_admin`), kendi rolünü değiştirme (`operator_self_change`), kaldırırken tarih verme veya kısa gerekçe (`invalid_input`).
  - Kaldırmada sonuç `open_sessions` ve `effect='refused_on_next_request'` taşır. Yayın rolü kaldırılınca kapsam satırları silinmez; `scope_count` bildirilir.

Ekran (`pages/operators.tsx`, menüde "Operatör rolleri", yalnız yöneticiye görünür):

- **Rol ver:** tam e-posta → "Hesabı bul" → rol, süre (7/30/90/180 gün, 1 yıl), gerekçe → "Rolü ver". Yoksa veya uygun değilse açık mesaj çıkar.
- **Kişi kartı:**
  - rol satırları (durum, bitiş, veren, kapsam);
  - "Süreyi güncelle" veya "Yeniden ver";
  - "Rolü kaldır": uygulama içi onay ister. Onay açık oturum sayısını ve etkisini söyler: bir sonraki istek reddedilir, ekran en geç 30 sn'de "Yetkiniz kaldırıldı" der, yazılmamış taslaklar kaydedilmez;
  - açılır denetim izi.
- **Yeniden gönderim:** ağ hatasında aynı değişiklik aynı istek kimliği ve aynı bitiş anıyla gönderilir. Çift tıklama tek kayıt yazar.
- `/operator-scopes` açıklaması artık rol işi için `/operators`'a bağlantı verir.
- Core: `packages/core/src/operation-members.ts` (yanıt şemaları, komut şeması, `operationRoleExpiry`, `activeOperationRoles`).

## Testler (gerçekten çalıştırıldı)

Ortam: boş `gina_completion_audit` şablonundan geçici klon DB'ler (`gina_d7base_audit`, `gina_d7dev_audit`, koşucunun `gina_q02sql_*`, harness'in `gina_d7_<hex>_audit`). UI için geçici GoTrue + PostgREST konteynerleri kullanıldı. Mock yok.

| Test | Sonuç |
|---|---|
| pgTAP 125 (dev DB, D7 migration uygulanmış) | **105 ok, 0 not ok** |
| pgTAP 125, D7 migration'sız taban DB | beklendiği gibi başarısız (`gina.import_contribution_bundle` yok) |
| pgTAP 113 / 123 / 040 / 043 (aynı dev DB) | 191 / 116 / 67 / 36 ok, **0 not ok** |
| Tam pgTAP `Europe/Istanbul` (`scripts/test-q02-sql.py --run-local --out docs/release/d7-2026-11-06/pgtap-istanbul`) | **122 dosya / 5532 kontrol, 0 başarısız** (113: 191, 123: 116, 125: 105) |
| Tam pgTAP `UTC` (`--timezone UTC --out …/pgtap-utc`) | **122 dosya / 5532 kontrol, 0 başarısız** |
| `pnpm --filter @gina/backoffice typecheck` | çıkış 0 |
| `pnpm --filter @gina/backoffice lint` | çıkış 0 |
| `pnpm --filter @gina/backoffice build` | çıkış 0; `/operators` ve `/operator-scopes` statik çıktıda |
| `pnpm --filter @gina/core test` / `tsc --noEmit` | **60 dosya / 422 test geçti** (yeni `operation-members.test.ts` 4 test) / çıkış 0 |
| İzole servis + Playwright (`harness/d7-ui.cjs`, Chrome headless, tr-TR) | **5/5** ([ui/ui-checks.json](ui/ui-checks.json), 14 ekran `ui/screenshots/`) |

### pgTAP 125 kapsamı

- **Yüzey:**
  - anon EXECUTE yüzeyi değişmedi;
  - iç yol hiçbir istemci rolüne açık değil ve `security definer`;
  - `admin_import_library_bundle` hâlâ `assert_admin()`;
  - karar fonksiyonu yalnız iç yolu çağırıyor ve C07 içerik kapısını koruyor;
  - yayın fonksiyonu C07 yayın kapısını koruyor;
  - yeni RPC'ler worker'a kapalı; komut tablosu RLS'li ve özel.
- **Kabul:**
  - veli, finans, destek, yayın, sahte admin claim'i ve süresi dolmuş içerik rolü `forbidden` alır; durum ve paket değişmez;
  - içerik operatörü iç yolu doğrudan çağıramaz (42501) ve genel içe aktarmayı yapamaz (`forbidden`);
  - ortak kaynaklı grupta kısmi kabul `contribution_review_required` döner ve paket yazmaz;
  - içerik operatörü bütün grubu kabul eder: `approved`, 2 soru kredisi, taslak paketi `created_by` = içerik operatörü;
  - pakette 2 soru tek `context` kaynağına bağlı, 2 öğretmen alanı var;
  - yayın satırı yok; yeni `library_items` ve `library_publications` satırı 0;
  - denetimde `decided_as=content`, `package_status=draft`; tek içe aktarma denetimi;
  - ödül politikası (2 soru → 5 hak ve Plus): tek kütüphane hakkı, tek plan ödülü.
- **İdempotent:**
  - aynı istek birebir aynı sonucu döner;
  - farklı içerik `request_conflict`, yeni istek `contribution_changed` döner; yönetici de ikinci kez kabul edemez;
  - sonrasında sayılar `1:2:2:1:1`: 1 paket, 2 kredi, 2 hak (kütüphane + plan), 1 plan ödülü, 1 onay denetimi.
- **İç yolun kendi kapısı:** katkı dışı anahtar, karara bağlanmış kopya ve `family_contribution` dışı kaynak `contribution_import_only` döner. Destek rolü `forbidden` alır.
- **Yayın:** içerik operatörü taslağı yayımlayamaz (`forbidden`) ama yayın önizlemesini okur. Yayın operatörü taslağı görür; taslak yayımlanmamış kalır.
- **Değişmeyenler:** yönetici kabulü (`decided_as=admin`) ve içerik operatörünün soru notlu reddi.
- **Rol yönetimi:**
  - içerik, yayın, destek, veli ve sahte admin claim'i reddedilir; reddedilen çağrılar rol yazmaz;
  - liste: yönetici yok; süresi dolmuş rol `expired`; açık oturum sayısı ve kapsam sayısı var;
  - hesap bulma: bilinmeyen e-posta, büyük/küçük harf duyarsız tam eşleşme, uygunluk, yönetici `operator_is_admin`, kısa giriş reddi;
  - ver → tekrar (`replayed`) → çakışma → `unchanged`; tek denetim, kırpılmış gerekçe, yönetici kaydı;
  - süre güncelleme (`updated`);
  - reddedilenler: 1 yıldan uzun, geçmiş tarih, süresiz verme, kısa gerekçe, bilinmeyen rol, kaldırırken tarih, yöneticiye rol, kendi rolünü değiştirme, anonim hesap;
  - **açık oturumda iptal:** aynı JWT iptalden önce çalışır; iptal sonucu `revoked:refused_on_next_request:1` döner; hemen ardından aynı JWT ile liste ve karar `forbidden` alır, `my_operation_roles()` boş döner;
  - tekrar kaldırma ve süresi dolmuş rolü kaldırma `unchanged`;
  - süresi dolmuş ve kaldırılmış rol yeniden verilebilir; canlı rol hemen görünür;
  - denetim yalnız gerçek değişikliklerde; geçmiş en yeni önce, gerekçe ve yönetici adıyla;
  - yayın rolü kaldırılınca kapsam sayısı bildirilir ve aynı JWT `forbidden` alır.

### Playwright (`ui/ui-checks.json`, 1280×800 ve 768×1024)

1. `operators_screen_admin_only`: içerik operatörünün menüsünde "Operatör rolleri" yok ve sayfa açılmıyor. Aynı token ile liste ve kendine rol verme RPC'leri 403 döner.
2. `content_operator_accepts_group_creates_draft_only`:
   - içerik operatörü 2 soruluk "Pasta" grubunda öğretmen alanlarını doldurup kabul etti;
   - DB: `approved|draft|true|2|1|0` (kopya onaylı, paket taslak, oluşturan içerik operatörü, 2 soru, 1 ortak kaynak, 0 yayın);
   - denetim `1:content`;
   - aynı token ile `admin_set_library_publication` ve `admin_import_library_bundle` 403 döner.
3. `admin_grants_and_updates_role`:
   - bilinmeyen e-posta mesajı ve yönetici hesabı için uygun değil mesajı çıktı;
   - büyük harfle yazılan e-posta bulundu;
   - "Rolü ver" çift tıklandı → 1 rol satırı (≈30 gün), 1 denetim;
   - aday giriş yapınca içerik bölümünü açtı;
   - süre 180 güne güncellendi → 2 denetim; denetim izinde gerekçe görünüyor.
4. `open_tab_revocation_takes_effect`:
   - içerik operatörünün inceleme sekmesi açık, kartta "1 açık oturum" yazıyor;
   - onayda "açık oturum var" uyarısı çıktı; Vazgeç rolü korudu;
   - onay → rol kaldırıldı, 1 denetim, mesajda açık oturum etkisi;
   - aynı token ile RPC 403;
   - sekme odağa dönünce tek "Yetkiniz kaldırıldı." bildirimi çıktı; inceleme içeriği gizlendi ve menüden kalktı;
   - tarayıcı diyaloğu 0.
5. `no_page_errors_no_overflow_no_raw_keys`: sayfa hatası yok. Her ekranda yatay taşma, ham i18n anahtarı ve ham sunucu hatası yok.

Harness ilk koşuda `role_grant` adımında test hatası verdi, ürün hatası değildi. `<select>` etiket adı seçili seçeneği de içerdiği için `getByLabel('Rol', exact)` eşleşmedi; seçici `#grant-role` yapıldı. İkinci koşu 5/5 geçti. Sonra kaldırmadan sonra gerekçe alanını temizleyen küçük bir ekran düzeltmesi yapıldı. Üçüncü koşu da 5/5 geçti (kanıtlar bu koşudandır). Her koşu kendi DB'sini ve 2 konteynerini sildi (`cleanup`: `containers_left: none`, `database_left: 0`). Dev DB'ler (`gina_d7base_audit`, `gina_d7dev_audit`) silindi; `gina_d7%` DB sayısı 0.

## Kalan sınır

- **Yayımlanmadı.** Sıra: önce migration `20261106390000`, sonra backoffice.
  - Migration yoksa `/operators` "Roller okunamadı" der.
  - İçerik operatörünün kabulü eskisi gibi `forbidden` alır; ekran "İşlem yetkiniz doğrulanamadı" der.
- **İç yol bir kopyadır.** `gina.import_contribution_bundle`, migration anındaki `admin_import_library_bundle` gövdesinden üretildi. İleride genel içe aktarma kuralları değişirse iç yol kendiliğinden değişmez. Aynı migration'da iç yol da yeniden üretilmelidir. pgTAP 125 yalnız kapıları ve çağrı yolunu doğrular, iki gövdenin eşitliğini doğrulamaz.
- **İptal sunucuda anında, ekranda en geç 30 sn'dedir** (veya odak/görünürlük değişince). Bu arada yazılan ama gönderilmemiş taslaklar kaydedilmez. Oturum kapatılmaz; oturumu sonlandırma (`auth.sessions` silme) bu işin kapsamında değil.
- **Hesap önceden var olmalı.** Rol yalnız var olan, anonim olmayan, tablete bağlı olmayan hesaba verilir. Davet veya hesap açma akışı yok. Hesap bulma tam e-posta eşleşmesidir ve yalnız yöneticiye açıktır.
- **Tam yönetici yönetimi (`admins`) bu ekranda yok.** Yönetici kendi operatör rolünü değiştiremez.
- **`unchanged` yalnız birebir aynı bitiş anı için döner.** Aynı süre seçimi sonraki bir anda gönderilirse yeni bitiş olarak `updated` olur ve denetim yazar.
- **Yayın rolü kaldırılınca kapsam satırları kalır.** Rol yeniden verilirse eski kapsam geçerli olur. Ekran bunu söyler.
- `packages/core/src/database.types.ts` yeniden üretilmedi. Yeni RPC'ler `adminRpc` ile çağrılıyor; yanıtlar core zod şemalarıyla doğrulanıyor.
- Playwright yalnız headless Chrome'da koştu. Ekran okuyucu ve gerçek macOS davranışı C15'e kalır. Mobil kapsam dışıydı ve dokunulmadı.
