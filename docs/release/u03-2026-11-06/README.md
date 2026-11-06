# U03 — Veli Bugün, menü ve bildirim girişleri (6 Kasım 2026)

**Durum: KOD HAZIR, İZOLE ORTAMDA WEB EXPORTU İLE TEST EDİLDİ, MAIN'E PUSH YOK, ÜRETİME DOKUNULMADI.** Takvim ekranı (`/parent/calendar`, `components/planner/*`) bu paketin dışında (başka ajanda). Migration yok.

Dal: `worktree-agent-a9dd00406a1b459dc` (taban `304f303`, ≥ `e4bc2dc`).

## Değişen dosyalar

- `apps/mobile/src/app/parent/index.tsx` — sorgular kart başına bölündü; çevrimiçi durumu; zil rozeti sorgusu.
- `apps/mobile/src/components/parent-home/home-view.tsx`, `theme.ts` — Bugün düzeni.
- `apps/mobile/src/app/parent/menu.tsx` — beş grup (Tehlikeli işlemler/silme önizlemesi satırlarına dokunulmadı; `git diff` ile `DangerZone/deleting/DeletionPreview` satırlarında değişiklik 0).
- `apps/mobile/src/app/parent/notifications.tsx` — yalnız başlık: "Bildirim tercihleri".
- `packages/core/src/i18n/{tr,en}.json` — yalnız yeni `parentToday.*` anahtarları (`{{x}}` biçimi). **Mevcut değer düzeltmesi (1):** `betaUx.planTitle` TR "Bugünde biraz yer var" → "Bugün için alan var" (Q00-A1-12 dil hatası; takvimdeki `emptyTitle` ile aynı söyleyiş). EN değişmedi.
- `docs/release/u03-2026-11-06/ui/ui-check.cjs` — Playwright kabul betiği (rapor klasöründe; `scripts/`'e dokunulmadı).

## Davranış

**Bugün (`/parent`)**
- Sıra (telefon): onay bekleyenler → **Sıradaki iş** → günün planı → çocukların ilerlemesi → bugünün görevleri → yaklaşan sınav → hedefler → kısayollar → "Birlikte bakalım". Masaüstünde sol sütun onay/sıradaki/plan/görevler, sağ sütun ilerleme/sınav/hedefler.
- **Sıradaki iş:** geri gönderilmiş görev önce ("Geri gönderildi; {ad} düzeltip yeniden gönderecek."), yoksa sıradaki planlı görev; dokununca doğru çocuk + görev açılır (`/parent/tasks?childId&taskId`). Onay yoksa ve iş kalmadıysa "Bugünün görevleri tamam." Görev listesi de geri gönderilen → planlı → bekleyen → tamamlanan sırasında.
- **Selamlama/maskot kompakt:** başlık telefonda 28 px, maskot 84×80 (masaüstü 128×112); ölçülen hero yüksekliği 92 px (önce ~120 px + yarım ekran maskot). Dar ekran/büyük yazıda maskot gizlenir. Onaylı mint/mor/krem, Nunito, aynı maskot.
- **Bağlantı tekrarı:** "Ödüller" kısayolu kaldırıldı (hedef kartındaki tek "Ödülleri yönet" + çocuk hedef satırları); Prova bağlantısı alt gezinmede; "Prova hazırla" yalnız bir yerde (yaklaşan sınav varsa sınav kartında o çocuk için builder, yoksa kısayolda). "Görev ekle" kısayolu görev yokken gizlenir (boş kartın "İlk görevi ekle"si tek eylem). Görev kartı başlığındaki toplam sayı kaldırıldı (ilerleme kartlarıyla aynıydı).
- **Bugün ↔ seçili gün:** hafta seçimi plan bölümünün içine taşındı; başka gün seçilince "Seçili gün: … Görev ve ilerleme sayıları bugüne aittir." + "Bugüne dön", ilerleme ve görev başlıklarında "Sayılar bugüne ait: 6 Kasım". Bugün çipi mor çerçeveli. Seçili günde plan yoksa "Seçili gün için plan yok." (bugün için "Bugün için alan var").
- **Zil:** Duyurular'a (`/parent/inbox`) gider; okunmamış sayısı rozeti (`parent_inbox` ilk sayfasıyla aynı sorgu anahtarı, önbellek paylaşılır) ve erişilebilir ad "Duyurular: 3 okunmamış". Tercihler: Duyurular → "Bildirim tercihleri" ve Menü › Hesap.
- **Kart düzeyinde hata:** yalnız çocuk listesi sorgusu bütün ekranı belirler. Onaylar, görevler (şablon+tamamlama), ilerleme (+ `family_star_balances`), plan (etkinlik+istisna) kendi kartında iskelet/hata + "Yeniden dene" gösterir; diğer kartlar çalışmaya devam eder. Görev verisi hatalıyken haftalık özet gizlenir (yanlış sıfır göstermez).
- **Çevrimdışı/yavaş (Q00-A1-13):** web'de `navigator.onLine`, native'de mevcut `onlineManager` (expo-network) izlenir. Veri yokken çevrimdışı açılış anında "Çevrimdışısın" durumu + yeniden dene (bekleme yok); veri varken üstte "Gösterilenler son bağlantıdan" bandı, bağlantı gelince kalkar (refetchOnReconnect). Bu ekrandaki sorgular çevrimdışıyken ikinci denemeyi yapmaz. Yükleme 6 sn'yi geçerse "Hâlâ bağlanıyor…" + yeniden dene.

**Menü (`/parent/menu`)** — sekmeler: **Aile** (çocuk ekle/düzenle, çocuk başına eğitim, arşiv, davet/aileler, Tehlikeli işlemler), **Cihazlar** (eşleme, bağlı cihazlar, aynı telefonda çocuk modu, veli PIN'i), **Öğrenme** (okul puanları, notlar, paylaşım), **Hesap** (Duyurular, Bildirim tercihleri, Paketler, hesap silme, çıkış), **Yardım** (yardım merkezi). Hiçbir giriş kaldırılmadı. Q00-A1-16: çocuk modu kartı tek yerde. Eski `?section=security` bağlantıları (çocuk modu "önce veli PIN'i") Cihazlar'ı PIN alanı en üstte açar.

## Testler (gerçekten çalıştırıldı)

```
pnpm --filter @gina/mobile exec tsc --noEmit      → çıkış 0
pnpm --filter @gina/mobile exec expo lint         → çıkış 0 (ilk koşuda react-hooks/set-state-in-effect 1 hata → düzeltildi)
pnpm --filter @gina/core test                     → 52 dosya, 365 test geçti (i18n eşliği dahil)
expo export -p web (yer tutucu kaynak http://127.0.0.1:65433) → başarılı
GINA_QA_UI_FIXTURE=<scratchpad>/u03/fixture-u03.json python3 scripts/test-isolated-services.py --run-local --ui-hold
                                                  → 140/140 servis kontrolü (iki koşu), cleanup: rest/auth konteyner ve geçici DB kaldırıldı
docs/release/u03-2026-11-06/ui/ui-check.cjs (Chrome, tr-TR, Europe/Istanbul) → 15/15 (temiz fixture'da final koşu)
```

İlk fixture koşusunda 8 kontrol geçtikten sonra betik hatası (gizli önceki ekrandaki aynı metin seçildi) → seçici `visible=true` ile düzeltildi; ikinci koşu 15/15. Fixture 45 dk tutma süresi dolup kendini temizledi; görüntü kaydırma ve menü ikonu düzeltmesinden sonra **yeni** fixture ve yeni export ile final koşu 15/15, ardından `SIGUSR2` ile bırakıldı. Başka ajanların `gina_http_*` konteynerlerine dokunulmadı.

[ui/ui-checks.json](ui/ui-checks.json) kontrolleri:
1. Çok çocuk (3) + çok iş (6 görev): 3 onay (2 + "Tüm onayları göster (3)"), onay → sıradaki iş → plan sırası; **geri gönderilmiş görev** sıradaki işte açıklamasıyla, listede planlıdan önce. Gerçek eşleşmiş cihaz `complete_task`, veli `review_task(false)`.
2. Bağlantı tekrarı: ayrı "Ödüller" kısayolu yok, "Ödülleri yönet" ×1, "Prova hazırla" ×1.
3. Seçili gün notu + iki "Sayılar bugüne ait" satırı; "Bugüne dön" ile kalkıyor.
4. Çocuk filtresi onayları kapsıyor.
5. 390×844 / 768×1024 / 1280×800 yatay taşma yok, çeviri anahtarı sızmıyor.
6. **Tek sorgu hatası:** `task_templates` REST 500 → "Görevler yüklenemedi." + "İlerleme bilgisi yüklenemedi."; onaylar ve plan görünür, "Bu ekran yüklenemedi" yok; kart içi "Yeniden dene" → liste geldi.
7. `events` REST 500 → yalnız plan kartı hata; görevler görünür.
8. Veri varken `setOffline(true)` → band; çevrimiçi → band kalktı.
9. Zil rozeti "3" ve etiket (**okunmamış sayısı taklit edildi**: `parent_inbox` yanıtı Playwright'ta sabitlendi, sentetik duyuru yazma yolu REST'te yok) → Duyurular → "Bildirim tercihleri" ekranı.
10. Menü: 5 sekme, çocuk modu kartı toplam 1, grup içerikleri, `?section=security` → Cihazlar seçili, PIN eşleme alanından önce; telefon/tablet/masaüstü.
11. Yavaş ilk yükleme (children 9 sn gecikme) → 6 sn'de "Hâlâ bağlanıyor…".
12. **Çevrimdışı ilk yükleme:** final koşuda 1399 ms'de "Çevrimdışısın" (önceki koşuda 4650 ms; ölçüm sayfa/oturum yüklemesini de içerir, eşik < 5 sn; önce ~20 sn). Yöntem: `navigator.onLine=false` + tüm REST `internetdisconnected` ile kesik (tarayıcı `setOffline` yeniden yüklemede uygulama dosyasını da kestiği için).
13. **0 çocuk:** gerçek yeni sentetik veli (`signup` + `create_family`) → tek eylem "Çocuk ekle"; sıradaki/kısayol yok.
14. **1 çocuk, 0 iş:** filtre yok, tek "İlk görevi ekle", ikinci "Görev ekle" yok.
15. Çalışma zamanı hatası yok.

Görüntüler [ui/](ui/): `home-many-{phone,tablet,desktop}`, `home-many-tasks-phone`, `home-selected-day-phone`, `home-tasks-error-phone`, `home-plan-error-phone`, `home-offline-cached-phone`, `home-offline-first-load-phone`, `home-slow-phone`, `home-bell-unread-phone`, `home-zero-children-{phone,desktop}`, `home-one-child-no-tasks{,-tasks}-phone`, `menu-{family,account,devices}-phone`, `menu-family-tablet`, `menu-learning-desktop`.

## A1 açık P2'ler

| Bulgu | Sonuç |
|---|---|
| Q00-A1-12 plan başlığı dil hatası | Düzeltildi (`betaUx.planTitle` TR değeri). |
| Q00-A1-13 çevrimdışı ilk yüklemede ~20 sn | Ana ekranda düzeltildi (1,4 sn'de durum; yavaşta 6 sn ipucu). Puanlar ekranı ve global `retry` bu paketin dışında. |
| Q00-A1-15 Tümü'nde çocuk blokları tekrarı | Takvimde (U05/takvim ajanı). Ana ekranda çocuk başına tekrar eden blok yok; ilerleme kartları tek satır/çocuk. Değişiklik yapılmadı. |
| Q00-A1-16 çocuk modu kartı iki sekmede | Düzeltildi (yalnız Cihazlar). |

## Kalan sınır

- Yalnız web exportu; gerçek iOS/Android cihaz, büyük yazı ve ekran okuyucu denenmedi. Native çevrimdışı algısı mevcut `app-lifecycle` (expo-network) üzerinden; cihazda doğrulanmadı.
- Okunmamış rozet sayısı yanıtı taklit edildi; gerçek duyuru/okundu akışı S02/B04 kabulünde.
- Onayla/geri gönder düğmeleri bu koşuda tıklanmadı (mevcut `review_task_once` akışı değişmedi; geri gönderme veri hazırlığında RPC ile yapıldı).
- Takvim ekranındaki "Tümü" tekrarı ve gün altı anlamları takvim ajanında. Global QueryClient `retry`, `useFamilyEvents` ve oturum katmanı dokunulmadı (sahiplik dışı); etkinlik sorgularının çevrimdışı ikinci denemesi bu yüzden duruyor ama ekran beklemiyor.
- `docs/CLAUDE-REMAINING-WORK.md` U03 kutusu kapatılmadı (sahiplik dışı; takvim kısmı ve cihaz kabulü açık).
