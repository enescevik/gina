# D12 — D11-K1 ve D11-K2 kararlarının uygulanması (2026-11-06)

Koordinatör, [D11 README §Karar gereken](../d11-2026-11-06/README.md) bölümündeki K1 ve K2 önerilerinin ikisini de onayladı. Bu teslim ikisini uygular. Üretime erişim yok. Migration yalnız yerel/tek kullanımlık veritabanlarında uygulandı.

## Durum

| Kalem | Durum |
|---|---|
| K1 `/families` "Bitişi 14 gün içinde" süzgeci + sıralama (en yeni / bitişi en yakın), sunucu tarafı süzgeç ve keyset | Dalda birleşik (commit), main'e itilmedi |
| K2 `/overrides` "Yapan": diğer ekip hesabı e-postası (`admin_audit_actors`) | Dalda birleşik (commit), main'e itilmedi |
| Migration `20261106410000_families_filter_and_audit_actors.sql` | Yerelde uygulandı; **üretimde yok** |
| DB tipleri (`packages/core/src/database.types.ts`) | 20261106410000 dahil yeniden üretildi |

## Ne değişti

### Veritabanı (`supabase/migrations/20261106410000_families_filter_and_audit_actors.sql`)

1. **`admin_families_search(p_query, p_cursor, p_limit, p_expiring_within_days default null, p_sort default 'newest')`**
   - Eski üç parametreli imza kaldırıldı, yerine varsayılanlı beş parametreli imza geldi. İki imza birlikte bırakılmadı, çünkü varsayılanlı aşırı yükleme `admin_families_search(null,null,10)` gibi çağrıları belirsiz yapar.
   - build-29 dönemi backoffice'in `{p_query,p_cursor,p_limit}` çağrısı ve 1–3 argümanlı pozisyonel çağrılar aynı sonucu verir. Bu çağrılarda `newest` sıralaması ve `<created_at>|<id>` cursor biçimi aynen kalır.
   - `p_expiring_within_days` 1–90 arasıdır. Efektif hakkı (`gina.effective_entitlement`) şimdiden sonra ve en geç N gün içinde biten aileleri döndürür. Başlangıç paketinin bitişi yoktur, bu yüzden süzgeçte görünmez. İptal edilmiş veya henüz başlamamış geçici hak efektif değildir.
   - `p_sort='expiring'`: keyset `(coalesce(expires_at,'infinity'), id)` artan sıradadır. Cursor `expiring|<ts|infinity>|<id>` biçimindedir. Bir sıralamanın cursor'ı ötekinde `cursor_invalid` hatası verir.
   - Yanıta `sort` ve `expiring_within_days` eklendi. Satır alanları değişmedi: e-posta ve çocuk adı yine dönmez.
   - Rol kapısı C07 matrisindekiyle aynıdır: `gina.caller_operation_roles() && array['admin','support','finance']`. Kapı canlıdır ve `assert_admin`'e geri çekilmedi.
   - Yetkiler: `revoke all from public, anon`, `grant execute to authenticated, service_role`.
2. **`admin_audit_actors(p_ids uuid[]) returns table(id uuid, label text)`**
   - Kapı `gina.assert_admin()` ile kurulur: JWT `gina.admin` claim'i ve canlı `admins` satırı. Bu, tam yönetici RPC'lerinin (`admin_list_overrides`, `admin_operation_members`) kullandığı kapıdır. Operatör rolleri (destek, içerik, finans, yayın) reddedilir.
   - Yalnız ekip hesaplarını çözer: `admins` veya `operations_members` kaydı olanlar. İptal edilmiş ya da süresi dolmuş operatör, geçmişte adı görünsün diye bu kapsamdadır. Veli, cihaz ve bilinmeyen kimlik için `label=null` döner. Böylece RPC kimlikten e-posta bulmak için kullanılamaz.
   - Dönen alanlar yalnız `id` ve `label` (e-posta). En fazla 200 kimlik kabul edilir; tekrarlar ve null'lar ayıklanır.
   - Yetkiler `admin_families_search` ile aynıdır.
