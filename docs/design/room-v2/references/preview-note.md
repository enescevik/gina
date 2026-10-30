# BRIEF 13 — Entegrasyon ve görsel kontrol

Bu teslim uygulama kodu içermez. Onaylı hedefler `child-home-approved.png` ve `parent-home-approved.png`; parça montajı `brief-13-montage.html`. Metin, rakam ve sayaçlar native kalır.

## Kaynak seçimi

Boyalı kaplamalarda manifest `file` alanındaki PNG görsel kaynaktır. `legacyVectorFallback` BRIEF 12 uyumluluk çizimidir; yeni PNG ile görsel eşdeğer değildir. Yeni basit çubuk/zaman çizelgesi/butonların SVG kaynakları `vectorSource` alanında. SVG içine bitmap gömülmez. Eski sürümler `previous/brief-12/` içinde; `supersedes` dosya ve SHA-256 verir.

## Yerleşim sözleşmesi

`capInsets`, `contentInsets` ve `contentRegions` kaynak PNG pikselidir (@3x). Native dp için üçe böl. Köşeleri sabit tut, yalnız orta şeritleri uzat; `minimumLogicalSize` altına inme. `stretch: horizontal` parçalarında yükseklik doğal yüksekliğe orantılı kalmalı. Basılı/pasif görseller aynı kaynaktan renk modülasyonu ile üretilmiştir; boyut ve alfa birebirdir.

Pano `contentRegions.header` ve `.tasks` bölgeleri arasında ahşap ara çıta taşır. Görev kartındaki pin ayrı katmandır. Biletin `leftReward/rightReward/nativeText` bölgeleri birbirine karışmaz. `cabinet-display` tek ayaklı gövdedir: eski `shelf-display` ve `drawer-front` ile beraber çizme. Sergi nesnelerini rafta, native adlarını `plaque` üstüne koy. Eski madalyalar Koleksiyonum içinde kalır.

Oda koordinatları 1586×992. Karakter ve hayvanların `contentBounds`, kaynak `groundLine`, ortak `sceneAnchor`, `sceneFitBox` ve `placement` formülü manifestte. Şeffaf tuvalin altını ayak çizgisi sanma. Dört hayvan aynı kutuya contain edilir, aynı zemine hizalanır. `none` seçeneğinde hiçbir hayvan çizilmez. Sunny/explorer/nature temaları aynı taban ve ankrajları kullanır; tema dekoru ayrı katmandır.

Avatar seçimindeki mevcut slug kimliklerini değiştirme. Yeni `avatar-reference-girl/boy` yalnız maketteki örnek çocuklardır; mevcut profil seçimlerinin üzerine yazma. Mevcut SVG avatarlar korunmuştur.

## Claude uygulama sırası

1. Manifestleri okuyup PNG/WebP kaynaklarını uygulamanın yerel asset kayıtlarına ekle. Mevcut `generate-illustrated` betiği avatar/oda kategorilerini kapsamıyorsa açık kayıt ekle; bu PR uygulama dosyalarını üretmez.
2. Oda, karakter, seçilebilir hayvan, pano, bilet, takvim, dolap ve giriş etiketlerini ayrı katmanlarda kur. React Native dokunma alanları ve native metinler bunların üstüne gelsin.
3. Veli başlık sahnesini, resimli avatarları, grup ikonunu, zaman çizelgesini, iç boşlukları dar kartları, kitaplı insight kartını ve konturlu butonu bağla.
4. Onaylı ekran boyutlarında gerçek uygulama ekran görüntüsü alıp referansla yan yana karşılaştır. Bu asset PR’sı mobil entegrasyonun veya piksel eşitliğinin kabulü değildir.

## Tüm yeni/değişen parça eşlemesi

