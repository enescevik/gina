> **30 Ekim 2026 güncellemesi:** Görev/ders/etkinlik/oyunlaştırmanın güncel büyük resim katmanı ilgili `illustrated-v3/` dizinleridir. README başındaki resimli v3 kararı, aşağıdaki eski flat teslim biçiminden önceliklidir. Manifest/HTML contact-sheet ve animasyon tarifi esas alınır; eski SVG seti geçiş uyumluluğu içindir. Ayrıntılı devam talimatı: `docs/design/room-v2/CLAUDE-PROMPT.md`.

# Gina görsel varlık brief'i (Codex için)

Bu dosya, `packages/assets/` altına üretilecek tüm varlıkların tam listesini ve kategori başına üretim talimatını içerir. Önce [README.md](./README.md)'deki klasör yapısını ve ortak kuralları oku; çelişki olursa README geçerlidir. Her kategori **ayrı bir dal + PR** olarak teslim edilir; `apps/mobile/assets` klasörüne dokunulmaz (ikonları uygulamaya geliştirici bağlar).

Uygulama: **Gina Aile** — 7-9 yaş çocuklar günlük görevlerini tablette işaretler, ebeveyn telefondan onaylar, yıldız kazanılır; takvim, ders programı, notlar, puanlar, haftalık AI özeti. Hedef kitle: çocuklar **ve** ebeveynleri; Türkiye; çok dilli.

## Öncelik sırası

| Sıra | Kategori | Klasör | Ne zaman |
| --- | --- | --- | --- |
| 1 | Marka: ikon, logo, splash, favicon, bildirim ikonu | `brand/` | şimdi |
| 2 | Avatarlar (12 çocuk + varsayılan + 5 yetişkin) | `avatars/` | şimdi |
| 3 | Görev ikonları (önce MVP 30, sonra kalan 36) | `icons/tasks/` | şimdi |
| 4 | Ders ikonları (19) | `icons/subjects/` | istenince |
| 5 | Etkinlik türü ikonları (20) | `icons/events/` | istenince |
| 6 | Yıldız, mühür, rozet, seri, yükleme (25) | `gamification/` | istenince |
| 7 | Boş/hata durumları + PIN kilit (16) | `illustrations/states/` | istenince |
| 8 | Uygulama içi özel ikonlar (14) | `icons/app/` | istenince |
| 9 | Mağaza arka planları (6) | `store/` | istenince |
| 10 | Onboarding (3), öğretmen (1), desenler (5) | `illustrations/`, `patterns/` | istenince |
| 11 | Ödül ikonları (15), ruh hali (6) | `icons/rewards/`, `moods/` | Faz 2 |

## Stil rehberi

**Kişilik.** Sıcak, oyuncu, düzenli ve güven verici; «bebeksi» değil: bir çocuk dergisi kadar neşeli, bir okul ajandası kadar net. Cinsiyete göre renk kodu yoktur. Marka motifi yuvarlak köşeli beş kollu yıldızdır (ödül = yıldız); maskot yok, yüzler yalnız avatar ve ruh hali ikonlarında.

**Palet.** Primary «Deniz Yeşili» `#0FA3A3` (koyu `#0B7F7F`, açık `#D9F4F2`). Secondary «Yıldız Sarısı» `#F5B301`. Kategori vurguları: Mercan `#FF6B6B`, Mavi `#4D7CFE`, Yeşil `#2FB47C`, Mor `#8B5CF6`, Turuncu `#FF9F43`, Gök `#38BDF8`; açık tonları: Teal `#D9F4F2`, Mavi `#E3EAFF`, Mercan `#FFE9E9`, Yeşil `#E6F7EF`, Mor `#EFE9FE`, Turuncu `#FFF1E3`, Gök `#E4F5FE`. Rozet metalleri: Bronz `#C9823A`, Gümüş `#B8C2CC`, Altın `#F5B301`, Elmas `#38BDF8`. Durum: success `#2FB47C`, warning `#F5B301`, error `#E5484D`. Nötrler: Ink `#1F2937` (metin ve kontur), `#4B5563`, `#9CA3AF`, Mist `#E5E7EB`, `#F3F4F6`, Beyaz; çocuk teması zemini Krem `#FFF8EF`. Koyu mod: zemin `#0F172A`, yüzey `#1E293B`, metin `#F1F5F9`; illüstrasyon konturları `#E2E8F0`.

