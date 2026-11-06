# Q00 tek takip matrisi — bütün ekranlar (C12)

6 Kasım 2026 · Kaynak: main `6bdb564` + main `cf391d8` birleşimi (C01–C11 dahil) · Dal: `worktree-agent-a2e5216e406538887` · Rapor: [`../c12-2026-11-06/README.md`](../c12-2026-11-06/README.md)

Bu dosya A1/A2/A3 matrislerini ([A1](SCREEN-REVIEW-MATRIX-A1.md), [A2](SCREEN-REVIEW-MATRIX-A2.md), [A3](SCREEN-REVIEW-MATRIX-A3.md)) ve sonradan gelen U/P/B/C raporlarını **tek takip listesinde** birleştirir. Eski matrisler tarihsel kanıt olarak kalır; güncel durum buradadır. Sonradan düzelen bulgu yeniden açılmadı, kanıt bağlantısıyla kapatıldı.

## Nasıl incelendi

- **Envanter kaynak koddan:** `apps/mobile/src/app/**` (62 rota dosyası, düzen dosyaları hariç) ve `apps/backoffice/src/pages/**` (21 sayfa + kütüphane sekmeleri). A1–A3 sonrası eklenen rotalar: `/parent/pair-device` (U02), `/unsubscribe`, `/verify-contact` (C10), backoffice `/support-replies` (C07). Modal, sihirbaz, alt panel ve durumlar ayrı birim olarak §3'te.
- **Gerçek uygulama:** `scripts/test-isolated-services.py --run-local --with-storage --with-realtime --ui-hold` (tek kullanımlık `gina_http_<hex>_audit` DB + GoTrue/PostgREST/Storage/Realtime/Edge, 476/476 servis kontrolü geçti, temizlik: 5/5 kaldırıldı). `expo export -p web` yer tutucu backend'e derlendi; Playwright `context.route` ile istekler fixture'a yönlendirildi. Backoffice `next build` statik çıktısı aynı yöntemle.
- **Betikler:** [`scripts/test-c12-tour.cjs`](../../../scripts/test-c12-tour.cjs) (76 rota/durum × ölçü, DOM denetimi), [`scripts/test-c12-backoffice-tour.cjs`](../../../scripts/test-c12-backoffice-tour.cjs) (23 sayfa/sekme × 2 ölçü), [`scripts/test-c12-holiday-ui.cjs`](../../../scripts/test-c12-holiday-ui.cjs) (tatil gösterimi; RPC yanıtı tarayıcıda taklit), [`scripts/test-c12-summary.cjs`](../../../scripts/test-c12-summary.cjs) (özet).
- **Ölçüler:** telefon 390×844, dar telefon 360×640, telefon yatay 844×390 (defter), tablet 768×1024, tablet yatay/küçük masaüstü 1280×800; yönetim 1280×800 ve 768×1024. **Büyük yazı yaklaşımı:** 390 CSS px ekranda %135 tarayıcı ölçeği (289×625, DPR 1.35) — sistem `fontScale` değildir.
- **Otomatik denetim (her rota × ölçü):** yatay taşma, çözülmemiş i18n anahtarı, isimsiz eylem, 44 px altı hedef, kesilen düğme metni, aynı adla tekrarlanan eylem (ekran okuyucu için), altsız görsel (`alt=""` dekoratif sayılır), `pageerror`. Ayrıca klavye sekme sırası (giriş), `prefers-reduced-motion` ile çalışan CSS animasyonu, defter ölçümleri.
- **Senaryolar:** deneyimli aile (2 çocuk, görev/Prova/AI önerisi/tekrar planı), **0 kayıt** (yeni sentetik veli, çocuksuz aile) ve **1 çocuk** (aynı veliye tek çocuk), çocuk modu (veli telefonu, PIN), oturumsuz/geçersiz bağlantılar, rolsüz yönetim hesabı, rol kontrolü servis hatası. İlk kullanım = yeni veli; tekrar kullanım = fixture ailesi.

**Sınırlar (bütün satırlar).** Web taklidi cihaz kabulü değildir: VoiceOver/TalkBack, sistem büyük yazı, gerçek safe area/çentik, kalem/parmak ayrımı, OS klavyesi, native modal yön kilidi ve push **C15 fiziksel kabulüne** kalır (safe area ve modal yön yalnız kod okumasıyla değerlendirildi). Psikoloji/pedagoji/eğitmen sütunları ürün ilkesi olarak uygulanmış model değerlendirmesidir; **uzman incelemesi veya çocuk kullanıcı araştırması değildir.** Gerçek AI, e-posta/SMS, mağaza ve sosyal giriş sağlayıcısı yoktur.

### Anahtar

Durum: **TE** test edildi (bu turda gerçek uygulamada dolaşıldı + denetim) · **DÜZ** bu turda düzeltildi ve yeniden test edildi · **ÖK** önceki rapordaki gerçek-UI kanıtıyla kapalı (bu turda yeniden açılmadı) · **G** görüldü, kısmen · **ENG** engelli (dış bağımlılık) · **GÖRÜLEMEDİ** (neden yazılı).
Bakış hücreleri: ✓ kontrol edildi, sorun görülmedi · **D** düzeltildi · **A** açık takip (ID) · U uygulanmaz · — bu turda ayrıca bakılmadı (önceki kanıt).
Sütunlar: Psi psikoloji · Ped pedagoji/çocuk gelişimi · Eğt eğitmen/ölçme · UX bilgi mimarisi · Gör görsel/etkileşim · Mim mimari/güvenlik · Erş erişilebilirlik/cihaz.
Kanıt kısaltması: `c12/` = `../c12-2026-11-06/ui/`; `d4/` = `../d4-2026-11-06/ui/` (D4 sonrası kanıtlar); `after/<id>-{phone,narrow,tablet,tabletLand}.png`, büyük yazı `after/<id>-zoom-zoom135.png`, ölçümler `after/metrics.json`, kontroller `after/checks.json`.

## 1. Bulgu kaydı (bütün kimlikler)

### 1a. Bu turda (C12) bulunan/düzeltilen

