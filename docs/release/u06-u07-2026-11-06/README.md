# U06 çocuk ana akışları + U07 paylaşım/yardım/haftalık özet — 6 Kasım 2026

Dal: `worktree-agent-ae605ec8536393e57` (kaynak main `304f303`, ≥ `e4bc2dc`; çocuk yıldız bakiyesi `child_star_balance` RPC'si). Main'e push edilmedi, migration eklenmedi, üretime dokunulmadı, ücretli AI çağrısı yapılmadı, oda/3B görseli üretilmedi (sabit onaylı oda korunuyor). i18n'e yalnız yeni anahtar eklendi (TR/EN, 98 + 3 anahtar; mevcut anahtar silinmedi/değiştirilmedi).

Durum: **KOD HAZIR + web/izole serviste TEST EDİLDİ** · yayımlanmadı · fiziksel cihaz kabulü yok.

## Ne değişti

### U06 — çocuk
| Konu | Önce | Sonra | Dosya |
|---|---|---|---|
| Sıradaki adım | Görev → (bitince) Prova kartı; ödev hiç yoktu | Geri gönderilen görev → sıradaki görev → **ödev/çalışma** (`get_learning_plan`, bugüne kadar planlanmış, bitmemiş; teslim tarihi + adım sayısı, “Takvimimde aç”) → Prova (yeni birleşen kart korundu) → onay bekliyor/tamam | `components/room/child-home.tsx`, `components/child-home/day-extras.tsx` |
| Geri gönderilen görev | Yalnız “Geri gönderildi — tekrar dene!” etiketi; Haftam'da geçmiş gün de “tekrar dene” diyordu, kayıtsız geçmiş gün “Sırada” | Sıradaki adımda ve görev panelinde açıklama: velinin tekrar bakmasını istediği, ceza olmadığı, “tamamlanmadı” sayılmadığı, velinle konuşup yeniden gönderebileceği; düğmeler “Yeniden dene / Yeniden gönder”. Haftam'da bugün = tekrar dene + açıklama, geçmiş gün = “Geri gönderildi · velinle konuşabilirsin” (ayrı renk), kayıtsız geçmiş gün = “Kayıt yok”, bugün/gelecek = “Sırada”. **Sınır:** sunucu geri gönderme *nedenini* saklamıyor (`review_task` yalnız durum yazar); uygulama neden uydurmaz, çocuğu veliyle konuşmaya yönlendirir. | `child-home.tsx`, `app/child/week.tsx` |
| Çanta | Yalnız takvim ekranında | Dünyam'da “Çantam” Bugün/Yarın sekmesi (`get_school_bag`): dersler, hazır/hazır değil, “Çantamı takvimde aç”. Liste ve ders yoksa kart hiç gösterilmez (boş “görev” üretilmez). | `day-extras.tsx` |
| Hedef | Ödül listesi + “yıldızların şimdi harcanmaz” | Şu anki yıldız (sunucu bakiyesi), şu anki hedef, seçilenin özeti: bedel, kalan fark veya “yetiyor”, değiştirirken “yıldızların silinmez”. Derin bağlantıda `router.back()` yerine geçmiş yoksa Dünyam'a döner (Q00-A2-12). | `app/child/goal.tsx` |
| Koleksiyon | Ad + kazanıldı/kilitli | Her rozetin sunucu kuralından anlamı (ilk onaylı görev / N onaylı görev / bu simgeli görev N kez), kilitlide kişisel ilerleme çubuğu `x / N` (yalnız onaylı görevler, sunucudaki `award_badges_for_child` ile aynı sayım), kazanılanda tarih, “kimseyle yarış değildir”. Rozeti yine yalnız sunucu verir. | `app/child/collection.tsx`, `components/child-home/badge-progress.ts` |
| Oda tercihi | Kaydet → “Odan kaydedildi.” (sahne değişmediği halde) | “Tercihimi kaydet” → “Tercihin kaydedildi. Ana ekrandaki oda şimdilik aynı görünür.” | `app/child/room-preview.tsx` |
| Odak sayacı (mevcut sayaç denendi, yenisi kurulmadı) | **Kusur 1:** molada birincil düğme “Duraklat” molayı duraklatıyordu, “Molayı bitir” ikincildi. **Kusur 2:** panel kapatılınca süren/duraklatılmış sayacın ana ekranda hiçbir izi yoktu. | Molada birincil “Molayı bitir”, mola duraklatılmaz; ana ekranda “Odak sayacın açık ve sürüyor / duraklatıldı / süren tamamlandı” bağlantısı, dokununca sayacın görevini açar (aynı cihaz kaydını yalnız okur). Ara verme süreyi donduruyor, kapat/aç sayacı koruyor, “Sayacı bitir” görevi/yıldızı değiştirmiyor — denendi. | `components/tasks/task-focus.tsx`, `child-home.tsx` |

`/parent/child-mode/*` dosyaları çocuk ekranlarını yeniden dışa aktarıyor; değişiklik iki yolda aynı. `/child/index.tsx` değiştirilmedi. Çocuk Prova, takvim ve PIN ekranlarına dokunulmadı.

### U07 — veli (alt ajan işi, bu dalda `b55a824`)
- **Paylaşım** (`app/parent/share.tsx`): oluşturmadan önce “Alıcı şunları görecek” önizlemesi (kime, yalnız ilk ad + sınıf, seçili kapsamların sunucudaki gerçek ayrıntısı, gün ve yaklaşık bitiş tarihi, görünmeyecekler, iptal notu); eski paylaşımlarda arama + Tümü/Etkin/İptal-süresi dolan filtresi; iptal onayı korunur, iptal sonrası açık sonuç.
- **Paylaşılan görünüm** (`app/s/[token].tsx`): yalnız sunucunun `invalid_share` cevabı “bağlantı geçerli değil” gösterir; ağ/5xx/zaman aşımı “Rapora şu an ulaşamadık … iptal edildiği anlamına gelmez” + Yeniden dene; son yüklenen rapor geçici hatada korunur. Sunucu iptal/süre dolumu/hatalı ayrımını bilinçli yapmaz; istemci de ayırmaz.
- **Yardım** (`app/parent/help.tsx`): talep yazarken en çok 3 ilgili yayımlanmış yazı, çok kelimeli arama, sonuç yoksa “… için destek iste”; yeni talep taslağı (tür/konu/başlık/metin) kullanıcı+aile kapsamlı cihaz kaydında; ekrandan çıkıp dönünce geri gelir, gönderim/“Taslağı sil”/çıkışta silinir.
- **Haftalık özet** (`app/parent/weekly-review.tsx`): dönem, kapsam (çocuklar), sayılan kayıtlar ve saat dilimi kartı; AI özeti hazırsa öneriler seçilebilir ve düzenlenebilir liste, “Seçtiğim adımları kopyala”, “Görev olarak ekle”, “Takvimde bir zaman seç”. Hiçbir öneri kendiliğinden görev/takvim/yıldız olmaz; seçmeden geçilebilir.
- **Ses kaynakları**: gerçek eser adları ve lisans bağlantıları zaten vardı; değişiklik yok.

## Test (gerçekten çalıştırıldı)

- `pnpm --filter @gina/core test` → 52 dosya, 365 test geçti (i18n eklendikten sonra).
- `pnpm exec expo lint` (apps/mobile) → çıkış 0. Odak düzeltmesinden sonra değişen iki dosyada `eslint` → 0.
- `pnpm exec tsc --noEmit` → çıkış 0 (odak düzeltmesinden sonra, son kod üzerinde).
- İzole servis: `GINA_QA_UI_FIXTURE=<scratchpad>/u0607-fixture.json python3 scripts/test-isolated-services.py --run-local --with-realtime --ui-hold` (benzersiz fixture yolu, rastgele `gina_http_<hex>_audit` DB, rastgele portlar). Koşu 1: 149/149 sözleşme kontrolü, temizlik `realtime/rest/auth/disposable_database_removed: true`. Koşu 2 (son testler): 149/149, temizlik aynı şekilde dört alan `true` (UI bitince SIGUSR2 ile erken bırakıldı). Kendi statik sunucu ve köprü süreçleri kapatıldı; `docker ps`'te bu koşulardan kalan container yok.
- Web: `expo export -p web` (bu worktree) sabit yerel köprü adresine (`127.0.0.1:8464`) derlendi; köprü güncel geçici fixture'a iletip yer tutucu anon anahtarını değiştirir (yalnız loopback). Statik sunucu `127.0.0.1:8463`. Playwright (playwright-core 1.57, sistem Chrome, `tr-TR`, `Europe/Istanbul`).
- Ölçüler: 390×844, 844×390, 768×1024, 1024×768. Her görüntüde yatay taşma ve çözülmemiş i18n anahtarı denetlendi.
- Sonuç dosyaları: `ui-checks-child.json`, `ui-checks-parent.json` (bu klasörde).

Son koşu (odak düzeltmesi dahil son export): **çocuk 45/45, veli 23/23 kontrol geçti**, `pageerror` yok, hiçbir görüntüde taşma veya ham anahtar yok. Ara koşularda yakalanan: (1) izole DB'de rozet tanımı yoktu → sentetik tohum eklendi; (2) hedef farkı beklentisi test hatasıydı (sunucu bakiyesinden hesaplanacak şekilde düzeltildi; ekran doğruydu); (3) odak sayacı kusurları önce görüntülendi, sonra düzeltildi; (4) aynı DB'de ikinci koşuda oda tercihi zaten kayıtlıydı (kaydet pasif — doğru davranış), test farklı seçenek seçecek şekilde düzeltildi. `help_related_faq_NOT_OBSERVED…` kontrolü bilerek “görülmedi” adını taşır, kanıt değildir. Ek: paylaşım önizlemesinde veli ekranı kardeş profili (“Synthetic”) seçili açıldı; önizleme o çocuğun adını doğru gösterdi.

Sentetik veri: fixture çocuğu “Ece” adlandırıldı; 3 görev (biri onaylı, biri geri gönderilmiş, biri sırada), 2 ödül, 1 ödev (`gina.learning_plan`), bugün/yarın çanta satırları ve izole DB'de boş olan rozet tanımları (migration'daki aynı tohum değerleriyle) yalnız bu geçici DB'ye yazıldı.