3. C07'nin 24 rol kapılı RPC'sinden hiçbiri `create or replace` ile `assert_admin`'e çevrilmedi. Yeni fonksiyonlar anon tarafından çalıştırılamaz (pgTAP 102 hâlâ geçiyor).

### Core (`packages/core/src/admin-workqueue.ts`)

- `FAMILY_SORTS`, `familySortSchema`, `FAMILY_EXPIRING_DAYS = 14` eklendi.
- `familySearchArgs()`: D12 parametrelerini yalnız kullanıldıklarında gönderir. Böylece eski veritabanına giden varsayılan çağrı değişmez.
- `familiesSearchSchema` yeni alanları isteğe bağlı olarak kabul eder: `sort` ve `expiring_within_days`.
- `auditActorsSchema` (strict, yalnız id ve label), `unresolvedActorIds()` (tekrarsız, kendi kimliği hariç, en fazla 200) ve `actorLabel()` eklendi.

### Backoffice

- **`/families`**: arama kutusunun altında "Bitişi 14 gün içinde" onay kutusu ve "Sıralama" seçimi var ("En yeni aile önce" / "Bitişi en yakın önce").
  - Değişiklik ilk sayfayı sunucudan yeniden ister.
  - "Daha fazla aile yükle" düğmesi aynı süzgeç ve sıralamayla gelen cursor'ı kullanır.
  - Süzgeç açıkken satırda "N gün kaldı" rozeti görünür. Rozet sunucunun `as_of` zamanına göre hesaplanır.
  - Boş sonuç ve "tamamı gösteriliyor" metinleri süzgece göre yazılır.
- **`/overrides`**: D11'in `actorName` yolu korundu ve genişletildi.
  - Denetim satırlarındaki çözülmemiş kimlikler tek bir `admin_audit_actors` çağrısıyla sorulur. Kendi kimliği gönderilmez, sorulmuş kimlik yeniden sorulmaz.
  - Çözülen hesap e-postayla görünür. Çözülemeyen hesap (veli kimliği, eski veritabanı, hata) "Başka yönetici" olarak kalır.
  - Yetki reddi geldiğinde mevcut "yetki kaldırıldı" akışı çalışır.
  - Durum satırının notu çözümün sonucuna göre değişir: başarılıysa yeni not, hata varsa eski "e-posta gösterilmez" notu.
- Metinlerde yalnız yeni i18n anahtarları eklendi:
  - `b01.families`: `viewLabel`, `expiringFilter`, `sortLabel`, `sortNewest`, `sortExpiring`, `expiringEmpty`, `expiringShownAll`, `daysLeft`;
  - `t.overrides`: `actorNamedNote`.
- Tasarım (Card, input, btn sınıfları, sütun düzeni) değişmedi.

## Testler (gerçekten çalıştırıldı)

