# Eğitim takvimleri — doğrulanmış başlangıç verisi (S04)

5–6 Kasım 2026 gece çalışması. Kaynak commit: main `de969c1`. Bu klasördeki veri **taslaktır; yönetimden girilip yayımlanmadan ürüne etki etmez.** Üretim DB'sine hiçbir şey tohumlanmadı.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `tr-2026-2027.json` | Türkiye 2026–2027 çalışma takvimi: ülke × 4 kademe (okul öncesi, ilkokul, ortaokul, lise), 5 il örneği (İstanbul, Ankara, Sivas, Kastamonu, Düzce), resmî/dini tatiller, kademe ve sınıf→yaş eşlemesi, 14 kaynak. |
| `../subject-synonyms.json` | TR ders adı/kısaltma → kanonik ders kimliği önerisi (32 ders kimliği — 12 mevcut, 20 öneri — 260 eşanlamlı; normalizasyon sonrası kimlikler arası çakışma yok, belirsizlikler `candidates` ile bilinçli), sınıf kapsamı, eşleştirme politikası önerisi. |

## Şema uyumu

`supabase/migrations/20261105060000_education_calendars.sql` içindeki `gina.validate_education_calendar(jsonb)` yalnız şu alanları kabul eder: `title`, `source_url` (https), `verified_on`, `starts_on`, `ends_on`, `terms[1..8]{title,starts_on,ends_on}`; dönemler sıralı ve çakışmasız; `starts_on` yılı = `academic_year`. Her kaydın **`calendar_value`** alanı bu kurallara göre yerelde doğrulandı (8/8 geçti; Düzce bilinçli olarak `null`). Diğer alanlar (`breaks`, `local_days`, `public_holidays`, `confidence`, `published_at`, `notes`) yönetici bağlamıdır, RPC'ye gönderilmez.

Ara tatiller şemada ayrı bir kavram olmadığı için dönemler **4 parça** olarak modellendi (1. dönem ara tatile kadar / sonrası, 2. dönem ara tatile kadar / sonrası). Böylece `preview_education_calendar` ara tatildeki tarih için `outside_term`, yıl dışı için `outside_year`, yıl başından 14 gün sonrası yeni-yıl geçişi için `outside_transition` uyarısı üretir. Alternatif (2 dönem + ara tatilleri dönem içinde sayma) ürün kararıdır; bkz. F01 karar listesi.

## Ulusal tarihler (MEB, 13 Haziran 2026 haberi + 19 Ağustos 2026 Genelge 2026/70)

| Olay | Tarih |
|---|---|
| Öğretmen mesleki çalışmaları | 1 Eylül 2026 Salı (il takvimlerinde 1–11 Eylül) |
| Okul öncesi ve 1. sınıf uyum eğitimi | 7–11 Eylül 2026 |
| Ders yılı başlangıcı | **14 Eylül 2026 Pazartesi** |
| 1. dönem ara tatili | 16–20 Kasım 2026 |
| 1. dönem sonu | 22 Ocak 2027 Cuma |
| Yarıyıl tatili | 25 Ocak – 5 Şubat 2027 |
| 2. dönem başlangıcı | 8 Şubat 2027 Pazartesi |
| 2. dönem ara tatili | 8–12 Mart 2027 (Ramazan Bayramı 8 Mart 13.00 – 11 Mart içine düşer) |
| Ders yılı sonu | **25 Haziran 2027 Cuma** |
| Yıl sonu mesleki çalışma | 28–30 Haziran 2027 (il takvimleri) |

Resmî tatiller (2429 sayılı Kanun; Diyanet 2027 listesi): 28 Ekim 13.00 – 29 Ekim 2026; 1 Ocak 2027 Cuma; Ramazan Bayramı 8 Mart 13.00 – 11 Mart 2027; 23 Nisan 2027 Cuma; 1 Mayıs 2027 Cumartesi; Kurban Bayramı 15 Mayıs 13.00 – 19 Mayıs 2027 (17–19 Mayıs ders günü değil); 19 Mayıs 2027 Çarşamba. Köprü/idari izin kararları Resmî Gazete'de çıkınca eklenir.