## Görüntüler

Çocuk (veli telefonunda çocuk modu, `/parent/child-mode/*`, PIN ile):
- Geri gönderilen görev sıradaki adım: `child-returned-next-phone.png`, `…-phoneLand.png`, `…-tablet.png`, `…-tabletLand.png`; görev paneli `child-task-sheet-returned-phone.png`; Haftam `child-week-returned-phone.png`, `…-tablet.png`.
- Çanta: `child-bag-today-phone.png`, `child-bag-tomorrow-phone.png`.
- Ödev sıradaki adım: `child-next-homework-phone.png`, `…-tablet-land.png`.
- Hedef: `child-goal-phone.png`, `child-goal-selected-phone.png`, `…-tablet-land.png`, değiştirme `child-goal-change-phone.png`.
- Koleksiyon sıfır/dolu: `child-collection-zero-phone.png`, `…-tablet-land.png`, `child-collection-full-phone.png`, `…-tablet.png`.
- Oda tercihi: `child-room-pref-saved-phone.png`.
- Odak sayacı: çalışıyor `child-focus-running-phone.png`, ara `child-focus-paused-phone.png`, mola önce `before-child-focus-break-phone.png` → sonra `child-focus-break-phone.png`, moladan dönüş `child-focus-after-break-phone.png`, panel kapalı ana ekran önce `before-child-focus-closed-home-phone.png` → sonra `child-focus-closed-home-phone.png`, yeniden açılış `child-focus-reopened-phone.png`, bitirme `child-focus-ended-phone.png`.