| Test | Sonuç |
|---|---|
| `python3 scripts/test-q02-sql.py --run-local --only 127` | **71 assertion, 0 hata** |
| `python3 scripts/test-q02-sql.py --run-local` (tümü, Europe/Istanbul) | **126 dosya / 5755 assertion, 0 hata** |
| `python3 scripts/test-q02-sql.py --run-local --timezone UTC` | **126 dosya / 5755 assertion, 0 hata** |
| `bash scripts/gen-db-types-isolated.sh --run-local` | 4251 satır yazıldı, geçici DB silindi. Fark: `admin_audit_actors` eklendi, `admin_families_search`'e iki isteğe bağlı argüman geldi |
| `packages/core` vitest | **63 dosya / 449 test geçti** (D11'de 440; +9 D12) |
| `packages/core` `tsc --noEmit` | çıkış 0 |
| `pnpm --filter @gina/backoffice typecheck` | `✓ Types generated successfully`, tsc hatasız |
| `pnpm --filter @gina/backoffice lint` | çıkış 0, uyarı yok |
| `pnpm --filter @gina/backoffice build` (yer tutucu URL ile statik export) | çıkış 0 |
| Playwright (`harness/d12-ui.cjs`, Chrome headless, tr-TR, 1280×800 + 768×1024, izole servis fixture'ı) | **4/4** ([ui/ui-checks.json](ui/ui-checks.json), 4 ekran `ui/screenshots/`) |

pgTAP 127 kapsamı:

- **Şema**: tek imza var, C07 rol kapısı metni korunuyor, `assert_admin` yok. `admin_audit_actors` `assert_admin` ile kapılı. anon EXECUTE yok, PUBLIC EXECUTE yok. authenticated ve service_role yetkili.
- **Eski çağrı**: pozisyonel 3 ve 1 argümanlı, adlandırılmış çağrı ile açık `newest` aynı sonucu veriyor. Eski cursor biçimi korunuyor.
- **Süzgeç**: 29 ailelik beklenen küme doğrudan tablolardan hesaplandı ve RPC ile birebir tuttu.
  - Kapsam dışı kalanlar: +20 gün, ücretsiz, iptal edilmiş telafi, henüz başlamamış telafi.
  - Kapsamda olanlar: mağaza aboneliği, pro telafi, 14 gün eksi 1 dakika sınırı.
  - 3 günlük pencere alt küme çıkıyor ve metin aramasıyla birleşiyor.
- **Sıralama**: `expires_at` artan, eşitlikte id. Eşit bitişli aileler var. Süzgeçsiz `expiring` sıralamasında bitişsizler en sonda.
- **Sayfalama**: 4'lük sayfalarla 8 sayfa, tekrar yok, tek seferlik listeyle aynı. Süzgeçsiz 2'lik sayfalar `infinity` cursor'ından geçiyor. `newest` ile süzgeç birlikte çalışıyor ve eski `newest` sayfalaması değişmedi. Aşağıdakiler reddediliyor:
  - sıralamalar arası cursor;
  - bozuk cursor;
  - pencere 0 ve 91;
  - bilinmeyen sıralama.
- **Roller, aile arama**: destek ve finans süzgeci kullanabiliyor. İçerik operatörü, iptal edilmiş operatör ve veli reddediliyor.
- **`admin_audit_actors` çözümleme**:
  - Diğer yönetici, kendisi, operatör ve iptal edilmiş operatör çözülüyor.
  - Veli ve bilinmeyen kimlik null dönüyor.
  - Çıktıda yalnız `id` ve `label` sütunları var.
  - Boş liste boş sonuç verir. Null liste ve 201 kimlik reddediliyor, 200 kimlik kabul ediliyor.
- **`admin_audit_actors` roller**:
  - Destek, içerik ve finans operatörü ile veli reddediliyor.
  - `admins` satırı olmadan sahte admin claim'i reddediliyor.
  - Claim'i olmayan `admins` satırı reddediliyor.
  - Açık oturumda silinen yönetici aynı token ile reddediliyor.
  - Silinen yönetici artık çözülmüyor.
  - `anon` rolüyle çağrı `insufficient_privilege` ile düşüyor.

Playwright kontrolleri:

1. `k_server_contract_and_role_gates` (gerçek PostgREST ve GoTrue JWT ile):
   - eski `{p_query,p_cursor,p_limit}` çağrısı `newest` sıralaması ve eski cursor biçimiyle döndü;
   - `admin_audit_actors`: yönetici izinli; destek `403:42501`, veli `403:42501`, anon `401:42501`;
   - destek süzgeçli aramayı yapabildi; anon aile araması `401:42501`;
   - veli kimliği `null` döndü; alanlar yalnız `id` ve `label`.
2. `k1_families_expiring_filter_sort_paging`, iki ölçüde. Tohum: bu koşuya ait 55 yakın, 5 uzak ve 5 ücretsiz aile.
   - Onay kutusu ve sıralama seçimi isteğe `p_expiring_within_days=14` ve `p_sort='expiring'` olarak gitti.
   - İlk sayfa sunucu sırasıyla birebir tuttu (50 satır), her satırda "N gün kaldı" rozeti var.
   - "Daha fazla aile yükle" etiketli cursor'la aynı süzgeç ve sıralamayı korudu ve 56 ailenin tamamını getirdi.
   - Tekrar yok; uzak ve ücretsiz aileler görünmedi.
   - Süzgeç kalkınca rozetler kalktı. Yatay taşma yok.
3. `k2_override_audit_actor_labels`, iki ölçüde:
   - diğer yönetici e-postasıyla görünüyor, veli kimliği "Başka yönetici", kendisi "Siz", `null` "Sistem (otomatik)";
   - görünen etikette UUID yok;
   - ölçü başına tek `admin_audit_actors` çağrısı yapıldı ve kendi kimliği gönderilmedi;
   - yeni not görünüyor; yatay taşma yok.
4. `no_native_dialogs_no_page_errors`: tarayıcı diyaloğu 0, `pageerror` 0.

İzole servis fixture'ı koşu sonunda `SIGUSR2` ile serbest bırakıldı. Koşucu konteynerleri ve tek kullanımlık DB'yi siler.

### Yeniden çalıştırma

```sh
pnpm install --frozen-lockfile
python3 scripts/test-q02-sql.py --run-local --only 127
cd apps/backoffice && NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:59612 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-d12bo pnpm build && cd ../..
GINA_QA_UI_FIXTURE=<scratchpad>/fixture-d12-<hex>.json GINA_QA_UI_SERVICE=1 python3 scripts/test-isolated-services.py --run-local --ui-hold &   # fixture yazılınca devam
node docs/release/c04-2026-11-06/ui/serve-export.cjs apps/backoffice/out 8612 &
GINA_QA_UI_FIXTURE=<aynı dosya> GINA_BO_WEB=http://127.0.0.1:8612 GINA_BO_BACKEND=http://127.0.0.1:59612 GINA_BO_ANON=placeholder-anon-d12bo \
  GINA_QA_PLAYWRIGHT_PATH=<playwright modülü> GINA_D12_OUT=docs/release/d12-2026-11-06/ui node docs/release/d12-2026-11-06/harness/d12-ui.cjs
kill -USR2 <test-isolated-services.mjs pid>   # fixture serbest; koşucu konteynerleri ve DB'yi siler
```

## Sınırlar

- **Üretim**: migration üretimde uygulanmadı. Sıra önemli: migration önce uygulanırsa yeni backoffice'te süzgeç ve sıralama çalışır. Migration'dan önce yayımlanan yeni backoffice'te varsayılan görünüm çalışır (D12 parametreleri gönderilmez). Süzgeç veya `expiring` sıralaması ise eski veritabanında RPC hatası verir. Bu durumda "Yapan" sütunu "Başka yönetici"ye düşer ve eski not görünür.
- **"Bitiş" tanımı**: süzgeç efektif hakkın `expires_at` alanına bakar. Otomatik yenilenen bir mağaza aboneliği de dönem sonu yaklaşınca listede çıkar, çünkü `auto_renewing` süzgece katılmadı. Destek için "yenilenmeyecek olanlar" ayrımı istenirse ürün kararıyla `auto_renewing=false` seçeneği eklenebilir.
- **Performans**: `expiring` sıralaması ve süzgeç, eşleşen bütün aileler için `gina.effective_entitlement`'ı hesaplar ve sonra keyset uygular. Bitiş tarihi türetilmiş olduğu için bir indeks kullanılamıyor. Mevcut ölçekte sorun değil. On binlerce aileye çıkılırsa efektif bitişi tutan bir sütun veya görünüm gerekir.
- **Ad gösterimi**: yöneticiler için ayrı bir görünen ad alanı yok, bu yüzden etiket e-postadır. `auth.users` meta verisindeki ad kullanıcı tarafından değiştirilebildiği için kullanılmadı.
- **Kapsam**: ekip kaydı tamamen silinmiş eski bir yönetici (ne `admins` ne `operations_members` kaydı kalmış) çözülemez ve "Başka yönetici" görünür.
- **Ekran kapsamı**: yalnız `/overrides` denetim tablosu güncellendi. `/operators` ve `/operator-scopes` zaten sunucudan e-posta alıyor ve değiştirilmedi.
- **Tarayıcı**: Chrome headless denetimi cihaz kabulü değildir. Gerçek tarayıcı kabulü C15'e kalır.
- **Gizlilik**: ekranlarda yalnız sentetik `@example.invalid` hesaplar var. Şifre, JWT ve servis anahtarı dosyaya yazılmadı.