## İl örnekleri

| İl | Yayın | Ulusalla fark | Güven | Not |
|---|---|---|---|---|
| İstanbul | 20.07.2026 (güncelleme 31.07) | Yok | yüksek | 6 Ekim İstanbul'un Kurtuluşu tören günü, tatil değil. |
| Ankara | Ağustos ve Eylül 2026 (iki sürüm) | Yok | yüksek | İki sürüm arasında yalnız kurul/zümre günleri değişti → il takvimi yayından sonra da revize edilebilir. |
| Sivas | 14.08.2026 | Yok (yıl sonu satırı metinden tek başına okunamadı) | orta | PDF görsel teyidi önerilir. |
| Kastamonu | 10.09.2026 | Yok | yüksek | 16 Nisan 2027 satırı yalnız yoğunlaştırılmış meslek liseleri için. |
| Düzce | 31.08.2026 (DOCX) | **Ders yılı başlangıcı 7 Eylül 2026 ve mesleki çalışma 1–4 Eylül yazıyor**; belgede "01 Eylül 2025 Salı" kalıntısı var | düşük | Yayımlanmaz; il MEM teyidi bekler. Gerçek "çelişen bölge bildirimi" test verisi. |

Sonuç: incelenen 5 ilin 4'ü ulusal takvimle **birebir aynı**. Bu yıl için il bazlı takvim yayımlamak zorunlu değil; il/ilçe yerleri (`education_places.kind='region'`) açılır, takvim ancak fark çıkarsa yayımlanır. Özel okul ve kampüs takvimleri (MEB SSS: valilikçe kabul edilen ayrı çalışma takvimi) okul kapsamında ayrı yayınla girilir; bu klasörde özel okul verisi **yok** çünkü okul listesi uydurulmaz.

## Kademeler ve yaş (Okul Öncesi Eğitim ve İlköğretim Kurumları Yönetmeliği m.11, 2019 değişikliği)

- Okul öncesi: eylül sonu itibarıyla 57–68 ay (yer varsa 36–56 ay). İlkokul kaydı ertelenen 69–71 aylıklara öncelik.
- İlkokul 1: eylül sonu itibarıyla 69 ayını dolduranlar; 66–68 ay veli isteğiyle; 69–71 ay veli isteğiyle bir yıl erteleme.
- Ortaokul 5–8, lise 9–12 (hazırlık sınıfı olan okullarda +1 yıl).
- Sınıf→yaş JSON'da **yaklaşık** aralık olarak verildi. Ürün yaşından sınıf tahmin etmez; veli seçer.

Haberlerde geçen "72 aya çıkarma" planı yürürlükte değildir; dosyaya alınmadı.

## Ders eşanlamlıları (`../subject-synonyms.json`)