**Tipografi.** Çocuk alanı Nunito 600-800, ebeveyn alanı Inter 400-600 (ikisi de Google Fonts, OFL, Türkçe karakter desteği var). Görsellerde yazı kullanılmaz; tipografi yalnız logo-wordmark için referanstır.

**Biçim.** Yarıçap: çocuk kartı 24, ebeveyn kartı 12, buton 14, çip tam yuvarlak. Renkli ikonlar 48 ızgarasında 2,5 px kontur; mono varyantlar 24 ızgarasında 2 px kontur ile çizilip dolguya çevrilir (Lucide ile aynı ağırlık). Round linecap/linejoin.

**İkon ve illüstrasyon.** Flat «yumuşak dolgulu»: ince Ink kontur + düz dolgu + tek vurgu rengi; 2 px güvenli boşluk; en küçük detay 2 px. İllüstrasyon geometrik, 3-4 renk, kalın kontur, basit karakterler (nokta göz, küçük gülümseme), çeşitli ten tonları, merkezli kompozisyon, bol boşluk.

## Ortak kurallar (her kategoriye uygulanır)

1. Özgün ve telifsiz çizim; flat 2B; tek stil. Gradyan, 3D, gölge, parlama, doku, fotogerçekçilik yok.
2. Görselde hiç yazı, harf, rakam, sahte arayüz metni yok (tek istisna: path'e çevrilmiş `logo-wordmark`). Sayılar sembolle anlatılır.
3. Şeffaf arka plan (aksi belirtilmedikçe). Kontur Ink `#1F2937`, round linecap/linejoin.
4. Yalnız yukarıdaki palet; ikon başına en fazla 1 vurgu rengi + nötrler.
5. SVG teknik: her varlık ayrı dosya, `viewBox` zorunlu; `<text>`, `<style>`, CSS class, `filter`, `mask`, `clipPath`, gradient, `<use>`/dış referans, gömülü bitmap, script ve font **yok** (react-native-svg ile birebir render edilecek); id'ler `<slug>-` önekiyle; svgo ile optimize; dosya adları küçük harf kebab-case.
6. İkon konturu: renkli ikonlar `viewBox 0 0 48 48`, `stroke-width 2.5`; her ikonun mono varyantı ayrıca `viewBox 0 0 24 24`'te `stroke 2` ile çizilip dolguya çevrilir (`fill="currentColor"`, stroke yok). 2 px güvenli kenar boşluğu; en küçük detay 2 px.
7. Cinsiyet renk kodu ve işareti yok. Türkiye bağlamı: sarı Amerikan okul otobüsü, posta kutusu, Noel/Halloween motifi, elma = öğretmen klişesi, ülke bayrağı, dini sembol **yok**; sağlık için nötr artı işareti. Marka/telifli öğe, Apple/Google emoji kopyası, gerçek kişiye benzeyen portre, kumar/para çağrışımı yok.
8. Teslim: dosyalar belirtilen klasöre; her klasörde `manifest.json`: `[{"slug","label_tr","file","viewBox","variants":["color","mono"],"png":[{"size","path"}]}]`. PNG istenen kategoriler (brand, store) dışında rasterize etme. Her kategoride 8 ikonu 24 px ve 48 px'te yan yana gösteren `contact-sheet.svg` üret.

---

## 1. Marka: ikon, logo, splash, favicon, bildirim

Klasör `brand/{ios,android,splash,web,email}/`. Bu kategoride PNG gerekli.

**Konsept:** teal (`#0FA3A3`) kare zemin üzerinde tam ortada büyük, yuvarlak köşeli beş kollu sarı (`#F5B301`) yıldız; yıldızın sağ alt kolu küçük bir onay işaretine (tik) dönüşür; 29 px'te okunur; yıldız tuvalin ~%62'sini kaplar; çok ince çizgi ve keskin köşe yok. Tüm dosyalarda yıldız geometrisi birebir aynı; PNG'leri SVG'den rasterize et (sRGB).

**Çıktılar (tam yollar):**

- `brand/logo-mark.svg` (viewBox 0 0 256 256) ve `brand/logo-mark-mono.svg` (fill=currentColor)
- `brand/logo-wordmark.svg`: «gina» küçük harf, Nunito ExtraBold benzeri yuvarlak harfler path olarak, solunda logo-mark
- `brand/ios/icon-background.svg` (düz teal, full-bleed, opak) + `brand/ios/icon-foreground.svg` (yalnız yıldız+tik, şeffaf): Icon Composer için katmanlı kaynak
- `brand/ios/ios-icon-light.png` 1024×1024: tam kare, köşe yuvarlatma **yok**, **alfa kanalı yok** (8 bit RGB)
- `brand/ios/ios-icon-dark.png` 1024×1024: zemin şeffaf, yalnız sarı yıldız + tik
- `brand/ios/ios-icon-tinted.png` 1024×1024: gri tonlama (Gray Gamma 2.2), şeffaf zemin, yıldız tek siluet
- `brand/android/android-icon-foreground.png` 1024×1024 şeffaf: tüm önemli içerik merkezdeki 626 px çaplı daire içinde, dış 171 px bant boş
- `brand/android/android-icon-background.png` 1024×1024 düz `#0FA3A3`
- `brand/android/android-icon-monochrome.png` 1024×1024: beyaz tek siluet, şeffaf, aynı güvenli daire
- `brand/android/android-icon-legacy.png` 1024×1024: teal yuvarlak kare (köşe yarıçapı ~%17, köşeler şeffaf) + yıldız
- `brand/android/play-store-icon.png` 512×512 32-bit PNG: zemin dolu, şeffaflık ve gölge yok, köşe yuvarlatma yok
- `brand/android/notification-icon.png` 96×96: beyaz siluet (yıldız+tik), şeffaf zemin
- `brand/splash/splash-icon.png` ve `splash-icon-dark.png` 1024×1024 şeffaf: ortada işaret, tuvalin %60'ını geçmez
- `brand/web/favicon.svg`, `favicon-32.png`, `favicon-48.png`, `apple-touch-icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-192-maskable.png`, `icon-512-maskable.png` (maskable: içerik merkezdeki %80 güvenli daire içinde, zemin teal dolu)
- `brand/email/email-logo@2x.png` 240×80: opak Krem `#FFF8EF` zemin, logo-mark + wordmark
- `brand/og-image.png` 1200×630: Krem zemin, solda logo-mark, sağ yarı boş
- `brand/manifest.json`

## 2. Avatarlar (18)

Klasör `avatars/`; viewBox 0 0 128 128; kullanım 40-120 px.

12 çocuk avatarı + 1 varsayılan + 5 yetişkin avatarı. **Biçim:** 120 px çaplı daire zemin (slug başına verilen açık ton); omuz hizası büst; nokta göz + küçük gülümseme, yanak lekesi yok; kontur stroke 3 (128 ızgarası). 7-10 yaş çocuk, cinsiyeti nötr (fiyonk/kasket gibi cinsiyet işareti yok). Ten tonları sırayla `#F6D7C3`, `#E8B894`, `#C68B5B`, `#9C6644`, `#5C3A21`; saç siyah, kahve, kumral, kızıl. Bütün avatarlarda baş boyutu ve göz hizası aynı.

Slug → zemin: `avatar-curly` `#D9F4F2` · `avatar-glasses` `#E3EAFF` · `avatar-bun` `#EFE9FE` · `avatar-spiky` `#E6F7EF` · `avatar-braids` `#FFE9E9` · `avatar-cap` `#FFF1E3` · `avatar-headband` `#E4F5FE` · `avatar-wavy` `#D9F4F2` · `avatar-afro` `#E3EAFF` · `avatar-hearing-aid` `#EFE9FE` · `avatar-beanie` `#E6F7EF` · `avatar-astronaut` `#FFE9E9` · `avatar-default`: yüzsüz gri siluet `#9CA3AF`, zemin Mist `#E5E7EB`.
Yetişkinler (aynı stil, biraz daha uzun boyun/omuz): `avatar-parent-default` (siluet, Mist zemin), `avatar-adult-short` `#D9F4F2`, `avatar-adult-long` `#E3EAFF`, `avatar-adult-glasses` `#EFE9FE`, `avatar-adult-beard` `#E6F7EF`.
Dosyalar `avatars/avatar-{slug}.svg` + `manifest.json`.

## 3. Görev ikonları (66)

Klasör `icons/tasks/color/` ve `icons/tasks/mono/`. Önce **MVP 30** teslim edilir (ilk PR), kalan 36 ikinci PR.

Renkli: 48 ızgarası, stroke 2.5; mono: 24 ızgarası, fill=currentColor. Kontrast: açık ton üstünde beyaz/sarı çizgi yok.

**MVP 30:** `make-bed` (yatağını topla), `brush-teeth` (diş fırçala), `wash-face` (yüz yıka), `get-dressed` (giyin), `eat-breakfast` (kahvaltı), `wash-hands` (el yıka), `pajamas` (pijama giy), `homework-general` (defter + kalem), `homework-turkish` (kitap + konuşma balonu), `homework-math` (abaküs/geometri, rakam yok), `homework-english` (balon + dünya), `homework-science` (deney tüpü), `read-book` (kitap oku), `tidy-room` (oda topla), `tidy-toys` (oyuncak topla), `set-table` (masayı kur), `clear-table` (masayı topla), `take-out-trash` (çöp at), `water-plants` (bitki sula), `pack-school-bag` (çanta hazırla), `fill-water-bottle` (matara doldur), `drink-water` (su iç), `screen-time` (tablet + kum saati), `put-away-tablet` (tableti kaldır), `bedtime` (ay + yatak), `exercise` (spor), `practice-instrument` (enstrüman), `drawing` (resim), `feed-pet` (evcil hayvan besle), `task-custom` (özel görev: yıldızlı onay kutusu; ikon seçicide yer tutucu).

**Kalan 36:** `comb-hair`, `take-shower`, `cut-nails`, `homework-life-science` (ev + güneş), `homework-social` (harita parçası), `study` (masa lambası + kitap), `practice-test` (işaretli sayfa), `vocabulary` (kart + balon), `write-journal`, `unload-dishwasher`, `laundry-basket`, `sweep-floor`, `carry-groceries`, `tidy-desk`, `charge-tablet`, `football-practice`, `swimming`, `cycling`, `play-outside` (top + güneş), `crafts`, `dance`, `puzzle`, `chess`, `coding` (ekran + bloklar), `read-aloud`, `bedtime-story`, `walk-dog`, `feed-fish`, `pack-lunchbox`, `eat-fruit`, `finish-meal` (tabağını bitir), `take-medicine` (vitamin: haçsız şişe), `call-grandparents`, `help-sibling` (iki figür), `kindness` (kalp + el), `save-money` (kumbara).

`manifest.json` + `contact-sheet.svg`.

## 4. Ders ikonları (19)

Klasör `icons/subjects/color/` ve `mono/`; renk eşlemesi sabittir (uygulama aynısını kullanır).

Her derse tek vurgu rengi: `turkish` Mercan (açık kitap + konuşma balonu) · `math` Mavi (cetvel + geometrik şekiller, rakam yok) · `life-science` Yeşil (ev + güneş + yaprak) · `science` Yeşil (deney tüpü + atom) · `social-studies` Mor (dünya haritası + pusula) · `citizenship` Mor (el ele iki el) · `english` Gök (konuşma balonu + dünya) · `religion-ethics` Teal (açık kitap + kalp; dini sembol **yok**) · `physical-education` Teal (top + koşu) · `play-physical` Teal (ip atlama) · `music` Turuncu (nota + enstrüman) · `visual-arts` Turuncu (palet + fırça) · `ict` Teal (Bilişim Teknolojileri ve Yazılım: dizüstü + imleç) · `technology-design` Teal (dişli + cetvel) · `traffic-safety` Teal (trafik ışığı + yaya geçidi) · `free-activity` Teal (yapboz) · `guidance` Teal (pusula + kalp) · `study-hall` Teal (masa lambası + defter) · `elective` Teal (yıldızlı defter). `manifest.json` + `contact-sheet.svg`.

## 5. Etkinlik türü ikonları (20)

Klasör `icons/events/color/` ve `mono/`; takvim çiplerinde 16-40 px, bu yüzden en fazla 2 şekil; takvim ikonlarında bile sayı yok.

Renk: `school`/`class-schedule`/`online-lesson` Mavi; `activity`/`club`/`sports-event` Yeşil; `holiday`/`school-break`/`public-holiday` Turuncu; `exam`/`homework-due` Mercan; `family`/`birthday`/`visit` Mor; `doctor` Gök; diğerleri Teal.
Konseptler: `school` (okul binası: çatı + kapı), `class-schedule` (haftalık ızgara), `online-lesson` (ekran + konuşma balonu), `activity` (yıldızlı bilet), `club` (rozet + yıldız), `sports-event` (kupa), `holiday` (güneş + şezlong), `school-break` (kapalı okul kapısı + güneş), `public-holiday` (konfetili takvim; bayrak ve dini sembol yok), `exam` (kalem + onaylı sayfa), `homework-due` (defter + saat), `family` (üç figür el ele), `birthday` (mumlu pasta dilimi), `visit` (kapı + hediye), `doctor` (stetoskop; nötr teal artı), `parent-meeting` (iki konuşma balonu), `trip` (bavul), `reminder` (zil), `shopping` (sepet), `other` (üç nokta daire). `manifest.json` + `contact-sheet.svg`.

## 6. Yıldız, mühür, rozet, seri, yükleme (25)

Klasör `gamification/{stars,streaks,badges,stamps,loading}/`. Yıldız geometrisi logo-mark ile birebir aynı. Altın/gümüş/bronz hissi düz renk + tek açık ton şeritle; seri 3/7/30 sayıyla değil alev kademesiyle anlatılır.

- `stars/` (viewBox 48, ayrıca mono): `star-filled`, `star-empty` (kontur), `star-half` (soldan dolu), `star-jar` (cam kavanoz + 3 yıldız), `star-burst-01..06` (yıldızın büyüyüp 8 parıltı saçtığı 6 kare)
- `streaks/` (viewBox 48): `streak-flame`, `streak-3` (küçük alev), `streak-7` (orta alev + 1 parıltı), `streak-30` (büyük alev + taç)
- `badges/` (viewBox 96, stroke 3): yuvarlak rozet zemini + kurdele, içinde sade sembol; zemin ve kurdele geometrisi hepsinde aynı: `badge-bronze/silver/gold/diamond` (yalnız renk ve kurdele sayısı değişir: 1/2/3/3+elmas), `badge-first-task` (tik), `badge-bookworm` (kitap + gülen solucan), `badge-early-bird` (güneş + kuş), `badge-tidy` (katlı kıyafet), `badge-helper` (kalp + el), `badge-math-star` (geometrik şekiller), `badge-week-hero` (pelerin), `badge-locked` (gri siluet `#9CA3AF` + kilit)
- `stamps/` (viewBox 96): `stamp-approved` (yeşil, tik), `stamp-pending` (sarı, saat), `stamp-returned` (mercan, geri ok)
- `loading/`: `loading-star-01..08` (yıldızın dönüp parıldadığı 8 kare, viewBox 48) + `loading-star-static`
- `manifest.json`

## 7. Boş/hata durumları ve PIN kilit (16)

Klasör `illustrations/states/`; viewBox 0 0 400 300; ekranda 240-320 px; her sahnenin `-dark` varyantı (konturlar `#E2E8F0`, zemin lekesi `#1E293B`). Kontur stroke 3; merkezde tek nesne grubu, etrafında bol boşluk, altta hafif Krem zemin lekesi (elips, kontursuz); karakter kullanılırsa nokta gözlü, cinsiyeti nötr çocuk (avatar setiyle aynı oranlar: baş yüksekliği toplam boyun 1/3'ü, gövde 1,5 baş). En fazla 4 renk + nötr.

Sahneler: `empty-tasks` (boş kontrol listesi panosu + dinlenen yıldız), `all-done` (konfeti + üç yıldız, kollarını kaldıran çocuk), `empty-events` (boş takvim sayfası + uçurtma), `empty-notes` (boş defter + kalem + yaprak), `empty-grades` (boş çubuk grafik kutuları + büyüteç), `empty-children` (boş çerçeve + artı + yıldız), `empty-approvals` (kutlama tonunda mühür + yıldız), `empty-development` (boş zaman çizelgesi + bayrak), `empty-ai-summary` (belge + parıltı, boş sayfa), `offline` (bulut + kopuk fiş, sakin), `error` (devrilmiş kutudan düşen yıldız, dramatik değil), `pin-locked` (kapı + kilit + yıldız), `pin-wrong` (sallanan kilit, nazik), `link-expired` (kopuk zincir + saat), `update-required` (ok + kutu), `notification-permission` (zil + yıldız). Dosyalar `states/{slug}.svg` ve `{slug}-dark.svg`, `manifest.json`.

## 8. Uygulama içi özel ikonlar (14)

Klasör `icons/app/color/` ve `mono/`; viewBox 48 + mono 24. `exam-written` (kalem + sayfa), `exam-oral` (konuşma balonu + yıldız), `exam-performance` (dosya + tik), `exam-project` (maket + cıvata), `ai-summary` (belge + parıltı), `summary-generating` (parıltı + dönen halka), `pin-lock` (yuvarlak kilit + 4 nokta), `milestone-flag`, `observation-note` (defter + göz), `skill-motor` (top + el), `skill-social` (iki figür), `skill-emotional` (kalp + yüz), `skill-academic` (kitap + yıldız), `skill-selfcare` (diş fırçası + tarak). Renk: sınav türleri Mercan, AI Mor, PIN Teal, gelişim Yeşil. `manifest.json`.

## 9. Mağaza arka planları (6)

Klasör `store/`; PNG sRGB, **alfa yok**, yazı yok (başlıklar ve ekran görüntüleri sonra eklenir). Krem `#FFF8EF` zemin; köşelerde yıldız konfetisi (beş kollu yuvarlak köşeli yıldız, üç boy 24/16/10 px, %20 opaklık, 96 px ızgarada seyrek); alt üçte birlik alanda düz Teal `#0FA3A3` blok, üst kenarı yumuşak dalga. Boyutlar: `store-bg-iphone-61` 1179×2556 · `store-bg-iphone-69` 1320×2868 · `store-bg-ipad-13` 2064×2752 · `store-bg-android-phone` 1080×1920 · `store-bg-android-tablet` 1600×2560 · `play-feature-bg` 1024×500 (24-bit PNG). Her boyut ayrı dosya `store/{slug}.png` + kaynak SVG, `manifest.json`.

## 10. Onboarding (3), öğretmen (1), desenler (5)

- **Onboarding** (`illustrations/onboarding/`, viewBox 0 0 600 450, stroke 3, `-dark` varyantı ile): karakterler avatar setiyle aynı: ebeveyn = `avatar-adult-short` görünümü, çocuk A = `avatar-braids`, çocuk B = `avatar-curly`; oranlar: baş yüksekliği toplam boyun 1/3'ü, gövde 1,5 baş, nokta göz çapı 6 px (600 tuval), kol kalınlığı 12 px; ten tonları farklı; kıyafet renkleri cinsiyet kodu taşımaz. Sahneler: `onboarding-family` (ebeveyn tablet tutar, iki çocuk avatar daireleriyle yanında), `onboarding-tasks-stars` (çocuk görev kartına tik atar, ebeveynin elinde onay mührü, havada yıldızlar), `onboarding-calendar-notes` (büyük takvim ızgarası + ders programı çipleri + yapışkan not; tarihsiz).
- **Öğretmen** (`illustrations/teacher/`, viewBox 0 0 400 300, aynı karakter oranları): `teacher-share`: ebeveynin telefonundan öğretmene (cinsiyeti nötr, gözlüklü, elinde defter) uzanan kesik çizgili bağlantı; ortada kilit simgeli yuvarlak yıldız rozeti; arkada boş sınıf tahtası. Elma klişesi yok. `-dark` varyantı.
- **Desenler** (`patterns/`, kontursuz düz şekiller): `pattern-confetti` ve `pattern-dots`: 96×96 kusursuz tekrar eden kare (kenarda kesilen şekil karşı kenarda devam eder), tüm şekiller %25 opaklık, düşük yoğunluk, renkler Sarı/Teal/Mercan/Mor/Gök; `header-wave`: 390×120 ve 1024×120 iki varyant, alt kenarı yumuşak dalga olan tek renk şerit, tam opak, fill=currentColor; `confetti-burst`: 400×400 merkezden saçılan ~40 küçük yıldız/çubuk/daire, tam opak; `sparkle`: 24×24 üç noktalı parıltı, fill=currentColor.
- Her klasöre `manifest.json`.

## 11. Faz 2: ödül ikonları (15) ve ruh hali (6)

- **Ödüller** (`icons/rewards/color/` + `mono/`, viewBox 48 + mono 24): her ikonun sol üstünde aynı küçük sarı üç noktalı parıltı; kumar/para çağrışımı, marka ve konsol logosu yok: `reward-screen-time` (tablet + kum saati), `reward-movie-night` (patlamış mısır), `reward-ice-cream`, `reward-park` (salıncak), `reward-late-bedtime` (ay + saat), `reward-toy` (küp bloklar), `reward-book`, `reward-pizza`, `reward-sleepover` (yastık + yıldızlar), `reward-pocket-money` (kumbara + madeni para, rakam yok), `reward-choose-dinner` (kapaklı tabak), `reward-mystery-box` (fiyonklu kutu), `reward-bike-ride`, `reward-game-with-parent` (zar + iki pul), `reward-sticker` (soyulan yıldız çıkartması).
- **Ruh hali** (`moods/`, viewBox 64 renkli + mono 24 kaşsız sade sürüm): tüm yüzler aynı 56 px daire ve göz konumu; yalnız kaş, göz, ağız değişir; zemin duyguya göre: `mood-great` Sarı (kapalı göz gülümseme + iki parıltı), `mood-good` Yeşil, `mood-okay` Gök (düz ağız), `mood-tired` Mor (yarı kapalı göz + üç küçük daire), `mood-sad` Mavi (hafif düşük ağız, gözyaşı yok), `mood-angry` Mercan (çatık kaş, diş yok). Apple/Google emoji kopyası değil; 7 yaş için nazik.
- `manifest.json`.

## Yapılmaması gerekenler

- Bebeksi maskot, pastel «bebek odası» estetiği, kocaman parlak gözler, chibi oranlar.
- İkonları raster teslim etmek; SVG içine bitmap, filtre, mask/clipPath, dış referans, font bağımlılığı.
- Lucide'de olan arayüz ikonlarını (ok, artı, ayarlar, arama, çöp, kalem) yeniden çizmek; Apple/Google giriş düğmelerini çizmek; emoji çizmek.
- App Store ikonunda alfa kanalı, yuvarlatılmış köşe, gölge veya kenar boşluğu; koyu iOS ikonunda opak zemin; Android ön katmanda içeriği güvenli dairenin dışına taşırmak; splash ikonunu tuvali dolduracak kadar büyük çizmek.
- Ruh hali ikonlarında korkutucu ifadeler; ödüllerde para/kumar çağrışımı; gerçek bir çocuğa benzeyen portre.

## Platform kaynakları

- Apple HIG app icons: https://developer.apple.com/design/human-interface-guidelines/app-icons
- Xcode app icon: https://developer.apple.com/documentation/xcode/configuring-your-app-icon
- Android adaptive icons: https://developer.android.com/develop/ui/views/launch/icon_design_adaptive
- Google Play icon specs: https://developer.android.com/distribute/google-play/resources/icon-design-specifications
- Android 12 splash: https://developer.android.com/develop/ui/views/launch/splash-screen
- Expo app icon/splash: https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/
- App Store screenshot specs: https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications

## 12. Odam kaplamaları — UI chrome (üretim)

Klasör `packages/assets/room-chrome/`. Amaç: onaylı ana ekranlardaki (docs/design/room-v2/references/) görünümün **kontrol başına, yazısız, ölçeklenebilir** üretim kaplamaları. Yazı, sayı ve ikonlar uygulamada gerçek metin/bileşen olarak üstüne gelir; bu yüzden hiçbir kaplamada yazı olamaz. Referans ekranlardaki suluboya doku ve ahşap dil korunur; palet BRIEF paletidir.

**Teknik (bu kategoriye özel):**
- Her kaplama SVG kaynak + 3x PNG dışa aktarım (`png/{slug}@3x.png`); dokulu parçalar için PNG esas, SVG mümkün olduğunca sade kalabilir (bu kategoride stil istisnası: yumuşak gölge ve hafif doku serbest, ancak foto-gerçekçilik yok).
- Esneyen parçalar **9-slice** uyumlu: köşe süsleri köşelerde, kenarlar tekrar edebilir/düz; `manifest.json`'a her kaplama için `capInsets {top,left,bottom,right}` (px, @3x) yaz.
- Durumları ayrı dosya: `-pressed` (hafif koyu/az aşağı), `-disabled` (soluk), gerekiyorsa `-selected`.
- İç dolgu (içeriğin oturacağı güvenli alan) manifestte `contentInsets` olarak verilir.

**Çıktılar:**
1. `board-frame` — sol görev panosu: ahşap çerçeve + mantar pano + 2 raptiye süsü (köşelerde); 9-slice.
2. `task-card` — pano içi görev kartı kâğıdı (hafif bantlı/iğneli, krem); `-pressed`; 9-slice.
3. `chip-start` — «Başla» eylem çipi (teal, yuvarlak); `-pressed`, `-disabled`; 9-slice.
4. `status-done` / `status-waiting` / `status-returned` — kartın sağına gelen küçük durum pulları (onaylı tik, bekleyen kum saati, tekrar oku), 48 ızgara.
5. `progress-dot-filled` / `progress-dot-empty` — pano başlığındaki ilerleme noktaları.
6. `ticket-goal` — sağ üst hedef bileti: fişek kenarlı (scalloped) krem bilet + köşelerde yıldız parıltısı; sol ucunda süs deliği; 9-slice; `-empty` varyantı (hedef yokken soluk).
7. `progress-bar-track` / `progress-bar-fill` — bilet içi ilerleme çubuğu parçaları (uçları yuvarlak; fill tekrar edebilir).
8. `week-frame` — Haftam duvar takvimi: ahşap askılı çerçeve + beyaz kâğıt; 9-slice; gün hücre süsü yok (hücreler native).
9. `week-check` / `week-partial` / `week-empty` — gün hücre işaretleri (teal tik, yarım daire, boş halka), 24 ızgara.
10. `shelf-display` — üç yuvalı sergi rafı önü (ahşap); yuva içleri boş; 9-slice yatay.
11. `drawer-front` — «Başardıklarım/Hazinem» çekmece önü: ahşap çekmece + yıldız kulplu; `-pressed`; 9-slice.
12. `pill-star` — üst sağ yıldız sayacı hapı (krem, yıldız ikonlu sol uç); `pill-parent` — Ebeveyn kilidi hapı (açık teal, kilit ikonlu); her ikisi `-pressed`; 9-slice.
13. `header-greeting-underline` — selamlamanın altındaki fırça darbesi süsü (opsiyonel dekor).
14. `panel-generic` — dar ekran dikey akışta aynı dili taşıyan genel kart zemini (krem kâğıt + hafif gölge); 9-slice.
15. `parent-card` — veli ekranı kartı zemin kaplaması (beyaz, yumuşak gölge, 16r); `parent-approval-card` (krem vurgulu); 9-slice.

**Oda sanatı üretimi (aynı PR'da):** `art-candidates` konseptlerinin üretim sürümü: `room-base` (1586×992, boş oda, paletle uyumlu, kenarları temiz) + `character-{unspecified,girl,boy}` (şeffaf, alfa pürüzsüz) `packages/assets/rooms/v2/` altına lossless WebP; ileri temalar için katman ayrımı (zemin/mobilya) mümkünse ayrı dosya.

**Kabul ölçütü:** referans ekran PNG'lerinin yanına, bu kaplamalarla kurulmuş bir `contact-sheet.svg` (kaplamalar boş hâlleriyle ızgarada) + `preview-note.md` (hangi kaplamanın referansın hangi parçasına karşılık geldiği).

## 13. Birebir eşleşme (BRIEF 13)

Onaylı ana ekranlarla birebir eşleşme için eksik dekor, karakter, kaplama ve ödül görselleri: [docs/design/room-v2/CODEX-BRIEF-13-birebir.md](../../docs/design/room-v2/CODEX-BRIEF-13-birebir.md).
