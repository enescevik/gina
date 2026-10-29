# Gina görsel varlıkları

Bu paket Gina'ya özgü tüm çizimleri taşır: marka, avatarlar, görev/ders/etkinlik ikonları, oyunlaştırma, illüstrasyonlar, mağaza görselleri. Arayüz "chrome" ikonları (ok, artı, ayarlar, arama, çöp, kalem, takvim gezinme, kullanıcı, çıkış, bildirim, göz, kilit) **Lucide**'den gelir (`lucide-react-native` / `lucide-react`); burada yeniden çizilmez.

Codex (veya başka bir üretici) bu klasöre yazar; her kategori ayrı bir PR'dır. Tam prompt metinleri ve stil rehberi proje dokümanının "Codex için tasarım brief'i" sekmesindedir; aşağıdaki kurallar o brief'in özetidir ve çelişki olursa bu dosya geçerlidir.

## Klasör yapısı

```
packages/assets/
├─ brand/            # logo-mark.svg, logo-wordmark.svg, ios/, android/, splash/, web/, email/, og-image.png
├─ avatars/          # avatar-{slug}.svg (12 çocuk + varsayılan + 5 yetişkin)
├─ icons/
│  ├─ tasks/{color,mono}/     # görev ikonları (66)
│  ├─ subjects/{color,mono}/  # ders ikonları (19)
│  ├─ events/{color,mono}/    # etkinlik türü ikonları (20)
│  ├─ app/{color,mono}/       # uygulama içi özel ikonlar (14)
│  └─ rewards/{color,mono}/   # ödül ikonları (Faz 2)
├─ gamification/{stars,streaks,badges,stamps,loading}/
├─ illustrations/{states,onboarding,teacher}/
├─ patterns/
├─ store/            # mağaza arka planları (PNG, alfa yok)
└─ moods/            # ruh hali ikonları (Faz 2)
```

Her klasörde bir `manifest.json` bulunur:

```json
[
  {
    "slug": "brush-teeth",
    "label_tr": "Dişlerini fırçala",
    "file": "color/brush-teeth.svg",
    "viewBox": "0 0 48 48",
    "variants": ["color", "mono"],
    "png": []
  }
]
```

## Ortak kurallar (özet)

1. Özgün ve telifsiz çizim; flat 2B; tek stil. Gradyan, 3D, gölge, parlama, doku, fotogerçekçilik yok.
2. Görselde hiç yazı, harf, rakam yok (tek istisna: path'e çevrilmiş `logo-wordmark`).
3. Şeffaf arka plan (mağaza görselleri ve `ios-icon-light` hariç). Kontur Ink `#1F2937`, round linecap/linejoin.
4. Palet: Teal `#0FA3A3` (koyu `#0B7F7F`, açık `#D9F4F2`), Yıldız Sarısı `#F5B301`, Mercan `#FF6B6B`, Mavi `#4D7CFE`, Yeşil `#2FB47C`, Mor `#8B5CF6`, Turuncu `#FF9F43`, Gök `#38BDF8`, Krem `#FFF8EF`, Mist `#E5E7EB`, Beyaz. Açık tonlar: Teal `#D9F4F2`, Mavi `#E3EAFF`, Mercan `#FFE9E9`, Yeşil `#E6F7EF`, Mor `#EFE9FE`, Turuncu `#FFF1E3`, Gök `#E4F5FE`. Rozet metalleri: Bronz `#C9823A`, Gümüş `#B8C2CC`, Altın `#F5B301`, Elmas `#38BDF8`. Palet dışı renk yok; ikon başına en fazla 1 vurgu rengi.
5. SVG teknik: her varlık ayrı dosya, `viewBox` zorunlu; `<text>`, `<style>`, CSS class, `filter`, `mask`, `clipPath`, gradient, `<use>`/dış referans, gömülü bitmap, script ve font **yok** (react-native-svg ile birebir render edilir); id'ler `<slug>-` önekiyle; svgo ile optimize; dosya adları küçük harf kebab-case.
6. İkon konturu: renkli ikonlar `viewBox 0 0 48 48`, `stroke-width 2.5`; mono varyant ayrıca `viewBox 0 0 24 24`'te `stroke 2` ile çizilip dolguya çevrilir (`fill="currentColor"`, stroke yok). 2 px güvenli kenar boşluğu; en küçük detay 2 px.
7. Cinsiyet renk kodu/işareti yok. Türkiye bağlamı: sarı Amerikan okul otobüsü, posta kutusu, Noel/Halloween motifi, elma = öğretmen klişesi, ülke bayrağı, dini sembol yok; sağlık için nötr artı. Marka/telifli öğe, emoji kopyası, gerçek kişiye benzeyen portre, kumar/para çağrışımı yok.
8. Teslim: dosyalar belirtilen klasöre; `manifest.json` güncellenir; PNG istenen kategoriler (brand, store) dışında rasterize edilmez (PNG'yi repo script'i üretir); her kategoride 8 ikonu 24 px ve 48 px'te yan yana gösteren `contact-sheet.svg`.

## Üretim sırası

| Sıra | Kategori | Ne zaman |
| --- | --- | --- |
| 1 | `brand/` ikon, logo, splash, favicon, bildirim ikonu | 1. hafta |
| 2 | `avatars/` | 1. hafta |
| 3 | `icons/tasks/` önce MVP 30, sonra kalan 36 | 1-2. hafta |
| 4 | `icons/subjects/` | 2. hafta |
| 5 | `icons/events/` | 2. hafta |
| 6 | `gamification/` | 2. hafta |
| 7 | `illustrations/states/` | 2-3. hafta |
| 8 | `icons/app/` | 3. hafta |
| 9 | `store/` | 3. hafta |
| 10 | `illustrations/onboarding/`, `illustrations/teacher/`, `patterns/` | 3. hafta / Faz 2 |
| 11 | `icons/rewards/`, `moods/` | Faz 2 |

Uygulama tarafında `app.json`'un istediği ikon/splash PNG'leri `apps/mobile/assets/images/` altına kopyalanır; kaynak her zaman buradadır.
