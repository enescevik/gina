# Q00 ekran inceleme matrisi — A2: çocuk, veli telefonunda çocuk modu ve veli Prova zinciri

Tarih: 2026-11-06 gecesi · Kaynak commit: main `de969c1` · Dal: `worktree-agent-a3867b32c54c7c27e` · Model: Claude Fable 5.1 (otonom gece ajanı A2).

## Yöntem ve ortam

- **Gerçek uygulama, sentetik veri:** `scripts/test-isolated-services.py --run-local --with-realtime --ui-hold` ile tek kullanımlık boş DB klonu üzerinde gerçek GoTrue + PostgREST + Realtime (`gina_http_3341c7285ea63cad_audit`). Üretim/yerel demo DB'ye, `.codex-setup/`'a dokunulmadı; migration eklenmedi.
- **Web dışa aktarımı:** `expo export -p web` (bu worktree'nin kaynağı) sabit yer tutucu kaynağa (`http://127.0.0.1:65000`) karşı derlendi; 65000 portundaki yerel köprü, yer tutucu anon anahtarını fixture'ın gerçek anon anahtarıyla değiştirip isteği gerçek servislere iletti (CORS + WebSocket dahil). Statik SPA sunucusu 8291 portunda. Aynı session'daki diğer ajanlar ortak scratchpad'deki ilk `web-dist`'i sildiği için A2 kendi `a2q/` dizinine taşındı; o ana kadarki ekranlar yeniden çalıştırılarak doğrulandı.
- **Sürücü:** Playwright (`playwright-core` 1.57 + sistem Chrome 156, headless), dokunmatik emülasyonlu bağlamlar. Ölçüler: telefon dikey 390×844, telefon yatay 844×390, tablet dikey 768×1024, tablet yatay 1280×800. Çocuk cihazı için `/device/pair` ekranından gerçek eşleştirme kodu alınıp veli RPC'siyle (`pair_child_device`, `configure_child_device`) eşlendi; çocuk PIN'i gerçek `child_pin_login` ile girildi.
- **AI uçları:** gerçek ücretli üretim yapılmadı. İzole servis Edge fonksiyonu olmadan çalıştığı için AI puanlama/plan/üretim düğmeleri "servis yok" hata durumuyla incelendi (deterministik sağlayıcı bu oturumda bağlanmadı; bkz. kalan sınır).
- **Kanıt:** `docs/release/experience-review/a2/*.png`; önce/sonra adları `after-*` ile ayrıldı. Otomatik kontroller her görüntüde yatay taşma (`scrollWidth ≤ innerWidth`) ve çözülmemiş i18n anahtarı aradı; hiçbir ekranda taşma veya ham anahtar görülmedi. Hiçbir çalıştırmada `pageerror` oluşmadı.
- **Uyarı:** psikoloji/pedagoji/eğitmen satırları ürün ilkelerine göre yapılmış tasarım değerlendirmesidir; gerçek uzman incelemesi veya çocuk kullanıcı araştırması değildir.

Bakış açısı kısaltmaları: **PS** psikoloji · **PD** pedagoji/çocuk gelişimi · **EĞ** eğitmen/ölçme · **UX** bilgi mimarisi · **GÖ** görsel/etkileşim · **MİM** mimari/güvenlik · **ER** erişilebilirlik. "—" = bu bakış açısında sorun görülmedi (gerekçe satırda).

## Özet

| Ölçüt | Sayı |
|---|---|
| İncelenen ekran/alt akış birimi | 41 |
| GÖRÜLEMEDİ / kısmen görüldü | 8 |
| P0 | 1 (sunucu kuralı, migration gerekir — karar) |
| P1 | 4 (3'ü bu dalda düzeltildi, 1'i sunucu kuralı — karar) |
| P2 | 10 (1'i düzeltildi, diğerleri mevcut U/P işlerine bağlandı) |

Düzeltilenler: Q00-A2-3 defter telefon yatay, Q00-A2-4 görevler bitti ama Prova bekliyor, Q00-A2-5 seviye tespiti derin bağlantıda sessiz atama, Q00-A2-7 sonuç ekranı düğme hiyerarşisi.

Commit'ler (bu dalda, main'e push edilmedi): `14786ab` fix(notebook) kısa yatayda kâğıt görünür · `88053ec` fix(child-home) bekleyen Prova sıradaki adım · `9ea1f41` fix(prova) seviye tespiti derin bağlantı + AI düğmesi ikincil · `93af73d` fix(notebook) kompakt başlık/sekme/alt bar · `619b00b` fix(child-home) Prova kartı "tamam" kartının yerine geçer · docs commit'i bu matris ve görüntüler.

## Yeni bulgular (kimlikler)

| ID | Öncelik | Bulgu | Durum |
|---|---|---|---|
| Q00-A2-1 | **P0** | **Yalnız çizimle (defter mürekkebi) verilen açık uçlu cevap sunucuda boş sayılıp 0 puanla "puanlandı" kabul ediliyor.** `gina.recompute_attempt_totals` (`20261030080000_prova_ai.sql`) yalnız `answer_text`'e bakıyor; `answer_document` dolu olsa da `trim(answer_text)=''` → 0. Kanıt: çocuk Q1'e yalnız çizim yaptı, Q2 boş → deneme `graded|open_total 2|open_graded 2|score_pct 0` (`a2/child-notebook-ink-only-result-tablet.png`, DB satırı `919fda86…|''|document=true|score=null`), veli özeti "Puan: 0 / 100 · Açık uçlu: 2 / 2 puanlandı" (`a2/parent-attempt-ink-only-tablet-land.png`) ve "İncelemeni bekliyor" listesine düşmüyor. Çocuk sonuç ekranı ise "Açık uçlu cevaplarını ebeveynin inceleyecek" diyor → iki taraf çelişiyor. | **Karar gerekir + migration:** `recompute_attempt_totals` içinde `answer_document` boş değilse (ör. `notebookHasAnswer` eşdeğeri: en az bir eleman) cevabı "puan bekliyor" (`null`) saymalı. Bu worktree migration ekleyemediği için düzeltilmedi; sınav kanıtı değişmez, yalnız toplam yeniden hesaplanır. Düzeltilene kadar veli "0 / 100" sonucunu kesin sanmamalı. |
| Q00-A2-2 | **P1** | Hiç cevaplanmamış açık uçlu sorular finish anında otomatik 0 alıp deneme "graded" oluyor; çocuk listesi "Çoktan seçmeli: 1 / 1 doğru" dışında hiçbir not göstermiyor (`a2/child-prova-list-after-tablet.png`, "Fen – Işık (süreli)" kartı), veli hub'ı "Puanlandı" diyor. P04 kabulü "eksik puan ara sonuç, sıfır değil" ile çelişir; boş cevabın 0 sayılması bilinçli bir yorum (migration yorumu) olduğu için **ürün kararı**. | Karar gerekir. Öneri: boş açık uçlu = "cevap yok" durumu, puan `null`; veli incelemesinde tek dokunuşla 0 verilebilir. Q00-A2-1 ile aynı fonksiyonda çözülür. |
| Q00-A2-3 | **P1** | Telefon yatayda (844×390) çözüm defteri tamamen görünmez: başlık + sekmeler + "Soruyu göster" şeridi + araç çubuğu + sayfa gezinme + alt bar tüm yüksekliği yiyor, kâğıt 0 px (`a2/child-notebook-phone-land.png`). P03 kabulü "dikey tablette defter görünür" karşılanıyor ama telefon yatay kullanılamıyor. | **Düzeltildi:** `notebook-workspace.tsx` kısa pencerede (`height < 520`) sekmeli düzende bağlam şeridini kaldırıyor (soru zaten "Soru" sekmesinde), `notebook-editor.tsx` `compact` ile sayfa yukarı/aşağı şeridini gizliyor (el aracıyla kaydırma sürüyor); başlık/sekme/kâğıt/alt bar boşlukları kısa pencerede daraltıldı. Ölçüm (844×390): görünür kâğıt yüksekliği 0 px → 141 px; dikey telefon 409 px, tablet yatay 453 px değişmedi; yatayda çizilen çizgi sunucuya kaydedildi (`answer_document` dolu). Sonra: `a2/after-child-notebook-phone-land.png`, çizim kaydı `a2/after-child-notebook-phone-land-stroke.png`, kontrol `a2/after-child-notebook-phone-portrait.png`, `…-tablet-land.png`, `…-tablet.png`. |
| Q00-A2-4 | **P1** | Görevler bitince "Sıradaki adımım" kartı "Bugünkü adımların tamam! … Yarın yeni bir gün." diyor; o sırada atanmış Prova varken (alt barda "Prova (1)") bütün gün tamam sanılır (`a2/child-today-alldone-phone.png`, `…-tablet.png`). U06 kabulüyle doğrudan çelişir. | **Düzeltildi:** `child-home.tsx` bekleyen Prova sayısı > 0 iken sakin bir "Seni bekleyen N Prova var … acele etmene gerek yok" kartı ve "Prova'ya git" eylemi gösteriyor; "Koleksiyonu keşfet" yalnız gerçekten hiçbir iş yokken. Yeni anahtarlar `childMint.provaWaiting*` (tr/en). Onay bekleyen görev varken "onayda" kartı korunur. Sonra: `a2/after-child-today-alldone-prova-phone.png`, `…-tablet-land.png` ("Seni bekleyen 2 Prova var … Prova'ya git" → `/child/prova`). |
| Q00-A2-5 | **P1** | Seviye tespiti "Oluştur ve ata" başarıyla sınav oluşturup çocuğa atıyor (DB: `Fen · Seviye tespiti|assigned`) ama ekran derin bağlantıdan açıldığında (`router.back()` için geçmiş yok) formda hiçbir şey olmamış gibi kalıyor (`a2/parent-level-created-phone.png`); ikinci dokunuş ikinci sınav atar. | **Düzeltildi:** `level.tsx` `router.canGoBack() ? back() : replace('/parent/prova')`. Sonra: `a2/after-parent-level-created-phone.png`. Hub'da atanan sınav görünüyor. |
| Q00-A2-6 | P2 | Aynı çocuk PIN işi iki farklı kontrol öğretiyor: çocuk cihazında 4 kutu + kilit simgesi (`a2/child-pin-tablet.png`), veli telefonunda çocuk modunda düz metin alanı (`a2/childmode-entry-pin-phone.png`). | U02'ye bağlandı (inventory satırı "bütün PIN ekranlarında aynı kontrol"). |
| Q00-A2-7 | P2 | Sonuç özetinde "Yapay zekâyla puanla" ile "Çözümleri incele" iki birincil (mor) düğme olarak alt alta; hangisi ana iş belirsiz (`a2/parent-attempt-phone.png`). | **Düzeltildi (kısmi):** AI düğmesi ikincil stile alındı; tek "İncelemeyi tamamla" birleştirmesi P04 kapsamında kalıyor. Sonra: `a2/after-parent-attempt-phone.png`. |
| Q00-A2-8 | P2 | Hub'da aynı deneme hem "İncelemeni bekliyor" listesinde hem "Çocuğuna gönderilenler" kartında "İncele" ile tekrar ediyor (`a2/parent-prova-hub-phone.png`). | P01 mevcut satır ("aynı sınavın tekrar kartlarını azalt"). |
| Q00-A2-9 | P2 | Kontrol adımında "1 / 10 soru hazır — Soru sayısı hedefinle aynı olmalı" diye gönderim kilitleniyor; veli hedefi değiştirmek için iki adım geri gitmek zorunda (`a2/parent-builder-step3-phone.png`). | P01: kontrol adımında "hedefi 1 yap" kısa yolu veya hedefi otomatik düşürme önerisi. |
| Q00-A2-10 | P2 | İnceleme çalışma alanında "Çizimli not ekle" düz metin gibi duruyor, düğme hissi yok; tablet yatayda sol panelin yarısı boş (`a2/parent-review-tablet-land.png`). | P04. |
| Q00-A2-11 | P2 | Çocuk takviminde boş gün kopyası "Ders programına bakabilir, derslerini düzenleyebilirsin." — çocuk ders programını düzenleyemez; dil yanlış beklenti kurar (`a2/child-calendar-phone.png`). | U06 metin düzeltmesi (planner bileşeni paylaşılan olduğu için bu dalda dokunulmadı). |
| Q00-A2-12 | P2 | Hedef seçimi ve oda kaydı `router.back()` ile dönüyor; derin bağlantıda (web paylaşım/yenileme) geçmiş yoksa sayfada kalıyor (`goal` adımı url'si `/child/goal`). Cihazda push ile gelindiği için görünmüyor. | U06; Q00-A2-5 ile aynı kalıp (`canGoBack`). |
| Q00-A2-13 | P2 | AI puanlama/plan servisleri yokken mesaj "Bir şeyler ters gitti; biraz sonra tekrar dene." — geçici servis hatası ile paket/izin durumu ayrılmıyor (`a2/parent-attempt-ai-grade-phone.png`). | U08 (izin reddi/çevrimdışı/geçici hata ayrımı). |

## Matris — çocuk cihazı (`/child/*`)

Rol: eşlenmiş çocuk cihazı (device JWT). Ölçüler: aksi yazılmadıkça tablet dikey + telefon dikey; yatay ölçüler ilgili satırda.

### `/child` — "Kim giriyor?" (izinli profil yok / tek / çok)
- **Senaryo:** cihaz eşlendi ama veli henüz çocuk seçmedi → "Cihazın bağlandı. Velin bu cihazı kullanabilecek çocukları seçtiğinde profiller burada görünecek." (5 sn'de bir yeniler); tek profil; iki profil (PIN'li). Telefon yatayda kartlar iki sütun (`a2/child-picker-none-tablet.png`, `…-single-tablet.png`, `…-multi-tablet.png`, `…-multi-phone.png`, `…-multi-phone-land.png`).
- PS: bekleme nedeni ve kimin ne yapacağı açık; suçlayıcı dil yok. PD: tek profil için gereksiz seçim yok ama tek profilde de karta dokunma gerekiyor (kabul edilebilir; otomatik giriş PIN politikasını atlar). EĞ: uygulanmaz. UX: "Yeniden dene" yalnız hata durumunda; bekleme durumunda sessiz yenileme yeterli. GÖ: onaylı krem/mor, 176 dp kart. MİM: `configure_child_device` boş liste ve PIN'siz çocuk için sunucuda reddediyor (`invalid_device_config`, `child_pin_required`) — sınır sunucuda. ER: kartlar `button`, metin 15–20 sp; sorun yok.
- Öncelik: — · İş: U02 · Test: 3 durum + 3 ölçü · Sınır: gerçek tablette OS klavyesi/dokunma denenmedi.

### `/child/pin`
- **Senaryo:** yanlış PIN (0000) → "PIN doğru değil. Tekrar deneyin…" sakin, kutular temizleniyor; "PIN'imi hatırlamıyorum" → yetişkin yardım kartı; "Vazgeç" (`a2/child-pin-tablet.png`, `…-wrong-tablet.png`, `…-help-tablet.png`, `…-help-phone.png`).
- PS: utandırma yok, yardım yolu var. PD: 4 kutu + büyük düğme uygun. UX: geri oku "Dünyam"a gidiyor ama oturum yokken `/child`'a düşüyor (doğru). GÖ: onaylı. MİM: `child_pin_login` sunucuda; yanlış PIN istemcide sayılmıyor (kilitlenme politikası U02'de). ER: `PinEntry` gizli giriş — ekran okuyucu etiketi "Çocuk PIN'i" var; sayısal klavye OS'a bağlı.
- Bulgu: Q00-A2-6 (çocuk modu ile farklı kontrol) · P2 · U02.

### `/child/today` — Dünyam (4 ölçü, görev var / tamam / Prova bekliyor / hata)
- **Senaryo:** 3 görev (1 onaylı, 2 sırada) → "Sıradaki adımım: Kitap oku +2 yıldız, Başla"; görevler tamamlanıp onaylanınca "Bugünkü adımların tamam!"; alt barda "Prova (2)". Ölçüler: `a2/child-today-phone.png`, `…-phoneLand.png`, `…-tablet.png`, `…-tabletLand.png`; tamam durumu `a2/child-today-alldone-phone.png`, `…-tablet.png`.
- PS: tek sıradaki adım, yumuşak dil ("Emeğinin tadını çıkar"). **PD/EĞ: görevler bitince bekleyen Prova sıradaki adım olarak gösterilmiyordu → Q00-A2-4 (düzeltildi).** UX: Haftalık ilerleme/Takvim/hedef tek panelde, tekrar yok. GÖ: sabit onaylı oda, 3B yok; telefon yatayda sahne solda panel sağda, alt bar 48 dp. MİM: yıldız/hedef/sınav sayıları ayrı sorgular, hata durumunda "—" ve yeniden dene. ER: ilerleme çubuğu `progressbar`, durum kartları `accessibilityLabel`, 48 dp hedefler.
- Öncelik: P1 (düzeltildi) · İş: U06 · Test: sonra `a2/after-child-today-alldone-prova-phone.png`, `…-tablet-land.png`; "Prova'ya git" `/child/prova`'ya götürdü · Sınır: ağ hatası durumu yalnız kodda (ErrorText + yeniden dene) görüldü, çalıştırılmadı.

### Görev paneli (modal) ve odak modu
- **Senaryo:** "Görevler" → "Bugünkü görevlerim" listesi; "Yaptım" → "Onay bekliyor"; "Bu göreve odaklan" → "Odak süresi seç" + tek görev (`a2/child-task-sheet-tablet.png`, `…-phone.png`, `…-after-done-phone.png`, `a2/child-task-focus-tablet.png`).
- PS: "Hazır olduğunda başlayabilirsin." baskısız. PD: sayaç isteğe bağlı, görev tamamlama sayaca bağlı değil (kural korunuyor). UX: kapatma 48 dp, tek birincil eylem. MİM: `complete_task` idempotent (fixture testinde doğrulanmış). ER: modal `accessibilityViewIsModal`, durum `liveRegion`.
- Öncelik: — · Sınır: odak sayacının ara verme/çıkış davranışı (U06 "mevcut sayacı dene") süre seçilmeden ileri gidilmedi → **kısmen görüldü**.

### `/child/week` — Haftam
- Kanıt: `a2/child-week-tablet.png`, `…-phone.png`. Gün şeridi 48 dp, durum rozetleri "Onaylandı / Sırada / Onay bekliyor".
- PS/PD: "Tamamlanmadı" etiketi yalnız geçmiş günlerde; bugün "Sırada" — doğru. EĞ: uygulanmaz. UX: tek gün görünümü, kişi filtresi yok. GÖ: onaylı. ER: sorun yok.
- Sınır: **geri gönderilmiş görev nedeni ve "paused" durumu** bu veride oluşturulmadı → o satır GÖRÜLEMEDİ (kodda `child.returnedTryAgain` / `routine.pausedWork` ayrımı var).

### `/child/calendar` — Takvimim
- Kanıt: `a2/child-calendar-tablet.png`, `…-phone.png`. Takvim/Ders programı sekmeleri, çanta listesi, ödev/çalışmalar bölümü.
- UX: çocuk ekranında kişi filtresi yok (doğru). **Metin:** "derslerini düzenleyebilirsin" çocuğa düzenleme vadediyor → Q00-A2-11 P2. Diğer bakış açılarında sorun görülmedi; dolu program/çanta verisi yok → **kısmen görüldü** (U05 verisi başka ajanda).

### `/child/collection` — Koleksiyonum (sıfır / dolu)
- Kanıt: sıfır `a2/child-collection-tablet.png`, `…-phone.png`; dolu (5 tanım, 1 kazanılmış) çocuk modunda `a2/childmode-collection-phone.png`.
- PS: "İlk rozetine doğru" + kazanma koşulunu anlatan kısa metin; kilitli rozetler %50 saydam, 4 kilit kabul edilebilir "duvar" değil. PD: rozet adı var ama **kazanma koşulu kartta yok** (U06 açık satırı; P2, mevcut iş). GÖ: iki sütun, büyük yazıda tek sütun. ER: kart `accessibilityLabel` "ad: kazanıldı/kilitli".

### `/child/goal` — Hedefini seç
- Kanıt: `a2/child-goal-tablet.png`, `…-selected-tablet.png`. "Yıldızların şimdi harcanmaz" açık; seçince "Bu benim hedefim olsun!"; Dünyam'da "Yeni kitap 2 / 8 yıldız · 6 yıldız kaldı".
- PS/PD: tek adım onay, geri dönülebilir. MİM: `set_child_goal` sunucuda. Bulgu: Q00-A2-12 (derin bağlantıda `back`) P2.

### `/child/room-preview` — Odamı düzenle
- Kanıt: `a2/child-room-preview-tablet.png`, `…-pet-saved-tablet.png`, `…-phone.png`. "Bu sürümde odada Gina maskotu yer alıyor… şimdilik ana ekranın görünümünü değiştirmez." dürüst; Dostum sekmesinde köpek seçimi kaydedildi "Odan kaydedildi.".
- UX/GÖ: sahneyi değiştirmeyen tercihler özelleştirme gibi sunulmuyor (U06 kabulü). ER: `tablist`/`radiogroup`.

### `/child/prova` — Prova listesi
- Kanıt: `a2/child-prova-list-tablet.png`, `…-phone.png`, `…-tablet-land.png`, devam durumu `a2/child-prova-list-resume-tablet.png`, sonrası `a2/child-prova-list-after-tablet.png`.
- EĞ: karma sınavda "Çoktan seçmeli: 1/1 doğru + Açık uçlu cevaplarını ebeveynin inceleyecek" doğru; **ancak sunucu boş/çizimli cevapları 0 ile kapatınca bu not kayboluyor → Q00-A2-1/2.** UX: "Başla/Devam" ayrımı, soru sayısı ve süre kartta. PD: "Seni bekleyen denemeler" baskısız. ER: kart etiketi "başlık, N soru, süre" + ipucu.

### `/child/prova/[examId]` — şıklı soru, süreli
- Kanıt: `a2/child-exam-mc-tablet.png`, `…-phone.png`, `…-selected-tablet.png`; süre "⏱ 9:53" sağ üstte, son 5 dk'da ekran okuyucu duyurusu (kod).
- MİM: `get_attempt_questions` yükünde `correct_key/expected_answer` yok (HTML'de arandı, `leak:false`). PS: "Cevapların kaydedildi." canlı bölge. ER: şıklar `radio`, 56 dp.
- Sınır: süre dolması (10 dk) beklenmedi → otomatik bitirme yalnız kodda.

### `/child/prova/[examId]` — çözüm defteri (açık uçlu)
- Kanıt: tablet dikey `a2/child-notebook-tablet.png`; telefon dikey sekmeli `a2/child-notebook-phone.png`, `…-phone-notebook-tab.png`; **telefon yatay `a2/child-notebook-phone-land.png` (kâğıt yok → Q00-A2-3)**; tablet yatay yan yana `a2/child-notebook-tablet-land.png`; çizim `a2/child-notebook-stroke-tablet.png`; yazı/sembol iletişim `a2/child-notebook-text-tablet.png`, `…-symbols-tablet.png`; diğer araçlar `a2/child-notebook-more-tools-tablet.png`; bitirme onayı `a2/child-notebook-finish-confirm-tablet.png`; süreli çıkış `a2/child-exam-timed-leave-tablet.png`; devam `a2/child-notebook-resumed-tablet.png`.
- **Çizimde scroll:** fare ile 25 noktalı çizgi çizilirken `window.scrollY` ve tüm kaydırma konteynerleri 0'da kaldı (`before/after tops: []`); sayfa yalnız "el" aracında kaydırılıyor (`scrollEnabled={tool==='hand'}`), çizim yüzeyi `onResponderTerminationRequest=false`. Gerçek dokunmatik tabletteki tarayıcı kaydırması bu ortamda emüle edilemedi → **fiziksel kabul kalan sınır** (P03/Q01).
- **Yön döngüsü:** telefon dikey↔yatay ve tablet dikey↔yatay geçişlerinde düzen `notebookLayout` ile pencereye göre seçiliyor, cihaz döndürme isteği yok; geçişte çizim/taslak korunuyor (aynı `questionId` key).
- **Klavye:** "Yazı" aracı modal + çok satırlı alan + 24 sembol; "Deftere yerleştir" boş metinde devre dışı. Yatayda modal sığıyor.
- **Taslak kurtarma:** "Ara ver" → listede "Devam" → aynı sınav açılınca Q1 ve "Kaydedildi" ile dönüldü; cevap başka soruya taşınmadı (`answer_document` yalnız Q1 satırında). İki cihaz: veli telefonunda çocuk modu aynı anda açıldığında atanmış sınav kalmadığı için **çalıştırılamadı** (GÖRÜLEMEDİ).
- **Süreli çıkış:** "Çalışmadan çıkılsın mı? Bu çalışma süreli. Çıksan da süre işlemeye devam eder…" + "Burada kal" birincil — doğru öncelik. Süresiz denemede dirty değilken uyarısız çıkış (kaydedilmiş) — doğru.
- **Bitirme:** "2 sorunun 1 tanesini yanıtladın. 1 soru boş kaldı… Boş soruya git / Cevaplarımı gönder / Kontrol etmeye dön" — bilinçli teslim.
- PS: "İstersen çizerek anlat." baskısız. PD: araç rehberliği ilk kullanımda yok (P03 açık satırı; "Diğer araçlar" ipucu metni var). EĞ: soru + ortak kaynak + "Deftere al" birlikte. GÖ: onaylı defter kimliği. MİM: `submit_exam_answer_v3` revizyonlu, çakışmada "sunucudaki cevabı kullan" akışı kodda. ER: araçlar 48 dp, `tab`/`button` rolleri, durum `liveRegion`.
- Öncelik: P1 (Q00-A2-3 düzeltildi) · İş: P03 · Sonra: `a2/after-child-notebook-phone-land.png` (kâğıt görünür), `…-stroke.png`, portre/tablet kontrol `a2/after-child-notebook-phone-portrait.png`, `…-tablet-land.png`, `…-tablet.png`.

### Sonuç ekranı ve veli geri bildirimi
- Kanıt: `a2/child-exam-result-tablet.png`, `…-phone.png`; çizimli sonuç `a2/child-notebook-ink-only-result-tablet.png`; geri bildirim açık `a2/child-feedback-tablet.png`.
- PS: "Deneme bitti! Çabanı tamamladın. Şimdi küçük bir mola verebilirsin." puan yargısı yok. EĞ: şıklı sonuç + "ebeveynin inceleyecek" ayrı; veli notu ve çizimli notlar çocuğun kendi defteri üzerine bindirilerek gösteriliyor. **MİM: geri bildirim yükünde beklenen cevap/çözüm yok (HTML araması `leak:false`); "2 × (8 + 6) = 28 metre" metni çocuğun kendi cevabı.** Bulgu: sunucu otomatik 0 (Q00-A2-1/2) ile bu ekranın "inceleyecek" cümlesi çelişiyor.

### Ebeveyn çıkışı (kilit)
- Kanıt: `a2/child-after-parent-exit-tablet.png`, `a2/child-today-after-exit-direct-tablet.png`. Kilit simgesi → `child_logout` → `/child`; adres çubuğundan `/child/today` → `/child`'a düşüyor (claims'te `child_id` yok). Dönüş döngüsü yok.

## Matris — veli telefonunda çocuk modu (`/parent/child-mode/*`, telefon dikey; bazı satırlarda tablet)

### `/parent/child-mode` — giriş
- Kanıt: `a2/childmode-entry-phone.png`, `…-entry-pin-phone.png`, `…-entry-wrong-pin-phone.png`, `…-entry-wrong-pin-tablet.png`. "Telefonunuzu çocuğunuza verecekseniz eşleştirme gerekmez…" ilk kullanım açıklaması; çocuk seç → "Hangi kodu girmeliyim?" yardım kartı; yanlış PIN sakin mesaj.
- UX: eşleme ile çocuk modu ayrımı anlatılıyor (U02 kabulü). Bulgu: Q00-A2-6 (düz metin alanı, çocuk cihazındaki 4 kutudan farklı) P2. **GÖRÜLEMEDİ:** veli PIN'i tanımsız durumu (`parent_pin_set=false` kartı) — sentetik veride PIN'i geçici kaldırmak için kolon adı bilinmediğinden denenmedi; tek çocuklu kısa yol — kardeşi arşivlemek `child_archive_use_action` koruması tarafından reddedildi (doğru sunucu davranışı), o yüzden görülmedi.

### `/parent/child-mode/today` ve kilit
- Kanıt: 4 ölçü `a2/childmode-today-phone.png`, `…-phoneLand.png`, `…-tablet.png`, `…-tabletLand.png`; kilit `a2/childmode-lock-parent-url-phone.png`, `…-menu-url-phone.png`, `…-prova-url-phone.png`.
- MİM: `/parent`, `/parent/menu`, `/parent/prova` ve sayfa yenileme → hepsi `/parent/child-mode/today`'e döndü (layout yönlendirmesi + kalıcı kilit). Çocuk görünümü cihazdakiyle aynı bileşen; "Ebeveyn" düğmesi PIN istiyor.

### Çıkış: yanlış PIN / unuttum / doğru PIN
- Kanıt: `a2/childmode-exit-prompt-phone.png`, `…-exit-wrong-phone.png`, `…-exit-forgot-phone.png`, `…-exit-forgot-tablet.png`, `…-exit-cancel-phone.png`, `…-after-exit-phone.png`.
- PS: "Buraya çocuk PIN'i veya eşleştirme kodu yazılmaz." karışıklığı önlüyor. MİM: unuttum → hesap şifresiyle yeniden doğrulama (sosyal hesapta e-posta doğrulaması kodda), `verify_parent_pin` sunucuda; "Vazgeç" çocuk görünümüne döndü; doğru PIN → `/parent`. ER: alanlar etiketli; düğme 48 dp.

### Alt rotalar
- Kanıt: `a2/childmode-week-phone.png`, `…-calendar-phone.png`, `…-collection-phone.png`, `…-goal-phone.png`, `…-room-preview-phone.png`, `…-prova-phone.png`. Hepsi aktif çocuğa ait veriyi gösterdi; oda önizlemesinde "Oda" sekmesi "Güneşli odam — Diğer oda temaları henüz seçilemiyor."
- `/parent/child-mode/prova/[examId]`: aynı çözücü bileşeni (`export { default } from "@/app/child/prova/[examId]"`); veli telefonunda ayrıca **çalıştırılmadı** (atanmış sınav kalmamıştı) → GÖRÜLEMEDİ; sunucu `start_exam_attempt` veli oturumunda `p_acting_child` kontrolü mjs sözleşmesinde test ediliyor.

## Matris — veli Prova zinciri (`/parent/prova/*`, telefon dikey + tablet dikey + tablet yatay)

### `/parent/prova` — merkez (Provalar / Sonuçlar / Kütüphane; Tümü/çocuk filtresi; boş durum)
- Kanıt: `a2/parent-prova-hub-phone.png`, `…-tablet.png`, `…-tabletLand.png`, `…-results-phone.png`, `…-library-phone.png`, kardeş için boş `a2/parent-prova-hub-sibling-empty-phone.png`.
- UX: "Prova hazırla" tek birincil; "İncelemeni bekliyor" en üstte; "Kaldığın yerden" taslak kartları; boş durumda tek anlamlı cümle + maskot. **Bulgu Q00-A2-8** (tekrar kart) P2. EĞ: durum metinleri "Çözülüyor… / İncelemeni bekliyor / Puanlandı / Çoktan seçmeli: 1/1" — otomatik 0'lı "Puanlandı" Q00-A2-2'ye bağlı. GÖ: onaylı; 1280'de maksimum 1280 genişlik. ER: sekmeler `tab`, sayaç rozeti.

### `/parent/prova/builder` — Başlangıç → Kapsam → Sorular → Kontrol
- Kanıt: `a2/parent-builder-step0-phone.png`, `…-step0-tablet-land.png`, `…-step1-phone.png`, `…-step1-meb-phone.png`, `…-step1-timed-phone.png`, `…-step2-empty-phone.png`, `…-source-picker-phone.png`, `…-source-picker-tablet.png`, `…-source-library-phone.png`, `…-step2-filled-phone.png`, `…-step3-phone.png`, `…-step3-tablet-land.png`, ayrılma `a2/parent-builder-leave-phone.png`.
- EĞ: ders seçenekleri `current_question_bank`'tan geliyor + "Başka ders ekle" (boş bankada ders eklenebiliyor; P01 kabulü karşılanıyor). "MEB ortak yazılı" seçilince "Doğrulanmış güncel senaryo kataloğu henüz bağlı değil… Resmî uyum iddiasında bulunulmaz." (M01 dürüst durum). "Yazılıya hazırlık" → tür açık uçluya kilitli ve nedeni yazılı. Kontrol adımında "Çocuğun göreceği görünüm" + "Cevabı kontrol et" ayrı — doğru cevap öğrenci görünümünde yok.
- UX: taslak otomatik korunuyor ("Kaydedilmemiş değişiklikler" rozeti, ayrılırken üç seçenekli diyalog). **Bulgu Q00-A2-9** (hedef uyuşmazlığı kilidi) P2. "Kendim ekleyeceğim" yolu soru editörüne geçerken ayrılma diyaloğu tetikliyor gibi göründü (`a2/parent-builder-manual-phone.png`) — tek çalıştırmada doğrulanmadı, P01 notu.
- MİM: `save_prova_draft` tekrarları aynı sürümü döndürüyor (fixture sözleşmesi); gönderim atanmış sürümü dondurur. ER: adımlar `tab`, 48 dp; tablet yatayda özet sağ sütunda.
- GÖRÜLEMEDİ: "AI ile hazırla" ve "Belgeden yararlan" sayfaları (Edge yok; ayrıca senaryo sürücüsü ders seçmeden Devam'a bastığı için kapsam uyarısında kaldı — `a2/parent-builder-ai-phone.png` kapsam uyarısını gösteriyor).

### `/parent/prova/question` — tek soru editörü
- Kanıt: `a2/parent-question-phone.png`, `…-tablet.png`, `…-tabletLand.png`, dolu `a2/parent-question-filled-phone.png`, doğrulama `a2/parent-question-save-noanswer-phone.png`.
- EĞ: "Doğru seçeneği harfine dokunarak işaretleyin." — doğru şık başlangıçta boş (P02 kabulü). Görsel yükleme "henüz açılmadı" dürüst. UX: uzun tek form (P02 açık satırı: adımlı editör) P2. Doğrulama "Dört seçeneğin tamamını doldurun." satır içi. Kaydetme bu çalıştırmada tamamlanamadı (sürücü seçenek alanlarını dolduramadı) → kaydetme sonrası katkı akışı GÖRÜLEMEDİ.

### `/parent/prova/shared-source` — ortak kaynaklı sorular (3 adım)
- Kanıt: `a2/parent-shared-source-phone.png`, `…-tablet.png`, `…-tabletLand.png`. "Kaydedilmiş soru gruplarım: Okul bahçesi · Sürüm 1 — Değişiklikler yeni sürüm olarak kaydedilir. Atanmış Provalar değişmez."
- MİM: sürümleme açıkça yazılı. UX: hazırlayıcı dışında ayrı giriş sürüyor (P01 "ayrı ürün gibi değil" satırı). Adım 2–3 bu çalıştırmada açılamadı (kaynak metin alanı dolu olmasına rağmen "Sorulara geç" devre dışı kaldı — alanlardan biri sürücü tarafından doldurulamadı) → **kısmen görüldü**.

### `/parent/prova/library`
- Kanıt: `a2/parent-library-phone.png`, `…-tablet.png`, `…-tabletLand.png`. "120 soru ekleme hakkı — Aynı soruyu yeniden eklemek ikinci kez hak kullanmaz."; koleksiyon yok boş durumu; "Paylaştığım soru grupları" boş.
- EĞ/UX: hakkın ne zaman harcandığı yazılı (P05 kabulü). Sınır: gerçek koleksiyon/edinim verisi yok → edinme akışı GÖRÜLEMEDİ.

### `/parent/prova/catalog` — okul senaryosu (3 adım)
- Kanıt: `a2/parent-catalog-phone.png`, `…-tablet.png`, `…-tabletLand.png`. "Okulunun hangi senaryoyu kullanacağını öğretmeninin duyurusundan kontrol et." (M01 dili). Çocuk + ders + öğretim yılı/dönem/yazılı alanları.
- Adım 2–3: çocuk ve "Matematik" seçildiği halde "Devam et" devre dışı kaldı (öğretim yılı seçimi gerekiyor olabilir) → **kısmen görüldü**; katalog verisi bu DB'de yok.

### `/parent/prova/blueprint` — soru dağılımı
- Kanıt: `a2/parent-blueprint-phone.png`, `…-tablet.png`, `…-tabletLand.png`. "Bu kayıt soru üretmez; … dağılım şablonudur." (P02 kabulü). Adım 2 "Konu satırı ekle" düğmesi var; sürücü satır ekleyemediği için adım 3 GÖRÜLEMEDİ.

### `/parent/prova/level` — seviye tespiti
- Kanıt: `a2/parent-level-phone.png`, dolu `a2/parent-level-filled-phone.png`, oluşturma sonrası `a2/parent-level-created-phone.png`; sonra `a2/after-parent-level-created-phone.png`.
- EĞ: "Önizleme: 1 soru · Kolay 0 / Orta 1 …" dağılım görünür; "Seviye tespiti" adı standart ölçüm çağrıştırıyor (P02 açık satırı, karar). **Bulgu Q00-A2-5 (düzeltildi).** MİM: `create_level_test` sunucuda; çift dokunma `loading` ile engelli.

### `/parent/prova/booklet` — kitapçık
- Kanıt: `a2/parent-booklet-phone.png`, dolu `a2/parent-booklet-filled-phone.png`, `…-result-phone.png`. "Cevap anahtarına çözüm yollarını ekle" anahtarı; "1 soru seçildi".
- EĞ: öğrenci nüshası/cevap anahtarı ayrımı yalnız açıklama metninde; çıktı önizlemesi yok (P02 açık). Oluştur → istemci tarafı yazdırma/paylaşım (`printBooklet`); headless web'de çıktı GÖRÜLEMEDİ.

### `/parent/prova/groups` — Birlikte Prova
- Kanıt: `a2/parent-groups-phone.png`, `…-tablet.png`, `…-tabletLand.png`. "Bu çalışma evde yapılan bir provadır, gözetimli veya resmî sınav değildir." · "Bu ay 0 / 4 katılım" · yayımlanmış ortak prova yok boş durumu.
- PS/EĞ: sıralama baskısı yok; katılım sayacı. Katılım/sonuç adımları veri olmadığı için GÖRÜLEMEDİ (P05/B02).

### `/parent/prova/share` — katkı
- Kanıt: `a2/parent-share-phone.png`, `…-tablet.png`, `…-tabletLand.png`. Sorusuz açılınca "Önce paylaşacağın soruyu seç" + Prova'ya dön. Soru ile akış (gizlilik/kazanılacak hak özeti) soru kaydı tamamlanamadığı için GÖRÜLEMEDİ.

### `/parent/prova/progress` — gelişim
- Kanıt: `a2/parent-progress-phone.png`, `…-tablet.png`, `…-tabletLand.png`. "Kayıtlar ait oldukları eğitim döneminde kalır… tek bir başarı puanına dönüştürülmez."; "Farklı sorular doğrudan karşılaştırılmaz. Bekleyen değerlendirmeler sütunlara dahil değildir."; "1 yanıt değerlendirmeni bekliyor" → sonraki adım.
- EĞ/PS: az veride ölçülü yorum, bekleyen cevap yanlış sayılmıyor. Konu filtresi (P04 açık) yok. GÖ/ER: grafik etiketleri metin olarak mevcut.

### `/parent/prova/attempt/[attemptId]` — sonuç özeti
- Kanıt: `a2/parent-attempt-phone.png`, `…-tablet.png`, `…-tabletLand.png`; inceleme sonrası `a2/parent-attempt-after-phone.png`; AI hatası `a2/parent-attempt-ai-grade-phone.png`, `…-ai-plan-phone.png`; çizimli deneme `a2/parent-attempt-ink-only-tablet-land.png`.
- EĞ: "Ara sonuç: 95 / 100 — Açık uçlu cevapların incelemesi sürüyor. Son puan…" (P04 kabulü) ve inceleme bitince "Puan: 90 / 100". Çizimli çözüm için "AI, çizimleri henüz değerlendirmiyor." dürüst; **ama aynı ekran Q00-A2-1 yüzünden "Puan: 0 / 100 · 2 / 2 puanlandı" diyor.** UX: Q00-A2-7 (düzeltildi), Q00-A2-13 (genel hata metni). Plan taslağı "• 05.11.2026 · Taslak" bağlantısı.

### `/parent/prova/review/[attemptId]` — cevap inceleme
- Kanıt: telefon sekmeli `a2/parent-review-phone.png`, tablet `a2/parent-review-tablet.png`, tablet yatay `a2/parent-review-tablet-land.png`, Q3 `a2/parent-review-q3-tablet-land.png`, dolu/kaydedildi `a2/parent-review-q3-filled-tablet-land.png`, `…-saved-tablet-land.png`; çizimli cevap `a2/parent-review-ink-only-q1-tablet-land.png`, boş puanla kaydetme denemesi `a2/parent-review-ink-only-saved-tablet-land.png`.
- EĞ: soru + ortak kaynak + "Cevap anahtarı" (katlanır) + çocuğun yanıtı + puan/geri bildirim + çizimli not katmanı birlikte. **Boş puanla "Kaydet" → "Puan 0 ile 100 arasında bir tam sayı olmalı." ve kayıt yok (DB `score=null` kaldı) — eksik puan 0'a dönüşmüyor (doğru).** Şıklı soruda puan alanı yok, yalnız geri bildirim ("Doğru · A"). MİM: `save_answer_review` revizyon + cevap hash'i ile; çocuğun mürekkebi korunuyor (fixture `child_ink_preserved_after_review`). PS: "Kaydettiğin notlar ve geri bildirim çocuğuna görünür." uyarısı. GÖ/ER: Q00-A2-10 P2; sekmeler `tab`, alanlar etiketli.

### `/parent/prova/repeat/[attemptId]` — tekrar günleri
- Kanıt: `a2/parent-repeat-phone.png`, `…-tablet.png`, `…-tabletLand.png`. "Şu an tekrar önerilecek soru yok — Doğru yanıtlar, boş yanıtlar, yalnız AI önerisiyle puanlanan veya henüz incelenmemiş cevaplar tekrar listesine alınmaz…" + "Kaynak Prova'yı incele".
- EĞ: dışlama kuralları açık; dolu tekrar akışı (sorular → gün/süre → önizleme) uygun veri olmadığı için GÖRÜLEMEDİ.

### `/parent/prova/plan/[planId]` — çalışma planı (sentetik taslak satırıyla)
- Kanıt: `a2/parent-plan-phone.png`, `…-tablet.png`, `…-tabletLand.png`. "Bu sonuç yalnız incelenen sorulara dayanır; çocuğun genel yeterliliğini göstermez."; "Takvimime yerleştir — Uygun günleri seç… Önce birlikte gözden geçireceğiz."; "Seçilen 0 günü gözden geçir"; görev önerileri; "Arşivle".
- EĞ/PS: AI önerisi veli onayı olmadan takvime yazılmıyor (P04 kabulü); mevcut takvim yükü gösterimi bu ekranda görülmedi (P04 açık). Gün onayı/çakışma adımı çalıştırılmadı → kısmen.

### `/parent/prova/exam`, `/parent/prova/generate`
- Her ikisi `/parent/prova/builder`'a yönlendirdi (`groupId` korunuyor, kod). Sorun yok.

### Taslak yaşam döngüsü (hub içi)
- Kanıt: `a2/parent-draft-discard-confirm-phone.png`, `a2/parent-draft-deleted-phone.png`. "Taslağı sil" → "Taslak silinenlere taşındı. İstersen geri alabilirsin." → "Silinen taslaklar" paneli "Taslağı geri al" + "Atamadan önce çocuğun güncel sınıfını ve soru kapsamını kontrol et." — geri alınabilir silme, sessiz kayıp yok.

## Doğrulama (gerçek çıktılar)

- `pnpm --filter @gina/mobile exec tsc --noEmit` → çıkış 0 (son düzeltmelerden sonra tekrar).
- `pnpm --filter @gina/mobile exec expo lint` → çıkış 0 (tekrar).
- `pnpm --filter @gina/core test` → 40 dosya / 257 test geçti (i18n anahtarları eklendikten sonra).
- Playwright çalıştırmaları: `child-device` (2 tam tur, 33 adım), `child-mode` (9), `parent-prova` (2 tur, 22), `parent-deep` (15), `review-score` (1), `after-fixes` (2 tur, 6). Tüm görüntülerde yatay taşma 0 px, çözülmemiş anahtar yok, `pageerror` yok. İzole servisin 45 dk tutma süresi dolunca yığın yeniden kuruldu (ikinci fixture `gina_http_d110c9547e769b75_audit`); "sonra" kanıtları bu ikinci, temiz DB üzerinde alındı.

## Kalan sınır

- Q00-A2-1/2 sunucu kuralı (migration) bu dalda değiştirilmedi; karar bekliyor. Çocuk/veli ekranları o düzeltme gelene kadar çizimli ve boş açık uçlu cevaplarda çelişkili durum gösterir.
- Gerçek dokunmatik cihaz (iPad/Android tablet) çizim-kaydırma, kalem/parmak ayrımı, OS klavyesi ve büyük yazı ölçeği (fontScale ≥ 1.4 sekmeli düzen) fiziksel olarak denenmedi.
- Edge fonksiyonları (AI üretim/puanlama/plan, kitapçık PDF) izole serviste yoktu; yalnız hata/boş durumları görüldü.
- GÖRÜLEMEDİ/kısmen listesi: çocuk görev "geri gönderildi" durumu, odak sayacının ara/çıkış davranışı, veli PIN'i tanımsız kartı, tek çocuklu çocuk modu kısa yolu, veli telefonunda Prova çözme, katalog/senaryo adım 2–3, soru dağılımı adım 2–3, ortak kaynak adım 2–3, soru kaydı → katkı paylaşımı, kütüphane edinimi, Birlikte Prova katılım/sonuç, dolu tekrar planı, plan gün onayı/takvim çakışması, kitapçık çıktısı, builder AI/belge yolları, süre dolumu otomatik bitirme.