| ID | Öncelik | Birim | Bulgu | Durum · değişiklik | Kanıt (önce → sonra) |
|---|---|---|---|---|---|
| Q00-C12-1 | **P1** | `/parent/prova` sekmeleri | %135 ölçekte “Hazırla / Gönderilenler / İncelenecekler” üst üste biniyor, sayaç rozeti metni örtüyor (okunmayan sekme). | **DÜZ** `4e39032`: sekme satırı alt satıra geçer, sekme küçülmez. | `c12/after/prova-hub-zoom-zoom135.png` (önce: tur 1 ölçümü “Hazırla 35×48”, `c12/before/metrics.json`) |
| Q00-C12-2 | **P1** | Okul tatili (C11 devri) | `plan_for_day` `holiday` + `paused` döndürüyor; takvim, veli ana ekranı ve çocuk Bugün göstermiyor, duraklatılan dersler program gibi listeleniyordu. | **DÜZ** `5d2f790`: “Okul tatili — program duraklatıldı” notu (takvim gün kartı, ana ekran plan kartı), çocukta “Bugün okul tatili. Ders yok; dinlenebilirsin.”; duraklatılan ders listelenmez; özet ders sayısı saymaz. Çanta/görev sunucunun döndürdüğü gibi (sunucu duraklatmıyor). | `c12/holiday/holiday-{calendar_day,parent_home,child_today}-{phone,tabletLand}.png`, `holiday-checks.json` 4/4 (RPC yanıtı **taklit**), çekirdek testi |
| Q00-C12-3 | P2 | Menü, ana ekran, profil arşivi, ses kaynakları, tekrar günleri, sonuç özeti, toplu arşiv | İki çocukta/iki soruda aynı adlı eylemler (“Profili düzenle×2”, “Hedef belirle×2”, “İncele×2”, “Gün ve içeriği düzenle×3”, “Toplu arşivle×3”…): ekran okuyucu hangisi olduğunu söylemiyor. | **DÜZ** `1f72f77`, `039fce2`: `accessibilityLabel` çocuk/soru/gün/tür adıyla. | `c12/before/metrics.json` → `c12/after/metrics.json` (tekrar listesinden çıktı) |
| Q00-C12-4 | P2 | 27 seçim çipi/sekme | Q00-A1-19 kalıbı kalan yerlerde (Prova kitapçık/seviye/soru editörü, merkez sekmeleri, hazırlayıcı adım/çocuk, defter renk/araç/sekme, inceleme sekmeleri, ortak kaynak sihirbazı, rutin günleri, paket seçimi) web'de seçili durum `aria-*` olarak yazılmıyordu. | **DÜZ** `e6e5a1a`: `aria-pressed` / `aria-selected`; alt gezinmede `aria-current="page"`. | kod + `after/metrics.json` |
| Q00-C12-5 | P2 | `/parent/prova/level` | “Konu başına soru” ve “En çok soru” serbest sayı metin alanıydı (süre/sayı seçici kuralı). | **DÜZ** `77720b8`: `NumberChoice` (hazır değer + adım + elle giriş). | `c12/before/prova-level-phone.png` → `c12/after/prova-level-phone.png` |
| Q00-C12-6 | P2 | `/parent/prova/review/[id]` | Soru seçici 53×43 px, adı “Soruyu seç” (hangi soruda olduğunu söylemiyor). | **DÜZ** `039fce2`: 48 px, “Soruyu seç: n / N”. | `c12/before/metrics.json` → `c12/after/prova-review-*.png` |
| Q00-C12-7 | P2 | Takvim hafta şeridi | Bilinmeyen ders sayısı “?” olarak görünüyordu (boş bilgi). | **DÜZ** `dc595e6`: “–”; ayrıntı erişilebilirlik etiketinde. | `c12/before/parent-calendar-phone.png` → `c12/after/parent-calendar-phone.png` |
| Q00-C12-8 | P2 | `ChildPicker` | Tek çocukta `allLabel` verilen ekranlarda “Tümü” + çocuk iki eşdeğer çip. | **DÜZ** `1f72f77`: tek çocukta yalnız kimin verisi olduğu. | `c12/after/one-{progress,share,grades,notes}-phone.png` |
| Q00-C12-9 | P2 | Yönetim paneli iş kuyruğu | “Önce bunlara bakın” kartında hedef 19 px metin bağlantısı; satırda “Aç” 36 px ve hepsi aynı adda. | **DÜZ** `2a0e998`: kartın tamamı tıklanır, “Aç” 44 px + kuyruk adı. | `c12/backoffice/bo-dashboard-desktop.png` (ölçüm aracı `::after` alanını görmez, yalnız bağlantı kutusunu ölçer) |
| Q00-C12-10 | P2 | `/questions` filtreleri | Sınıf/ders/konu seçimlerinde etiket yok. | **DÜZ** `2a0e998`. | `c12/backoffice/bo-metrics.json` (etiketsiz 3 → 0) |
| Q00-C12-11 | P2 | `/operations` politika tablosu | “Açık” onay kutusu küçük satır; limit alanlarının ekran okuyucu adı ham kod (`prova_generate plus monthly_limit`). | **DÜZ** `aeec266`. A3'teki “tablette 40 px altı giriş” bu turda ölçülmedi (giriş `min-h-12`, ölçüm temiz). | `c12/backoffice/bo-operations-{desktop,tablet}.png` |
| Q00-C12-12 | P2 | Modal geçişleri | `animationType="fade"` modallar azaltılmış hareket tercihine bakmıyor (kod okuma; kısa solma). | **DÜZ (kısmi, D4)**: ortak `DecisionSheet` ve `timetable-import` artık `useRouteMotion` (reduce → `none`). Sonra: reduce'ta açılışta çalışan animasyon 0/6 örnek, normalde 4/6. **Açık (D1 alanı):** `parent-review-workspace.tsx` ×4, `prova/groups.tsx` ×3, `question-media.tsx` ×1 hâlâ sabit `fade`. | `d4/checks.json` → `c12_12_modal_respects_reduced_motion`; `d4/modal-{reduce,no-preference}-phone.png` |
| Q00-C12-13 | P2 | Giriş ekranı klavye | Son odak bağlantısından sonra kaydırma kabı odak alıyor, görünür halka yok (Chrome kaydırılabilir kabı odaklanabilir yapar). | **DÜZ (D4)**: D4 ölçümü, sekme dizisinde son öğeden sonraki durağın kaydırma kabı değil `BODY` (sekme dizisinin sonu, headless Chrome) olduğunu gösterdi. Kap yine de Chrome'da odaklanabilir; `ParentScreen`/`Screen` kabı `data-gina-scroll` ile işaretlendi, `global.css` `:focus-visible` 3 px mor halka çiziyor (klavye kipinde ölçüldü: `solid 3px rgb(96,66,222)`). | `d4/checks.json` → `c12_13_sign_in_scroll_focus_visible`; `d4/sign-in-scroll-focus-phone.png` |
| Q00-C12-14 | P2 | Takvim/çocuk ana ekranı | “Takvim”, “Bugün”, “Görevler” adları içerikte ve alt gezinmede iki kez geçiyor. | Gerekçeli **sorun yok**: farklı bölgeler (sekme vs gezinme), işlevleri farklı; değişiklik yapılmadı. | `after/metrics.json` |

