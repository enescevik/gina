# D11 — Yönetim (backoffice) P2 ekran inceleme kapanışları

6 Kasım 2026. Dal `worktree-agent-afd25cae753f035a7`, taban `b824f7d`. **Durum: KOD HAZIR + izole TEST EDİLDİ. Yayımlanmadı.** Main'e push edilmedi. Migration yok (gerekmedi). Üretim ve demo DB'sine dokunulmadı.

Kaynak liste: [`SCREEN-REVIEW-MATRIX.md`](../experience-review/SCREEN-REVIEW-MATRIX.md) §5 "Açık takip" ve [A3 matrisi](../experience-review/SCREEN-REVIEW-MATRIX-A3.md).

## Ön bulgu: üç madde D3'te zaten kapanmıştı

Matris §5'te açık görünen **Q00-C12-T2**, **Q00-A3-4** ve **Q00-A3-7 (yönetici kısmı)** D3'te (`053bd5f`, main'e `8f14f30` ile birleşti) kodlanmış ve D3 Playwright'ıyla test edilmişti. Yalnız matris güncellenmemişti. D11 bunları yeniden yazmadı. Aynı davranışı bu dalda yeniden doğruladı ve matrisi kapattı:

- **Q00-C12-T2:** `/ai` (AI'ı kapat, model pasifleştir) ve `/questions` (global soru sil) `components/confirm-dialog.tsx` (`useConfirm`) kullanır. Kodda `window.confirm`/`alert`/`prompt` yok.
  - Diyalog yerel `<dialog>` + `showModal()` ile açılır. Arka plan inert olur ve odak diyalogda kalır.
  - `aria-labelledby` başlığa bağlıdır. İlk odak "Vazgeç"tedir.
  - Esc ve Vazgeç her zaman "hayır" sayılır.
  - Görsel dil onaylı (`#fffdf9`, `rounded-3xl`, `btn`/`btn-danger`).
- **Q00-A3-4:** masaüstü kenar menüde her zaman görünür bir "↓ Aşağıda N bölüm daha" düğmesi var. Düğme menüyü kaydırır ve kaydırma çubuğunun görünmesine bağlı değildir.
- **Q00-A3-7 (yönetici):** `my_admin_access()` canlı kontrolü yapılır. Yetki kalkınca tek bir "Yönetici yetkiniz kaldırıldı." bildirimi çıkar, yönetici bölümleri menüden kalkar ve sunucu aynı token'ı reddeder.

## D11'de yapılan kod değişiklikleri

| Bulgu (A3) | İş | Değişiklik | Dosya |
|---|---|---|---|
| `/overrides` denetim kaydında "Yapan" ham UUID | B01 | Sütun "Siz", "Başka yönetici" veya "Sistem (otomatik)" gösterir. Kimlik yalnız "Hesap kimliği" açılınca görünür. Not: diğer yöneticilerin e-postası bu ekranda gösterilmez. | `pages/overrides.tsx` |
| `/overrides` geçmişi 30 kayıtla sınırlı, sayfalama yok | B01 | `audit_log.id` (identity) ile keyset: `id < son`, 30'arlı, bir fazla satırla "daha var" tespiti. "Son N kayıt gösteriliyor", "Daha eski kayıtları göster", "Daha eski kayıt yok." eklendi. Yeni hak verilince ilk sayfa yenilenir ve eski sayfalar düşer (karışık liste olmaz). Sayfa hatasında ayrı uyarı çıkar. | `pages/overrides.tsx` |
| Kütüphane koleksiyonunda paket etiketi ham kod (`free/plus/pro`) | B02 | "Başlangıç / Plus / Pro" (mevcut `t.plans`). | `pages/library.tsx` |
| Kütüphane sorusu tek tıkla "İnceledim, yayımla" / "Yayından kaldır" | B02 | Yayımlama da kaldırma da uygulama içi onaydan geçer (`useConfirm`). | `pages/library.tsx` |

Kütüphane onayının ayrıntısı:
- Yayımlarken koleksiyon yayındaysa hangi paketlerdeki ailelerin soruyu hemen göreceği yazar. Koleksiyon yayında değilse ailelerin soruyu ne zaman göreceği yazar.
- Kaldırmada sorunun arşive alındığı ve ailelerin kendi bankasına aldığı kopyaların değişmediği yazar (`redeem_library_item` kopya oluşturur; doğrulandı).
- Soru kartında durum gösterilir (Taslak / Yayında / Arşivde).

i18n'e yalnız **yeni** anahtar eklendi; var olan anahtar değişmedi ve silinmedi:
- `overrides.actorSelf|actorSystem|actorOther|actorIdLabel|actorEmailNote|auditShown|auditMore|auditEnd|auditPageError`
- yeni `library.*` bölümü

## Daha önce kapanmış A3 P2'ler (matriste işaretlendi, kod yok)

| A3 bulgusu | Kapatan | Kanıt |
|---|---|---|
| Aile araması e-postada tam eşleşme | B01 | `admin_families_search`: e-postada `ilike` (≥3 karakter), eşleşme çipleri |
| `/billing` geçmiş sayfalama (son 50) | B01 | `entitlement-timeline.tsx` keyset "daha fazla" |
| AI model yeteneği/etki özeti | S06 | `admin_model_disable_preview`, politika matrisi, sağlayıcı değişim etkisi |
| `/operations` sunucu filtre/sayfalama | S06 | `admin_ai_failed_operations` (durum, eylem, tarih, sayfa) |
| `/operations` tablette 40 px altı giriş | C12 | Q00-C12-11 ölçümü temiz |
| Politika örnek hesap | P05 | `library_policy_preview` |
| Ders eşanlamlıları | C11 | eşanlamlı yönetimi |

## Karar gereken

Bunlar kod olarak yazılabilir ama yeni RPC/migration veya ürün tercihi ister. Tahminle yapılmadı:

| No | Konu | Öneri |
|---|---|---|
| D11-K1 | `/families` sıralama ve durum süzgeci (paket, bitişi yaklaşan, mağaza durumu) | `admin_families_search`'e `p_plan`, `p_expiring_within_days`, `p_sort` eklensin. Keyset `(sıralama anahtarı, id)` ile korunur. Migration gerekir. Destek sırası için en değerlisi "bitişi 14 gün içinde"dir. |
| D11-K2 | `/overrides` "Başka yönetici" yerine ad/e-posta | Yöneticiler arasında e-posta gösterimi gizlilik açısından makul. Yalnız tam yöneticiye açık `admin_audit_actors(p_ids uuid[])` RPC'si (e-posta + "bu sen misin") önerilir. Operatörlere açılmamalı. Migration gerekir. |
| D11-K3 | Senaryo adayı (`/library?tab=curriculum`) sunucu araması | Şu an 648 aday istemcide 15'lik sayfalanıyor ve sınıf/ders/durum süzgeci var. Bu ölçekte sorun yok. Aday sayısı ~2.000'i geçerse sunucu araması + keyset yapılmalı. Şimdilik ertelenmesi öneriliyor. |
| D11-K4 | `/input-catalog` katalog kapsam denetimi (S04) | "Hangi sınıf/ders için seçenek eksik" raporu, kapsam tanımı (resmî program × sınıf) için ürün kararı ister. S04 kanonik ders kimlikleri hazır olduğu için `subject_synonyms` kapsamıyla `guided_input_options` karşılaştıran salt okunur bir rapor önerilir. |
| D11-K5 | Kenar menü bölüm gruplama (A3-4'ün ikinci yarısı) | 17+ bölüm için "Aileler ve haklar", "İçerik", "Operasyon", "Ekip" başlıklı, açılıp kapanan gruplar önerilir. Gezinme dili değiştiği için onaylı tasarım kararı gerekir. "Aşağıda N bölüm daha" ipucu bu arada sorunu karşılıyor. |

## Testler (gerçekten çalıştırıldı)

| Test | Sonuç |
|---|---|
| `pnpm --filter @gina/backoffice typecheck` (`next typegen && tsc --noEmit`) | `✓ Types generated successfully`, tsc hatasız |
| `pnpm --filter @gina/backoffice lint` | çıkış 0 |
| `pnpm --filter @gina/backoffice build` (yer tutucu URL ile statik export) | çıkış 0 |
| Backoffice birim testi | Pakette test betiği/dosyası yok; doğrulama typecheck + lint + build + Playwright |
| `packages/core` vitest | **63 dosya / 440 test geçti** |
| `packages/core` `tsc --noEmit` | çıkış 0 |
| İzole servis sözleşmesi (`GINA_QA_UI_FIXTURE=<scratchpad>/fixture-d11-c4c23f92.json GINA_QA_UI_SERVICE=1 python3 scripts/test-isolated-services.py --run-local --ui-hold`) | **182/182 kontrol**; temizlik: auth, rest, DB silindi ([ui/service-checks.json](ui/service-checks.json)) |
| Playwright (`harness/d11-ui.cjs`, Chrome headless, tr-TR, 1280×800 + 768×1024) | **7/7** ([ui/ui-checks.json](ui/ui-checks.json), 15 ekran `ui/screenshots/`) |

Playwright kontrolleri:
1. `c12_t2_ai_in_app_confirm`, iki ölçüde:
   - diyalog `:modal`, başlığa bağlı, ilk odak "Vazgeç";
   - 6 Tab'da odak diyalogdan çıkmadı;
   - Esc ve Vazgeç → `ai.enabled` değişmedi;
   - onay → kapandı; "AI'ı aç" → açıldı.
2. `c12_t2_questions_in_app_confirm`: global soru silme diyaloğu iki ölçüde. Esc soruyu korudu, onay sildi.
3. `b01_override_audit_actor_and_paging`:
   - ilk sayfa 30 satır; "Yapan" sütununda UUID yok;
   - üç etiket görünüyor ("Siz", "Başka yönetici", "Sistem (otomatik)");
   - 6 "daha eski" tıklamasıyla 181 kaydın tamamı geldi;
   - bu koşunun 45 tohum satırı tekrarsız ve eksiksiz;
   - kimlik yalnız açılınca görünür.
4. `b02_library_plan_labels_and_publish_confirm`:
   - koleksiyon düzenleyicide "Başlangıç / Plus / Pro" yazıyor, ham kod yok;
   - yayım onayı koleksiyon adını ve "Plus, Pro" paketlerini söylüyor;
   - Vazgeç taslağı korudu, onay → `published`;
   - kaldırma onayında Esc yayında bıraktı, onay → `archived`.
5. `a3_4_sidebar_hidden_sections_hint`: 1280×800'de "↓ Aşağıda 12 bölüm daha" düğmesi menüyü kaydırdı (`scrollTop` 371).
6. `a3_7_admin_revocation_single_notice`: açık oturumda `admins` satırı silindi. Tek bildirim çıktı, "Aileler" ve "Erişim hakları" menüden kalktı, aynı token ile `admin_list_overrides` reddedildi.
7. `no_native_dialogs_no_page_errors`: tarayıcı diyaloğu 0, `pageerror` 0. Ölçülen sayfalarda yatay taşma yok.

Not: Playwright aynı tek kullanımlık fixture üzerinde 4 kez koştu. İlk koşu 7/7 geçti. Sonraki 3 koşu harness düzeltmesiydi: ekran adlarının ölçüye göre sıralanması, koşu başına benzersiz tohum ve çok sayfalı geçmiş. Toplam 181 denetim satırı bu tekrarlardan gelir. Kaydedilen kanıt son koşudur.

### Yeniden çalıştırma

```sh
pnpm install --frozen-lockfile
cd apps/backoffice && NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:59611 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-d11bo pnpm build && cd ../..
GINA_QA_UI_FIXTURE=<scratchpad>/fixture-d11-<hex>.json GINA_QA_UI_SERVICE=1 python3 scripts/test-isolated-services.py --run-local --ui-hold &   # fixture yazılınca devam
node docs/release/c04-2026-11-06/ui/serve-export.cjs apps/backoffice/out 8611 &
GINA_QA_UI_FIXTURE=<aynı dosya> GINA_BO_WEB=http://127.0.0.1:8611 GINA_BO_BACKEND=http://127.0.0.1:59611 GINA_BO_ANON=placeholder-anon-d11bo \
  GINA_QA_PLAYWRIGHT_PATH=<playwright modülü> GINA_D11_OUT=docs/release/d11-2026-11-06/ui node docs/release/d11-2026-11-06/harness/d11-ui.cjs
kill -USR2 <fixture pid>   # fixture serbest; koşucu konteynerleri ve DB'yi siler
```

## Sınırlar

- Ekranlarda yalnız sentetik `@example.invalid` hesaplar var. Şifre, JWT ve servis anahtarı dosyaya yazılmadı. Fixture dosyası koşucu tarafından silindi.
- Gerçek tarayıcıda (macOS kaydırma çubuğu, VoiceOver) kabul C15'e kalır. Headless Chrome kontrolü cihaz kabulü değildir.
- "Başka yönetici" ayrımı istemci tarafındadır (oturumdaki kullanıcı kimliğiyle karşılaştırma). Ad göstermek D11-K2 kararına bağlıdır.