| Kategori | Slug | Üretim dosyası |
|---|---|---|
| room-chrome | `board-frame` | `packages/assets/room-chrome/png/board-frame@3x.png` |
| room-chrome | `task-card` | `packages/assets/room-chrome/png/task-card@3x.png` |
| room-chrome | `task-card-pressed` | `packages/assets/room-chrome/png/task-card-pressed@3x.png` |
| room-chrome | `chip-start` | `packages/assets/room-chrome/png/chip-start@3x.png` |
| room-chrome | `chip-start-pressed` | `packages/assets/room-chrome/png/chip-start-pressed@3x.png` |
| room-chrome | `chip-start-disabled` | `packages/assets/room-chrome/png/chip-start-disabled@3x.png` |
| room-chrome | `ticket-goal` | `packages/assets/room-chrome/png/ticket-goal@3x.png` |
| room-chrome | `ticket-goal-empty` | `packages/assets/room-chrome/png/ticket-goal-empty@3x.png` |
| room-chrome | `week-frame` | `packages/assets/room-chrome/png/week-frame@3x.png` |
| room-chrome | `pill-star` | `packages/assets/room-chrome/png/pill-star@3x.png` |
| room-chrome | `pill-star-pressed` | `packages/assets/room-chrome/png/pill-star-pressed@3x.png` |
| room-chrome | `pill-parent` | `packages/assets/room-chrome/png/pill-parent@3x.png` |
| room-chrome | `pill-parent-pressed` | `packages/assets/room-chrome/png/pill-parent-pressed@3x.png` |
| room-chrome | `parent-card` | `packages/assets/room-chrome/png/parent-card@3x.png` |
| room-chrome | `parent-approval-card` | `packages/assets/room-chrome/png/parent-approval-card@3x.png` |
| room-chrome | `cabinet-display` | `packages/assets/room-chrome/png/cabinet-display@3x.png` |
| room-chrome | `parent-insight-card` | `packages/assets/room-chrome/png/parent-insight-card@3x.png` |
| room-chrome | `pin-blue` | `packages/assets/room-chrome/png/pin-blue@3x.png` |
| room-chrome | `pin-red` | `packages/assets/room-chrome/png/pin-red@3x.png` |
| room-chrome | `pin-teal` | `packages/assets/room-chrome/png/pin-teal@3x.png` |
| room-chrome | `plaque` | `packages/assets/room-chrome/png/plaque@3x.png` |
| room-chrome | `tag-hanging` | `packages/assets/room-chrome/png/tag-hanging@3x.png` |
| room-chrome | `progress-bar-teal-track` | `packages/assets/room-chrome/png/progress-bar-teal-track@3x.png` |
| room-chrome | `progress-bar-teal-fill` | `packages/assets/room-chrome/png/progress-bar-teal-fill@3x.png` |
| room-chrome | `timeline-dot-filled` | `packages/assets/room-chrome/png/timeline-dot-filled@3x.png` |
| room-chrome | `timeline-dot-empty` | `packages/assets/room-chrome/png/timeline-dot-empty@3x.png` |
| room-chrome | `timeline-line` | `packages/assets/room-chrome/png/timeline-line@3x.png` |
| room-chrome | `button-outline` | `packages/assets/room-chrome/png/button-outline@3x.png` |
| room-chrome | `parent-filter-chip` | `packages/assets/room-chrome/png/parent-filter-chip@3x.png` |
| room-chrome | `pill-parent-disabled` | `packages/assets/room-chrome/png/pill-parent-disabled@3x.png` |
| room-chrome | `pill-star-disabled` | `packages/assets/room-chrome/png/pill-star-disabled@3x.png` |
| room-chrome | `plaque-pressed` | `packages/assets/room-chrome/png/plaque-pressed@3x.png` |
| room-chrome | `plaque-disabled` | `packages/assets/room-chrome/png/plaque-disabled@3x.png` |
| room-chrome | `tag-hanging-pressed` | `packages/assets/room-chrome/png/tag-hanging-pressed@3x.png` |
| room-chrome | `tag-hanging-disabled` | `packages/assets/room-chrome/png/tag-hanging-disabled@3x.png` |
| room-chrome | `task-card-disabled` | `packages/assets/room-chrome/png/task-card-disabled@3x.png` |
| room-chrome | `ticket-goal-pressed` | `packages/assets/room-chrome/png/ticket-goal-pressed@3x.png` |
| room-chrome | `ticket-goal-disabled` | `packages/assets/room-chrome/png/ticket-goal-disabled@3x.png` |
| room-chrome | `button-outline-pressed` | `packages/assets/room-chrome/png/button-outline-pressed@3x.png` |
| room-chrome | `button-outline-disabled` | `packages/assets/room-chrome/png/button-outline-disabled@3x.png` |
| room-chrome | `parent-filter-chip-pressed` | `packages/assets/room-chrome/png/parent-filter-chip-pressed@3x.png` |
| room-chrome | `parent-filter-chip-disabled` | `packages/assets/room-chrome/png/parent-filter-chip-disabled@3x.png` |
| room-chrome | `week-grid` | `packages/assets/room-chrome/png/week-grid@3x.png` |
| room-chrome | `button-teal` | `packages/assets/room-chrome/png/button-teal@3x.png` |
| room-chrome | `button-teal-pressed` | `packages/assets/room-chrome/png/button-teal-pressed@3x.png` |
| room-chrome | `button-teal-disabled` | `packages/assets/room-chrome/png/button-teal-disabled@3x.png` |
| rooms/v2 | `character-girl` | `packages/assets/rooms/v2/character-girl.webp` |
| rooms/v2 | `character-boy` | `packages/assets/rooms/v2/character-boy.webp` |
| rooms/v2 | `character-unspecified` | `packages/assets/rooms/v2/character-unspecified.webp` |
| rooms/v2 | `room-base` | `packages/assets/rooms/v2/room-base.webp` |
| rooms/v2 | `family-group` | `packages/assets/rooms/v2/family-group.webp` |
| rooms/v2 | `parent-header-scene` | `packages/assets/rooms/v2/parent-header-scene.webp` |
| rooms/v2 | `parent-insight-book` | `packages/assets/rooms/v2/parent-insight-book.webp` |
| rooms/v2 | `pet-cat-portrait` | `packages/assets/rooms/v2/pet-cat-portrait.webp` |
| rooms/v2 | `pet-cat` | `packages/assets/rooms/v2/pet-cat.webp` |
| rooms/v2 | `pet-dog-portrait` | `packages/assets/rooms/v2/pet-dog-portrait.webp` |
| rooms/v2 | `pet-dog` | `packages/assets/rooms/v2/pet-dog.webp` |
| rooms/v2 | `pet-lion-portrait` | `packages/assets/rooms/v2/pet-lion-portrait.webp` |
| rooms/v2 | `pet-lion` | `packages/assets/rooms/v2/pet-lion.webp` |
| rooms/v2 | `pet-monkey-portrait` | `packages/assets/rooms/v2/pet-monkey-portrait.webp` |
| rooms/v2 | `pet-monkey` | `packages/assets/rooms/v2/pet-monkey.webp` |
| gamification/illustrated-v3 | `reward-book` | `packages/assets/gamification/illustrated-v3/reward-book.webp` |
| gamification/illustrated-v3 | `reward-choose-dinner` | `packages/assets/gamification/illustrated-v3/reward-choose-dinner.webp` |
| gamification/illustrated-v3 | `reward-ice-cream` | `packages/assets/gamification/illustrated-v3/reward-ice-cream.webp` |
| gamification/illustrated-v3 | `reward-late-bedtime` | `packages/assets/gamification/illustrated-v3/reward-late-bedtime.webp` |
| gamification/illustrated-v3 | `reward-movie-night-left` | `packages/assets/gamification/illustrated-v3/reward-movie-night-left.webp` |
| gamification/illustrated-v3 | `reward-movie-night-right` | `packages/assets/gamification/illustrated-v3/reward-movie-night-right.webp` |
| gamification/illustrated-v3 | `reward-mystery-box` | `packages/assets/gamification/illustrated-v3/reward-mystery-box.webp` |
| gamification/illustrated-v3 | `reward-park` | `packages/assets/gamification/illustrated-v3/reward-park.webp` |
| gamification/illustrated-v3 | `reward-pizza` | `packages/assets/gamification/illustrated-v3/reward-pizza.webp` |
| gamification/illustrated-v3 | `reward-pocket-money` | `packages/assets/gamification/illustrated-v3/reward-pocket-money.webp` |
| gamification/illustrated-v3 | `reward-screen-time` | `packages/assets/gamification/illustrated-v3/reward-screen-time.webp` |
| gamification/illustrated-v3 | `reward-sleepover` | `packages/assets/gamification/illustrated-v3/reward-sleepover.webp` |
| gamification/illustrated-v3 | `reward-toy` | `packages/assets/gamification/illustrated-v3/reward-toy.webp` |
| gamification/illustrated-v3 | `display-bookworm` | `packages/assets/gamification/illustrated-v3/display-bookworm.webp` |
| gamification/illustrated-v3 | `display-bronze` | `packages/assets/gamification/illustrated-v3/display-bronze.webp` |
| gamification/illustrated-v3 | `display-diamond` | `packages/assets/gamification/illustrated-v3/display-diamond.webp` |
| gamification/illustrated-v3 | `display-early-bird` | `packages/assets/gamification/illustrated-v3/display-early-bird.webp` |
| gamification/illustrated-v3 | `display-first-task` | `packages/assets/gamification/illustrated-v3/display-first-task.webp` |
| gamification/illustrated-v3 | `display-gold` | `packages/assets/gamification/illustrated-v3/display-gold.webp` |
| gamification/illustrated-v3 | `display-math-star` | `packages/assets/gamification/illustrated-v3/display-math-star.webp` |
| gamification/illustrated-v3 | `display-silver` | `packages/assets/gamification/illustrated-v3/display-silver.webp` |
| gamification/illustrated-v3 | `reward-bike-ride` | `packages/assets/gamification/illustrated-v3/reward-bike-ride.webp` |
| gamification/illustrated-v3 | `reward-game-with-parent` | `packages/assets/gamification/illustrated-v3/reward-game-with-parent.webp` |
| gamification/illustrated-v3 | `reward-sticker` | `packages/assets/gamification/illustrated-v3/reward-sticker.webp` |
| gamification/illustrated-v3 | `display-helper` | `packages/assets/gamification/illustrated-v3/display-helper.webp` |
| gamification/illustrated-v3 | `display-locked` | `packages/assets/gamification/illustrated-v3/display-locked.webp` |
| gamification/illustrated-v3 | `display-tidy` | `packages/assets/gamification/illustrated-v3/display-tidy.webp` |
| gamification/illustrated-v3 | `display-tooth-care` | `packages/assets/gamification/illustrated-v3/display-tooth-care.webp` |
| gamification/illustrated-v3 | `display-week-hero` | `packages/assets/gamification/illustrated-v3/display-week-hero.webp` |
| avatars/illustrated-v3 | `avatar-spiky` | `packages/assets/avatars/illustrated-v3/avatar-spiky.webp` |
| avatars/illustrated-v3 | `avatar-adult-beard` | `packages/assets/avatars/illustrated-v3/avatar-adult-beard.webp` |
| avatars/illustrated-v3 | `avatar-adult-glasses` | `packages/assets/avatars/illustrated-v3/avatar-adult-glasses.webp` |
| avatars/illustrated-v3 | `avatar-adult-long` | `packages/assets/avatars/illustrated-v3/avatar-adult-long.webp` |
| avatars/illustrated-v3 | `avatar-adult-short` | `packages/assets/avatars/illustrated-v3/avatar-adult-short.webp` |
| avatars/illustrated-v3 | `avatar-afro` | `packages/assets/avatars/illustrated-v3/avatar-afro.webp` |
| avatars/illustrated-v3 | `avatar-astronaut` | `packages/assets/avatars/illustrated-v3/avatar-astronaut.webp` |
| avatars/illustrated-v3 | `avatar-beanie` | `packages/assets/avatars/illustrated-v3/avatar-beanie.webp` |
| avatars/illustrated-v3 | `avatar-braids` | `packages/assets/avatars/illustrated-v3/avatar-braids.webp` |
| avatars/illustrated-v3 | `avatar-bun` | `packages/assets/avatars/illustrated-v3/avatar-bun.webp` |
| avatars/illustrated-v3 | `avatar-cap` | `packages/assets/avatars/illustrated-v3/avatar-cap.webp` |
| avatars/illustrated-v3 | `avatar-curly` | `packages/assets/avatars/illustrated-v3/avatar-curly.webp` |
| avatars/illustrated-v3 | `avatar-default` | `packages/assets/avatars/illustrated-v3/avatar-default.webp` |
| avatars/illustrated-v3 | `avatar-glasses` | `packages/assets/avatars/illustrated-v3/avatar-glasses.webp` |
| avatars/illustrated-v3 | `avatar-headband` | `packages/assets/avatars/illustrated-v3/avatar-headband.webp` |
| avatars/illustrated-v3 | `avatar-hearing-aid` | `packages/assets/avatars/illustrated-v3/avatar-hearing-aid.webp` |
| avatars/illustrated-v3 | `avatar-parent-default` | `packages/assets/avatars/illustrated-v3/avatar-parent-default.webp` |
| avatars/illustrated-v3 | `avatar-reference-boy` | `packages/assets/avatars/illustrated-v3/avatar-reference-boy.webp` |
| avatars/illustrated-v3 | `avatar-reference-girl` | `packages/assets/avatars/illustrated-v3/avatar-reference-girl.webp` |
| avatars/illustrated-v3 | `avatar-wavy` | `packages/assets/avatars/illustrated-v3/avatar-wavy.webp` |