### 1b. A1 (auth, veli, aile, ayarlar) — güncel durum

| ID | Öncelik | Durum | Kapanış kanıtı |
|---|---|---|---|
| Q00-A1-1, -2, -3 | P1 | **ÖK kapalı** | [A1 ek doğrulama](SCREEN-REVIEW-MATRIX-A1.md#ek-doğrulama-gece-ikinci-koşusu); bu tur: Enter ile giriş betiğin her oturumunda kullanıldı (`test-c12-tour.cjs` `signIn`). |
| Q00-A1-4…-9, -18, -19 | P2 | **ÖK kapalı** | A1 `after-*`; -19 kalıbı kalan 27 yerde Q00-C12-4 ile tamamlandı. |
| Q00-A1-10 çocuk silme | P2 | **ÖK kapalı** | [`deletion-preview-2026-11-06`](../deletion-preview-2026-11-06/README.md) → `ui/menu-danger-zone-phone.png`, `ui/preview-child-desktop.png`; sunucu/Edge: `c03-2026-11-06/service-checks.json`. |
| Q00-A1-11, -14, -17 | P2 | **ÖK kapalı** | `u01-2026-11-06/sign-up-phone.png`, `family-create-desktop.png`, `family-intent-phone.png`. |
| Q00-A1-12, -13, -16 | P2 | **ÖK kapalı** | `u03-2026-11-06/ui/home-many-phone.png`, `home-offline-first-load-phone.png`, `menu-devices-phone.png`. |
| Q00-A1-15 takvim “Tümü” tekrarı | P2 | **ÖK kapalı** | [`calendar-plan-history-2026-11-06`](../calendar-plan-history-2026-11-06/README.md) → `ui/all-children-summary-rows-phone.png`; bu tur `c12/after/parent-calendar-phone.png`. |

### 1c. A2 (çocuk, çocuk modu, Prova) — güncel durum

| ID | Öncelik | Durum | Kapanış kanıtı |
|---|---|---|---|
| Q00-A2-1, -2 (çizim/boş cevap otomatik 0) | P0/P1 | **ÖK kapalı** (sunucu + UI) | `open-answer-scoring-2026-11-06/ui/attempt-pending-phone.png`, `hub-pending-phone.png`, `child-prova-pending-phone.png`; AI öneri ayrımı `c08-2026-11-06/ui/attempt-ai-suggestion-phone.png`. |
| Q00-A2-3 defter telefon yatay | P1 | **ÖK kapalı**, bu tur yeniden ölçüldü | A2 `after-child-notebook-phone-land.png`; bu tur 844×390 kâğıt 806×206 px görünür, `c12/after/notebook-phoneLand.png`. |
| Q00-A2-4, -5, -7 | P1/P2 | **ÖK kapalı** | A2 `after-*`. |
| Q00-A2-6 PIN kontrolü | P2 | **ÖK kapalı** | `u02-2026-11-06/screenshots/child-mode-single-wrong-pin-recovery-phone.png`; `c06-2026-11-06/screenshots/parent-exit-pin-locked-phone.png`. |
| Q00-A2-8 merkezde tekrar kart | P2 | **ÖK kapalı** | `c04-2026-11-06/ui/hub-prepare-phone.png`, `hub-sent-phone.png`. |
| Q00-A2-9 hedef uyuşmazlığı kilidi | P2 | **DÜZ** `4143cdd` | Kontrol adımında “Hedefi N soru yap” kısa yolu (kod; bu tur hazırlayıcı kontrol adımına kadar sürülmedi → yalnız tsc/lint + bileşen incelemesi). |
| Q00-A2-10 “Çizimli not ekle” düğme hissi | P2 | **DÜZ** `4e2b33c` | `c12/after/prova-review-narrow.png` (kenarlı, simgeli ikincil düğme). Tablet yatay sol panel boşluğu: `c12/after/prova-review-tabletLand.png` — iki sütun dolu, boşluk kabul edilebilir. |
| Q00-A2-11 çocuk takvimi “düzenleyebilirsin” | P2 | **DÜZ** `4143cdd` (değer düzeltmesi) | `planner.childEmptyBody`: “Ders programına göz atabilirsin. Bir şey eklemek istersen veline söyleyebilirsin.” `c12/after/cm-calendar-phone.png`. |
| Q00-A2-12 hedef derin bağlantı | P2 | **ÖK kapalı** | `u06-u07-2026-11-06/child-goal-selected-phone.png`. |
| Q00-A2-13 AI hata metni ayrımı | P2 | **DÜZ** `e3d69cc` | `ErrorText`, C08 `ProvaAiError` kategori metnini (izin/paket, çevrimdışı, geçici servis…) artık genel “Bir şeyler ters gitti”ye düşürmüyor. Gerçek Edge hata ekranı bu turda üretilmedi (kod + tsc). |
| A2 GÖRÜLEMEDİ listesi | — | Kapananlar **ÖK**: katalog 2–3 (`c01…/p1-school-confirmed-saved-phone.png`), dağılım 2–3 (`p01-p02…/blueprint-personalized-review-phone.png`), soru kaydı→paylaşım (`c07…/mobile/screenshots/share-fix-sent-phone.png`), kütüphane edinimi (`c07…/library-first-import-charged-phone.png`), Birlikte Prova katılım (`c07…/groups-phases-open-phone.png`), kitapçık (`p01-p02…/booklet-student-copy.pdf`), hazırlayıcı AI (`c04…/ai-fill-remaining-phone.png`), tek çocuklu çocuk modu (`u02…`), geri gönderilen görev ve odak sayacı (`u06-u07…`), veli telefonunda Prova çözme (`c04…/child-question-1-phone.png`). ~~Hâlâ GÖRÜLEMEDİ~~ → **D4'te gerçek uygulamada görüldü (6/6, TE):** ortak kaynak adım 2–3 + kayıt, dolu tekrar planı kaydı, plan gün onayı (+ çakışma uyarısı yineleme koşusunda), “Belgeden yararlan”, 10 dk süre dolumu (tarayıcı saati ileri alındı), veli PIN'i tanımsız kartı (yalnız gözlem). Ayrıntı: [`d4-2026-11-06`](../d4-2026-11-06/README.md). Kapanan: Q00-C12-T1. | |

### 1d. A3 (backoffice) — güncel durum

| ID | Öncelik | Durum | Kanıt |
|---|---|---|---|
| Q00-A3-1, -2, B01-a, B01-b, B02-a, B03-a, B02-b, Q00-A3-3, S06-a | P1/P2 | **ÖK kapalı** | A3 `a3/` önce/sonra. |
| B01 panel iş kuyruğu | P1 | **ÖK kapalı** | `c07-2026-11-06/ui/screenshots/01-dashboard-*-1280.png`, `admin-workqueue-2026-11-06/ui/01-dashboard-workqueue-1280.png`; hedefler Q00-C12-9. |
| B02 ortak soru editörü (`/questions` JSON şık) | P1 | **DÜZ** `1d351b0` | Şıklar alan alan + doğru cevap radyo grubu; bilinmeyen biçimde JSON korunur. `c12/backoffice/bo-questions-editor-desktop.png`, `bo-checks.json` → `questions_structured_choice_editor` (gerçek global soru ile). |
| B03 grup önizlemesi | P2 | **ÖK kapalı** | `c07…/11-groups-preview-content-1280.png`. |
| B04 sorumlu/hazır yanıt | P2 | **ÖK kapalı** | `b03-b04…/ui/11-support-assigned-1280.png`, `c07…/03-canned-replies-manage-1280.png`. |
| Q00-A3-4 kenar menü kaydırma | P2 | **A** (kısmi, A3) | Headless kaydırma çubuğu görünmez; gerçek tarayıcı kontrolü C15. |
| Q00-A3-5 rol hatası ≠ yetkisiz | P2 | **DÜZ** `aeec266` | `c12/backoffice/bo-sign-in-role-error-desktop.png`, `bo-sign-in-no-role-desktop.png`; `bo-checks.json` iki kontrol geçti (rolsüz sentetik hesap, RPC 503 taklidi). |
| Q00-A3-6 gizli dosya girişi | P2 | Gerekçeli sorun yok | Görünür “Paket yükle” düğmesi hedeftir; gizli `input` ölçümde 1 px. |
| Q00-A3-7 yetki düşünce tek bildirim | P2 | **A** (kısmi) | Operatör: `c07…/14-revoked-*-1280.png`. Yönetici (`admins`) iptali yalnız pgTAP. |
| `/ai` ve `/questions` `window.confirm` | P2 | **A** (Q00-C12-T2) | Tarayıcı diyaloğu erişilebilir ama onaylı dilde değil. |
| Diğer A3 P2'ler (aile araması tam eşleşme, denetim “Yapan” UUID, AI model etki özeti, kütüphane paket etiketi ham kod, politika örnek hesap, katalog sunucu araması, yardım yazısı yapısı) | P2 | Bir kısmı C07/B03-B04/C11 ile kapandı (yardım yazısı yapısı `b03-b04…/06-help-article-draft-live-1280.png`, eşanlamlılar C11); kalanlar **A** → B01/B02/S04/S06 kimlikleri altında. | A3 tablo + C07/C11 raporları |


## 2. Rota envanteri × yedi bakış açısı

### 2a. Oturumsuz / ortak rotalar (mobil-web)

| Birim | Rol · ölçü | Senaryo | Psi | Ped | Eğt | UX | Gör | Mim | Erş | Durum | Kanıt |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` rol yönlendirme | oturumsuz/veli/anonim · 4 ölçü | yönlendirme | ✓ | U | U | ✓ | ✓ | ✓ (A1 s07, U01 kilit) | ✓ | TE | `after/child-anon-*.png` (anonim → `/device/pair`) |
| `/(auth)/sign-in` giriş | oturumsuz · 4 ölçü + klavye | Enter, sekme sırası | ✓ | U | U | ✓ | ✓ | ✓ | ✓ / A Q00-C12-13 | TE | `after/auth-sign-in-*.png`, `checks.json` |
| `/(auth)/sign-in?mode=up` kayıt | oturumsuz · 4 ölçü | tek yetişkin beyanı | ✓ | U | U | ✓ | ✓ | ✓ | ✓ | TE | `after/auth-sign-up-*.png` |
| Şifre yenileme isteği | oturumsuz | — | ✓ | U | U | ✓ | ✓ | ✓ | ✓ | ÖK | `u01-2026-11-06/reset-from-admin-phone.png` |
| `/reset-password` | oturumsuz · 4 ölçü | kodsuz açılış | ✓ | U | U | ✓ | ✓ | ✓ | ✓ | TE | `after/auth-reset-password-*.png` |
| `/auth-callback` | oturumsuz · 4 ölçü | iptal | ✓ | U | U | ✓ | ✓ | ✓ | ✓ | TE | `after/auth-callback-cancel-*.png` |
| Sosyal giriş bileşeni | — | — | — | U | U | — | — | — | — | ENG (sağlayıcı yok, S01) | U01 kapalı durum metni |
| `/(auth)/family` kur/katıl | ailesiz veli | — | ✓ | U | U | ✓ | ✓ | ✓ | ✓ | ÖK | `u01-2026-11-06/family-intent-phone.png` |
| `/device/pair` | anonim · 4 ölçü | kod üret | ✓ | ✓ | U | ✓ | ✓ | ✓ (C06 iptal nedeni) | ✓ | TE | `after/device-pair-*.png`; `c06…/device-revoked-reason-phone.png` |
| `/s/[token]` | oturumsuz · 4 ölçü | geçersiz bağlantı | ✓ | U | ✓ | ✓ | ✓ | ✓ | ✓ | TE | `after/share-invalid-*.png`; geçerli: `u06-u07…/share-viewer-*.png` |
| `/unsubscribe` | oturumsuz/veli · 4 ölçü | tokensız, geçersiz | ✓ | U | U | ✓ | ✓ | ✓ (C10) | ✓ | TE | `after/unsubscribe-*.png`, `after/unsubscribe-invalid-*.png` |
| `/verify-contact` | oturumsuz/veli · 4 ölçü | tokensız, geçersiz | ✓ | U | U | ✓ | ✓ | ✓ (C10) | ✓ | TE | `after/verify-contact-*.png` |

### 2b. Veli rotaları

| Birim | Rol · ölçü | Senaryo | Psi | Ped | Eğt | UX | Gör | Mim | Erş | Durum | Kanıt |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/parent` Bugün | veli · 4 ölçü + %135 | 0 / 1 / 2 çocuk; tatil | ✓ | ✓ | U | D (C12-3, tatil C12-2) | ✓ | ✓ | D | DÜZ | `after/{zero,one,parent}-home-*.png`, `after/parent-home-zoom-zoom135.png`, `holiday/holiday-parent_home-*.png` |
| `/parent/menu` (5 sekme) | veli · 4 ölçü + %135 | 2 çocuk | ✓ | U | U | ✓ | ✓ | ✓ | D (C12-3) | DÜZ | `after/parent-menu-*.png` |
| Çocuk ekleme sihirbazı | veli | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | D (C12-4 gün çipleri) | ÖK + DÜZ | A1 `new-child-wizard-*`; tek çocuk RPC ile oluşturuldu |
| `/parent/calendar` | veli · 4 ölçü + %135 | 0 / 1 / 2 çocuk; tatil | ✓ | ✓ | ✓ | D (C12-7, C12-2) | ✓ | ✓ | D (C12-3) | DÜZ | `after/{zero,one,parent}-calendar-*.png`, `holiday/holiday-calendar_day-*.png` |
| Takvim alt akışları (etkinlik, ders programı, çanta, belgeden plan, toplu arşiv) | veli | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | D (C12-3 toplu arşiv) | ÖK | `u05…`, `c02…`, `c03…/calendar-bulk-preview-desktop.png` |
| `/parent/tasks` + sihirbaz + rutin | veli · 4 ölçü + %135 | 0 / 1 / 2 çocuk | ✓ | ✓ | U | ✓ | ✓ | ✓ | D (C12-4 günler) | TE | `after/{zero,one,parent}-tasks-*.png` |
| Görev geri gönderme nedeni | veli | — | ✓ | ✓ | U | ✓ | ✓ | ✓ | ✓ | ÖK | `c03…/return-sheet-phone.png` |
| `/parent/rewards` + sihirbaz + hedef | veli · 4 ölçü | — | ✓ | ✓ | U | ✓ | ✓ | ✓ | ✓ | TE | `after/parent-rewards-*.png` |
| `/parent/grades` | veli · 4 ölçü | 0 / 1 / 2 çocuk | ✓ | U | ✓ | ✓ | ✓ | ✓ | D (C12-8 tek çocuk) | TE | `after/{zero,one,parent}-grades-*.png` |
| `/parent/notes` + editör | veli · 4 ölçü | 0 / 1 / 2 çocuk | ✓ | U | U | ✓ | ✓ | ✓ | ✓ | TE | `after/{zero,one,parent}-notes-*.png` |
| `/parent/notifications` (kanal × amaç) | veli · 4 ölçü + %135 | — | ✓ | U | U | ✓ | ✓ | ✓ (C10) | ✓ | TE | `after/parent-notifications-*.png` |
| `/parent/inbox` | veli · 4 ölçü | boş | ✓ | U | U | ✓ | ✓ | ✓ | ✓ | TE | `after/parent-inbox-*.png` |
| `/parent/subscription` (AI kullanım) | veli · 4 ölçü | — | ✓ | U | U | ✓ | ✓ | ✓ (C08) | ✓ | TE | `after/parent-subscription-*.png` |
| `/parent/help` + talep + yanıt | veli · 4 ölçü | — | ✓ | U | U | ✓ | ✓ | ✓ | ✓ | TE | `after/parent-help-*.png`; yanıt: `c03…/help-new-reply-phone.png` |
| `/parent/share` + önizleme | veli · 4 ölçü | 1 / 2 çocuk | ✓ | U | ✓ | ✓ | ✓ | ✓ | D (C12-8) | TE | `after/{one,parent}-share-*.png` |
| `/parent/weekly-review` | veli · 4 ölçü | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | TE | `after/parent-weekly-review-*.png`; AI hazır durumu ENG |
| `/parent/education` + sihirbaz + tatil önerileri | veli · 4 ölçü | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (C02/C11) | ✓ | TE | `after/parent-education-*.png` |
| `/parent/profile-archive` | veli · 4 ölçü | 2 çocuk | ✓ | U | U | ✓ | ✓ | ✓ | D (C12-3) | DÜZ | `after/parent-profile-archive-*.png` |
| `/parent/families` | veli · 4 ölçü | tek aile | ✓ | U | U | ✓ | ✓ | ✓ | ✓ | TE | `after/parent-families-*.png` |
| `/parent/device-access` | veli · 4 ölçü | cihazsız | ✓ | U | U | ✓ | ✓ | ✓ | ✓ | TE | `after/parent-device-access-*.png` |
| `/parent/pair-device` (yeni, U02/C06) | veli · 4 ölçü | — | ✓ | U | U | ✓ | ✓ | ✓ | ✓ | TE | `after/parent-pair-device-*.png`; QR: `c06…/qr-signed-out-sign-in-phone.png` |
| `/parent/room-credits` | veli · 4 ölçü | — | U | U | U | ✓ | ✓ | U | D (C12-3) | DÜZ | `after/parent-room-credits-*.png` |

### 2c. Veli Prova zinciri

| Birim | Rol · ölçü | Senaryo | Psi | Ped | Eğt | UX | Gör | Mim | Erş | Durum | Kanıt |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/parent/prova` Hazırla/Gönderilenler/İncelenecekler | veli · 4 ölçü + %135 | 0 / 1 / 2 çocuk | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **D (C12-1)** | DÜZ | `after/{zero,one}-prova-*.png`, `after/prova-hub{,-sent,-review}-*.png`, `after/prova-hub-zoom-zoom135.png` |
| `/parent/prova/builder` (4 adım) | veli · 4 ölçü + %135 | başlangıç | ✓ | ✓ | ✓ | D (A2-9) | ✓ | ✓ | D (C12-4) | DÜZ (kısmen sürüldü) | `after/prova-builder-*.png`; adımlar: `c04…` |
| `/parent/prova/question` (3 adım) | veli · 4 ölçü | boş | ✓ | U | ✓ | ✓ | ✓ | ✓ | D (C12-4) | TE | `after/prova-question-*.png`; kayıt `p01-p02…/editor-after-save-phone.png` |
| `/parent/prova/shared-source` | veli · 4 ölçü | adım 1 | ✓ | U | ✓ | ✓ | ✓ | ✓ | D (C12-4) | TE (D4: adım 2–3 + kayıt, 4 ölçü) | `after/prova-shared-source-*.png`; `d4/shared-source-step{2,3}-*.png`, `d4/shared-source-saved-*.png` |
| `/parent/prova/library` | veli · 4 ölçü | — | ✓ | U | ✓ | ✓ | ✓ | ✓ | ✓ | TE | `after/prova-library-*.png`; edinim `c07…` |
| `/parent/prova/catalog` | veli · 4 ölçü | — | ✓ | U | ✓ | ✓ | ✓ | ✓ (C01/C05) | ✓ | TE | `after/prova-catalog-*.png` |
| `/parent/prova/blueprint` | veli · 4 ölçü | — | ✓ | U | ✓ | ✓ | ✓ | ✓ | ✓ | TE | `after/prova-blueprint-*.png` |
| `/parent/prova/level` | veli · 4 ölçü | — | ✓ | U | ✓ | ✓ | ✓ | ✓ | D (C12-5, C12-4) | DÜZ | `after/prova-level-*.png` |
| `/parent/prova/booklet` | veli · 4 ölçü | — | ✓ | U | ✓ | ✓ | ✓ | ✓ | D (C12-4) | TE | `after/prova-booklet-*.png`; PDF `p01-p02…` |
| `/parent/prova/groups` | veli · 4 ölçü | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | TE | `after/prova-groups-*.png` |
| `/parent/prova/share` | veli · 4 ölçü | sorusuz | ✓ | U | ✓ | ✓ | ✓ | ✓ | ✓ | TE | `after/prova-share-*.png` |
| `/parent/prova/progress` | veli · 4 ölçü | 1 / 2 çocuk | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | D (C12-4, C12-8) | TE | `after/{one-progress,prova-progress}-*.png` |
| `/parent/prova/attempt/[id]` | veli · 4 ölçü | puanlanmış; AI önerisi bekleyen | ✓ | ✓ | ✓ | D (A2-13) | ✓ | ✓ | D (C12-3) | DÜZ | `after/prova-attempt{,-ai}-*.png` |
| `/parent/prova/review/[id]` | veli · 4 ölçü | 3 soru | ✓ | ✓ | ✓ | D (A2-10) | D | ✓ | D (C12-6) | DÜZ | `after/prova-review-*.png` |
| `/parent/prova/repeat/[id]` | veli · 4 ölçü | 2 soru, 3 gün | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | D (C12-3) | DÜZ | `after/prova-repeat-*.png` |
| `/parent/prova/plan/[id]` | veli | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | TE (D4: 2 gün seçildi → gözden geçir → takvime eklendi, plan `approved`) | A2 `parent-plan-*.png`; `d4/plan-days-{selected,preview,saved}-*.png`, `d4/plan-days-preview-overlap-iteration-phone.png` |
| `/parent/prova/exam`, `/generate` | veli | yönlendirme | U | U | U | ✓ | U | ✓ | U | ÖK | `c04…` (açık taslağa gider) |

### 2d. Çocuk modu (veli telefonu) ve bağımsız çocuk cihazı

| Birim | Rol · ölçü | Senaryo | Psi | Ped | Eğt | UX | Gör | Mim | Erş | Durum | Kanıt |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/parent/child-mode` giriş + PIN | veli→çocuk | 2 çocuk, PIN 1234 | ✓ | ✓ | U | ✓ | ✓ | ✓ | ✓ | TE (betik girişi) | U02/C06 kanıtı |
| `/parent/child-mode/today` Dünyam | çocuk modu · 4 ölçü, reduced motion | görev var; tatil | ✓ | ✓ | U | ✓ | ✓ | ✓ | ✓ (C12-14 gerekçeli) | DÜZ (tatil) | `after/cm-today-*.png`, `holiday/holiday-child_today-*.png` |
| `/week`, `/calendar`, `/collection`, `/goal`, `/room-preview`, `/prova` | çocuk modu · 4 ölçü | — | ✓ | ✓ | ✓ | D (A2-11) | ✓ | ✓ | ✓ | TE | `after/cm-{week,calendar,collection,goal,room-preview,prova}-*.png` |
| Çözüm defteri `/parent/child-mode/prova/[id]` | çocuk modu · 390, 844×390, 768, 1280 | çiz, döndür, modal, kopyala, genişlet | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | TE | §4; `after/notebook-*.png` |
| Çıkış (veli PIN) | çocuk modu | — | ✓ | ✓ | U | ✓ | ✓ | ✓ | ✓ | ÖK | `c06…/parent-exit-pin-locked-phone.png` |
| `/child`, `/child/pin`, `/child/*` (eşlenmiş cihaz) | cihaz JWT | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ÖK; bu tur yalnız anonim yönlendirme | A2 `child-*`, `u02…/child-pin-wrong-tablet.png`. Aynı bileşenler çocuk modunda bu turda sınandı. Eşlenmiş cihaz JWT yolu bu turda koşulmadı. |

### 2e. Yönetim (backoffice) — 1280×800 + 768×1024, sentetik yönetici

| Sayfa | Psi | Eğt | UX | Gör | Mim | Erş | Durum | Kanıt (`c12/backoffice/`) |
|---|---|---|---|---|---|---|---|---|
| `/sign-in` (rolsüz, rol hatası) | D | U | D | ✓ | D (A3-5) | ✓ | DÜZ | `bo-sign-in-{role-error,no-role}-desktop.png` |
| `/dashboard` iş kuyruğu | ✓ | U | ✓ | ✓ | ✓ (C07) | D (C12-9) | DÜZ | `bo-dashboard-{desktop,tablet}.png` |
| `/families`, `/billing`, `/overrides` | ✓ | U | ✓ | ✓ | ✓ | ✓ | TE | `bo-families-*`, `bo-billing-*`, `bo-overrides-*` |
| `/ai` | ✓ | U | A (T2 confirm) | ✓ | ✓ | ✓ | TE | `bo-ai-*` |
| `/operations` | ✓ | U | ✓ | ✓ | ✓ | D (C12-11) | DÜZ | `bo-operations-*` |
| `/input-catalog` (C11 serbest) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | TE | `bo-input-catalog-*` |
| `/questions` + düzenleyici | ✓ | D (B02) | D | ✓ | ✓ | D (C12-10) | DÜZ | `bo-questions-*`, `bo-questions-editor-desktop.png` |
| `/library` (koleksiyon, taslak, haklar, katkı, senaryo) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | TE | `bo-library*-*` |
| `/library-publication` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | TE | `bo-library-publication-*` |
| `/groups`, `/cohort-review` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | TE | `bo-groups-*`, `bo-cohort-review-*` |
| `/support`, `/support-replies` (yeni), `/ideas`, `/help-articles` | ✓ | U | ✓ | ✓ | ✓ | ✓ | TE | `bo-support*-*`, `bo-ideas-*`, `bo-help-articles-*` |
| `/notifications`, `/announcements` | ✓ | U | ✓ | ✓ | ✓ | ✓ | TE | `bo-notifications-*`, `bo-announcements-*` |
| `/education-calendars` (C11 serbest) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | TE | `bo-education-calendars-*` |
| C09 ön inceleme bileşenleri | — | — | — | — | — | — | C09 sonrası: bu turda yalnız sayfa açılışı (`bo-library*`); ayrıntılı inceleme C09 raporunda | `../c09-2026-11-06/README.md` |

Ölçüm özeti (`bo-metrics.json`): 23 sayfa × 2 ölçüde yatay taşma 0, ham sunucu hatası 0, `pageerror` 0; etiketsiz alan 3 → 0.

## 3. Modal / sihirbaz / alt panel / durum birimleri

| Birim | Durum | Kanıt / not |
|---|---|---|
| Çocuk ekleme sihirbazı (4 adım), görev sihirbazı, ödül sihirbazı, hedef kurulumu | ÖK | A1 `new-child-wizard-*`, `task-create-*`, `reward-create-*` |
| Not editörü (2 adım), puan düzenleyici, etkinlik editörü, ders programı tablo/içe aktarma, çanta | ÖK | A1, U05, C02 |
| Toplu arşiv sayfası (`bulk-scope-sheet`) | DÜZ (adlar) | `c03…/calendar-bulk-preview-desktop.png`; C12-3 |
| Görev geri gönderme sayfası | ÖK | `c03…/return-sheet-phone.png` |
| Çocuk görev paneli + odak sayacı | ÖK | `u06-u07…/child-focus-*.png` |
| Karar sayfası (`decision-sheet`), ayrılma uyarısı | ÖK | A1 `device-access-leave-sheet-phone.png` |
| Hesap silme, e-posta doğrulama | G / ENG | A1; Edge/sağlayıcı yok |
| Paylaşım önizlemesi, yardım talebi + görsel eki | ÖK / G | `u06-u07…`; görsel eki UI'da koşulmadı (C03 sınırı) |
| Kaynak seçici, ortak kaynak sihirbazı | TE (D4) | `u05…/sources-50-more-phone.png`; `d4/shared-source-*`, `d4/document-*` |
| Defter: yazı modalı, sorudan deftere al, genişlet, araçlar | TE | `after/notebook-text-modal-tablet.png`, `notebook-copy-sheet-tablet.png`, `notebook-copy-placed-tablet.png`, `notebook-expanded-tablet.png` |
| İnceleme: soru seçici, çizimli not, AI rızası, soru önizlemesi | DÜZ / ÖK | C12-6, A2-10; `c08…/review-suggestion-in-score-phone.png` |
| Plan takvime yerleştir, tekrar takvimi | TE (D4) | `after/prova-repeat-*.png`; `d4/repeat-{filled,preview,saved}-*.png`, `d4/plan-days-*` |
| Boş durumlar (0 kayıt) | TE | `after/zero-*.png` (6 ekran × 3 ölçü) |
| Yükleniyor / çevrimdışı / hata | ÖK | `u03…/home-offline-first-load-phone.png`, `home-tasks-error-phone.png`; AI kategori metni A2-13 |
| İzin durumları (push, kamera) | ENG | web'de yok; C15 |

## 4. Kontrol listesi sonuçları (kart metni)

| Madde | Sonuç | Kanıt |
|---|---|---|
| Tekrar eden bağlantı / boş bilgi | Aynı adlı eylemler ayrıştırıldı (C12-3); “?” boş bilgisi düzeltildi (C12-7); kalan tekrarlar gerekçeli (C12-14). | `after/metrics.json` |
| Tek çocuk seçicisi | `ChildPicker` tek çocukta seçim göstermiyor (C12-8); 1 çocuklu ailede takvim/Prova/puan/not/paylaşım/gelişim sınandı. | `after/one-*.png` |
| Safe area | Kod: ana ekran alt gezinme `insets.bottom`, `SafeAreaView` hazırlayıcı/defter. Web'de çentik yok → **C15**. | — |
| Okunmayan buton | %135 ölçekte Prova sekmeleri (C12-1, P1) düzeltildi; 76 rota × 4 ölçüde kesilen düğme metni 0. | `after/metrics.json`, `after/*-zoom-zoom135.png` |
| Uzun prompt textarea ve örnekler | Hazırlayıcı/AI istem alanları `PromptExamples` + çok satırlı alan (C04 kanıtı); bu turda yeni kusur yok. | `c04…/ai-fill-remaining-phone.png` |
| Süre seçici / elle giriş | `NumberChoice` hazırlayıcı ve seviye süresinde vardı; seviye sayı alanları da taşındı (C12-5). Kitapçık sınıf alanı **D4'te 1–12 radyo seçimine** çevrildi (T3 kapandı; `d4/booklet-grade-*.png`). Ortak kaynak sihirbazının sınıf alanı aynı kalıpta serbest 2 hane — **A** D4-1 (D1 alanı). | `after/prova-level-phone.png` |
| Bağlama uygun maskot | Veli ekranlarında başlık yanında, çocukta oda sahnesinde; Prova/defter/yönetimde maskot yok (dikkat dağıtmıyor). Değişiklik yok. | `after/*-phone.png` |
| Azaltılmış hareket | `prefers-reduced-motion` ile çalışan CSS animasyonu 0; `ConnectionMoment`, koleksiyon, oda, rota geçişi `isReduceMotionEnabled` okuyor (kod). Modal solması açık takip C12-12. | `after/checks.json` |
| Türkçe dil | Çözülmemiş anahtar 0 (76 rota × 4 ölçü); A2-11 değer düzeltmesi. | `after/metrics.json` |
| Defter: çizerken dış kaydırma | 390, 844×390, 768, 1280'de çizim öncesi/sonrası bütün kaydırma konumları aynı (`outerScrollStable: true`). Gerçek dokunmatik tarayıcı kaydırması **C15**. | `after/checks.json` → `notebook_probe` |
| Defter: modal sonrası yön döngüsü | Web: tablet→yatay→tablet→telefon→tablet ve yazı modalı açıkken döndürme sonrası düzen ve URL sabit (kâğıt 1005/1106/1005/476/1005/1005 px). Native: bütün `Modal`'larda `supportedOrientations` var (kod taraması, 0 eksik). Cihaz döndürme **C15**. | `after/notebook-after-modal-rotate-tablet.png` |
| Defter: kesilen kopya görsel | Kopya sayfasında görsel tam (960×360 → 640×240), deftere yerleşen parça 373×140 ve sayfa sınırı içinde (`clippedRight` < 0). | `after/notebook-copy-sheet-tablet.png`, `notebook-copy-placed-tablet.png` |
| Defter: dikey boş defter | Tablet dikey kâğıt 718×497 görünür, önceki çizim korunuyor; telefon dikey 340×476. | `after/notebook-tablet.png`, `notebook-phone-drawn.png` |
| Defter: tam ekran | “Genişlet” ile kâğıt 718×1005. | `after/notebook-expanded-tablet.png` |
| Klavye | Giriş sekme sırası: niyet → e-posta → şifre → göster → unuttum → çocuk cihazı; halka görünür (C12-13 hariç). | `after/checks.json` |
| Ekran okuyucu rolleri/etiketleri | İsimsiz eylem 0; seçili durum `aria-*` 27 yerde eklendi (C12-4). Gerçek VoiceOver/TalkBack **C15**. | `after/metrics.json` |

## 5. Açık takip (P0/P1 açık yok)

| Takip | Öncelik | Kapsam | Neden açık |
|---|---|---|---|
| Q00-C12-T2 | P2 | `/ai`, `/questions` `window.confirm` → onaylı dilde diyalog | Tasarım kararı küçük; işlev çalışıyor |
| Q00-C12-12 (kalan) | P2 | `parent-review-workspace.tsx`, `prova/groups.tsx`, `question-media.tsx` sabit `fade` | D1 Prova ekranları; aynı tek satır (`useRouteMotion`) D1'e devredildi (D4) |
| D4-1 | P2 | Ortak kaynak sihirbazı “Sınıf” serbest 2 haneli alan | D1 alanı; kitapçıktaki radyo kalıbı uygulanabilir (D4) |
| D4-2 | P2 | Süreli Prova süre dolunca sonuç ekranı “Süre doldu” demiyor (yalnız “Deneme bitti!”); bitiş anı ekranda görünmeden sonuç açılıyor | D1 alanı (`app/child/prova/[examId].tsx`); cevap kaybı yok (D4) |
| D4-3 | P2 | Tekrar takvimi gün düzenlemede tarih/saat serbest metin (“Tarih (YYYY-AA-GG)”, “Saat (SS:DD)”) | `repeat-calendar.tsx` (Prova); `DateTimeChoice` kalıbı önerilir (D4) |
| D4-4 | P2 | Native (iOS `expo-print`) kitapçık PDF'inde metin katmanı: SF UI alt kümesi ToUnicode eşlemesiz; `pdftotext` “i” harfini “!” çıkarıyor (görsel doğru) → PDF içi arama/kopyalama/ekran okuyucu bozuk | `lib/prova-booklet.ts` HTML'ine gömülü web yazı tipi veya eşlemeli sistem yazı tipi; fiziksel cihazda doğrulanmalı (D4) |
| Kapanan (D4) | — | Q00-C12-T1, Q00-C12-T3, Q00-C12-13; Q00-C12-12 ortak bileşen kısmı | [`d4-2026-11-06`](../d4-2026-11-06/README.md) |
| Q00-A3-4, Q00-A3-7 (yönetici kısmı), A3 kalan P2'ler | P2 | B01/B02/S04/S06 | A3/C07 raporlarında |
| Fiziksel cihaz kabulü | — | VoiceOver/TalkBack, fontScale, safe area, dokunmatik defter, native yön, push | **C15** |