- Kanonik kimlikler mevcut `guided_input_options` `subject-*` kimlikleriyle aynı; eksik dersler `proposed: true` ile öneri (DKAB, İnkılap, Beden, Görsel Sanatlar, Müzik, Bilişim, Teknoloji-Tasarım, Trafik, Sağlık Bilgisi ve Trafik Kültürü, İHVD, Rehberlik, Felsefe, Almanca/Fransızca, dinî seçmeliler, "Seçmeli ders (diğer)").
- Sınıf kapsamı TTKB 09/05/2025 Sayı 04 (ilkokul–ortaokul) ve Sayı 05 (Anadolu Lisesi) çizelgelerinden; ÖDSGM katalog etiketleri (`İlköğretim Matematik`, `Din Kültürü ve Ahlak Bilgisi`…) ve `gina.curriculum_subject()` katlaması ile uyumlu.
- Bilinçli belirsizlikler: `Sosyal` (4–7 Sosyal Bilgiler / 9+ Sosyal Bilim Çalışmaları), `Fen` (9+ Fizik/Kimya/Biyoloji), `Din` (DKAB / Kur'an / Siyer / TDB), `Yabancı Dil` (İng/Alm/Fra). Politika önerisi: tek aday bile olsa veli onayıyla bağla; sessiz otomatik bağlama yok.

## Ürün kuralları (veri değil; S04 kabul maddeleri)

Bunlar JSON'a yazılmaz, uygulama davranışıdır ve çoğu mevcut şemada zaten vardır:

1. **Özel okul/bölge önceliği:** aynı yıl ve kademede en özel yayımlanmış takvim kazanır (`gina.education_calendar_match`, `education_ancestors` derinliğe göre). Okul > ilçe > il > ülke.
2. **Bilinmeyen okul:** veli bölge seçip okul adını yazar; isim benzerliğiyle otomatik eşleme yok, GPS yok; takvim yoksa `calendar_missing` açıkça söylenir ve gerekçeyle devam edilir.
3. **Tarih dışı gerekçeli seçim:** `outside_year`/`outside_term`/`outside_transition` uyarısında gerekçe zorunlu (`school_calendar` için ≥10 karakter açıklama); yıl sınırı hatırlatması tek kez.
4. **Otomatik sınıf yükseltme yok:** takvim yılı veya yarıyılı sınıf değiştirmez; yıl sonu hatırlatması yalnız gözden geçirme önerir.
5. **Tek günlük tatil programı silmez:** resmî/dini bayram ve il tören günleri `terms`'e işlenmez; ilk aşamada hedefli duyuruyla iletilir. Otomatik yeniden planlama ayrı iş (F01 önerisi).
6. **Bölge bildirimi ortak takvimi değiştirmez:** veli raporu kuyruğa düşer, ekip doğrular; yayın ayrı işlemdir.

## Doğrulanamayanlar / açık kalanlar

- Düzce başlangıç tarihi (yukarıda).
- Sivas yıl sonu satırı (PDF düzeni; ulusal varsayıldı, orta güven).
- İzmir il takvimi aramada bulunamadı (il sitesinde doğrudan sayfa yok); İstanbul/Ankara/Sivas/Kastamonu/Düzce ile "en az 3 il" koşulu aşıldı.
- Fen Lisesi, Sosyal Bilimler Lisesi, MTAL, AİHL ve ÇYDEM ortaokulu çizelgeleri okunmadı; ders kapsamı yalnız Anadolu Lisesi ve standart ilkokul–ortaokul.
- 2429 sayılı Kanun metni indirilmedi; Diyanet listesindeki atıf ve il takvimlerindeki saatler kullanıldı.
- 2027 köprü tatili / idari izin kararı yok.
- `education_places` için il/ilçe/okul kayıtları üretilmedi (uydurma okul listesi yasağı). İl adları yalnız bu dosyada referans olarak var.

## Yayımlanmadı / yönetim onayı gerekir

- Bu dosyadaki hiçbir takvim üretim `education_calendars` tablosuna girilmedi, yayımlanmadı.
- ~~`guided_input_options`'a yeni ders kimliği eklenmedi (migration yok).~~ 6 Kasım S04 uygulaması: `20261106180000_subject_catalog_and_calendar_seed.sql` 20 kimliği ve eşanlamlı tablosunu ekler; eşleşme `suggest_subject` ile her zaman veli onaylı. Rapor: [s04-catalog-2026-11-06](../../../release/s04-catalog-2026-11-06/README.md).
- İthal artık tek adımlı: yönetim `education-calendars` → "Taslak içe aktar (kaynaklı)" (veya `scripts/import-education-calendar-draft.mjs`) bu dosyadan yalnız **taslak** üretir; Düzce atlanır, yeni il yerleri gizli açılır, yayın yine ayrı işlemdir.
- İthal akışı: yönetici `education-calendars` sayfasında ülke yerini seçer, kademe/yıl girer, `calendar_value` alanlarını aktarır, **kaydeder**, önizlemeden sonra ayrı işlemle **yayımlar**. Dört kademe için dört ayrı kayıt gerekir (şema `unique(place_id,stage,academic_year)`).
- Yeniden kontrol tarihi: Ocak 2027 (yarıyıl öncesi) ve Resmî Gazete'de idari izin kararı çıkınca.