Veli:
- Paylaşım önizleme: `parent-share-preview-phone.png`, `…-phoneLand.png`, `…-tablet.png`, `…-tabletLand.png`; arama `parent-share-search-phone.png`; iptal `parent-share-revoked-phone.png`.
- Alıcı görünümü: `share-viewer-phone.png`; ağ kesintisi `share-viewer-network-phone.png`; iptal sonrası `share-viewer-revoked-phone.png`.
- Yardım taslağı: `parent-help-draft-phone.png`, geri dönünce `parent-help-draft-restored-phone.png`, `…-tablet-land.png`.
- Haftalık özet kapsamı: `parent-weekly-scope-phone.png`, `…-tablet.png`.

## Kalan sınır (yapılmadı / görülmedi)

- Geri gönderme **nedeni** sunucuda yok; göstermek migration gerektirir (bu işte yasak). Şimdilik dürüst yönlendirme.
- Haftalık özette seçilen adım görev ekranına **ön-doldurulmuyor**: `components/tasks/tasks-screen.tsx` başlık parametresi almıyor ve özet çocuk kimliği döndürmüyor; veli kopyalayıp yapıştırır. AI özetinin “hazır” durumu (seçilebilir liste) ücretli üretim olmadan oluşmadığı için **ekranda görülmedi**; yalnız kapsam kartı görüldü.
- Yardımda “ilgili SSS” paneli izole DB'de yayımlanmış yazı olmadığı için **görülmedi**; kişisel verisi gizlenmiş görsel ekleme ve destek yanıt takibi (B04) bu işte yapılmadı.
- Paylaşım önizlemesindeki bitiş tarihi yaklaşık (sunucu oluşturma anından hesaplar).
- Çocuk ekranları veli telefonundaki çocuk modunda denendi; eşleşmiş çocuk cihazı (device JWT) yolunda bu koşuda yeniden çalıştırılmadı (aynı bileşenler). İzinli profil yok/tek/çok seçici bu işte değişmedi, yeniden denenmedi.
- Fiziksel iPhone/iPad/Android, VoiceOver/TalkBack, sistem büyük yazı ve gerçek uygulama arka plan/ön plan geçişiyle odak sayacı denenmedi (web `visibilitychange` yolu dışında).
- Koleksiyonda dar telefonda “bu simgeli görev” satırında simge metni sıkıştırıyor (okunur, kırpılmıyor); görsel ince ayar yapılmadı.