## Contact sheets

- `packages/assets/room-chrome/contact-sheet.html` (açık/koyu alfa kontrolü).
- `packages/assets/rooms/v2/contact-sheet.html` (açık/koyu alfa kontrolü).
- `packages/assets/gamification/illustrated-v3/contact-sheet.html` (açık/koyu alfa kontrolü).
- `packages/assets/avatars/illustrated-v3/contact-sheet.html` (açık/koyu alfa kontrolü).

## Görsel doğruluk sınırı

Boyalı parçalar referans rehberli ayrı üretimlerdir; referansın piksel kesitleri değildir. Pano perspektifi, bilet köşe süsleri, karakter yüz/saç ayrıntısı ve veli başlık sahnesinin kompozisyonu referanstan farklılaşabilir. Yan yana montaj bu farkları saklamaz. Native metinler eklendikten sonra son uygulama karşılaştırması ve ürün sahibi kabulü gerekir.

## BRIEF 13 kapsam kontrolü

- A: Sehpa/kalemlik/kitaplar, kareli yatak ucu, iki kenar bitki/koltuk, duvar kartları, kedi fotoğrafı/teal çanta/sarmaşık, pencere/perde, puf/yastık ve halı oda tabanında. Pano/bilet/takvim/dolap, karakter ve hayvan tabanda değil.
- B: Üç karakter; kızda düz küt saç, beyaz çiçekli mercan kazak, teal kitap ve beyaz çorap. Ortak sahne zemin çizgisi.
- C: Ara çıtalı pano ve iki içerik bölgesi, yırtık kâğıt ve üç pin, asılı başla etiketi, teal çubuk, dolgulu bilet ve iki ödül yuvası, takvim/ızgara/tik, tek dolap/plaka, iki üst hap, asılı giriş etiketi.
- D: 15 ödül türü için 16 görsel (sinema çifti); 13 rozet için ayaklı sergi nesnesi. Eski madalyalar korunur.
- E: Veli başlık sahnesi, 18 mevcut avatar kimliği + 2 örnek portre, grup ikonu, zaman çizelgesi, kitaplı insight kartı, artılı konturlu buton ve dar içerik boşlukları.
- Hayvanlar: Dört gövde (768×512), dört portre (256×256); ortak sahne ankrajı ve `none` seçeneği.

## Doğrulama

110 güncel varlık için dosya/hash/boyut/alfa/contentBounds ve manifest kontrolleri geçti. 20 pressed/disabled varyantın alfa kanalı ve kapak geometrisi tabanıyla aynı. 80 ayrı resimli kaynak üretildi; kalanlar basit SVG kontrolleri ve deterministik durum varyantları. Contact sheet ve montajlar tarayıcıda gerçek dosyalardan oluşturuldu. OCR yalnız yardımcı kontroldür; görsel tarama ile birlikte kullanıldı. Uygulama koduna veya `apps/mobile` dosyalarına dokunulmadı.

Statik çıktılar: `brief-13-compare-child.webp`, `brief-13-compare-parent.webp`; yalnız parçalar: `brief-13-montage-child.webp`, `brief-13-montage-parent.webp`. Her kategoride `contact-sheet.webp` bulunur.
