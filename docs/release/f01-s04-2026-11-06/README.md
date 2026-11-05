# F01 + S04 gece çalışması — 6 Kasım 2026

Araştırma/plan ajanı (Claude Fable 5.1), dal `worktree-agent-a492076f84208d9e9`, taban main `5ef5cd3` (≥ `de969c1`). 23:24 → 23:50 Europe/Istanbul. **Yalnız `docs/` değişti**; kod, migration, UI, üretim verisi, AI/ödeme/sosyal ağ hizmeti dokunulmadı. Main'e push edilmedi; koordinatör birleştirir.

## Üretilenler

| Dosya | Ne |
|---|---|
| [`docs/F01-SOCIAL-AND-NEXT-PROPOSALS.md`](../../F01-SOCIAL-AND-NEXT-PROPOSALS.md) | Ebeveyn konu odaları pilot planı (katılım, takma ad, gönderi modeli, çocuk verisi uyarıları, raporla/engelle, moderasyon+itiraz SLA, saklama, KVKK/5651 `[AVUKAT]` soruları, kişisel verisiz ölçüm, pilot ölçütü ve otomatik durdurma) + 5 ayrı öneri (QR eşleme, otomatik tatil önerisi, geleceğe planlı eğitim geçişi, 5.000+ duyuru kuyruğu, katalog araması) her biri kapsam/maliyet/bağımlılık/risk ve MEVCUT / AYRI KARAR / 3B SONRASI etiketiyle. DM ve okul grupları ayrı karar. Sonda **16 numaralı karar**. |
| [`docs/learning/catalog/education-calendars/tr-2026-2027.json`](../../learning/catalog/education-calendars/tr-2026-2027.json) | Türkiye 2026–2027 takvimi: ülke × 4 kademe + 5 il kaydı, resmî/dini tatiller, kademe ve sınıf→yaş; her kayıtta `source_url`, `published_at`, `checked_at`, `confidence`. `calendar_value` alanları `validate_education_calendar` kurallarına göre yerel betikle doğrulandı (8/8). |
| [`docs/learning/catalog/education-calendars/README.md`](../../learning/catalog/education-calendars/README.md) | Kaynak listesi, şema uyumu, il tablosu, doğrulanamayanlar, ürün kuralı/veri ayrımı, "yayımlanmadı / yönetim onayı gerekir". |
| [`docs/learning/catalog/subject-synonyms.json`](../../learning/catalog/subject-synonyms.json) | 32 kanonik ders kimliği (12 mevcut `guided_input_options` + 20 öneri), 260 eşanlamlı, sınıf kapsamı (TTKB 2025/04 ve 2025/05), eşleştirme politikası önerisi, 17 örnek, 4 açık soru. |

## Commit'ler (bu dalda, main üzerine)

1. `74e6ad9` docs(S04): 2026-2027 MEB takvimi, il örnekleri ve ders eşanlamlıları başlangıç verisi
2. `b14efc7` docs(F01): sosyal alan pilotu ve sonraki ürün önerileri — plan ve karar dosyası
3. (bu dosya) docs(release): F01+S04 gece raporu

## Kaynaklar

**14 kaynak**, hepsi resmî (meb.gov.tr, 5 il MEM, tegm/ttkb, Diyanet, mevzuat), tamamı 5 Kasım 2026'da erişildi ve URL'leriyle JSON `sources` dizisinde:

- MEB haber 41057 (13.06.2026) ve Genelge 2026/70 (19.08.2026, PDF 9 sayfa — metin katmanı çıkarıldı)
- İl takvimleri: İstanbul (PDF), Ankara (Ağustos ve Eylül sürümleri — fark yalnız kurul günleri), Sivas (PDF), Kastamonu (PDF), Düzce (DOCX)
- Diyanet 2027 dini günler ve resmî tatil listeleri; 2429 sayılı Kanun (metin indirilmedi, atıf)
- Okul Öncesi ve İlköğretim Kurumları Yönetmeliği m.5 ve m.11 (kayıt yaşı; il takviminin valilik onayıyla yürürlüğe girmesi)
- TTKB 09/05/2025 Sayı 04 (ilkokul–ortaokul çizelgesi) ve Sayı 05 (Anadolu Lisesi çizelgesi)

Haber siteleri yalnız arama yönlendirmesi için kullanıldı; hiçbir tarih haber kaynağından alınmadı.

## Doğrulanamayanlar / sınırlar

- **Düzce** il takvimi ders yılı başlangıcını 7 Eylül 2026 gösteriyor (MEB: 14 Eylül) ve "01 Eylül 2025" kalıntısı içeriyor → `confidence: low`, `calendar_value: null`, yayımlanmaz; il MEM teyidi gerekir. Gerçek "çelişen bölge bildirimi" test örneği.
- **Sivas** yıl sonu satırı PDF düzeninden tek başına okunamadı → `medium`; ulusal tarih varsayıldı.
- **İzmir** il takvim sayfası aramada bulunamadı; 5 il ile "en az 3 il" koşulu aşıldı.
- 2027 köprü/idari izin kararı henüz yok. Fen/Sosyal Bilimler/MTAL/AİHL çizelgeleri okunmadı. Gerçek okul listesi üretilmedi (uydurma yasağı); il/ilçe `education_places` kayıtları da üretilmedi.
- MEB SSS sayfası (özel okul istisnası) 580k karakter; önceki belgedeki atıf korundu, yeniden okunmadı.
- Üretim DB'sine hiçbir takvim/ders kimliği girilmedi, yayımlanmadı. İthal yönetici işidir (README'de adımlar).

## Enes'in kararları

F01 belgesi §9'daki 16 karar + subject-synonyms `open_questions_for_enes` (4). En acil üçü:

1. Sosyal pilot açılsın mı; açılırsa 5651/rıza `[AVUKAT]` cevabı ve X01 (SMTP/e-posta doğrulama) ön koşul mu?
2. Takvim dönem modeli: 4 parça (ara tatiller `outside_term` uyarısı verir — tohum böyle) mi, 2 dönem mi?
3. 20 yeni `subject-*` kimliği migration'la eklensin mi; eşleme her zaman veli onaylı mı?

## Kalan sınır

F01 ve S04 araştırma/plan kısmı **TAMAM** (plan teslimi). S04'ün yönetimden gerçek ithal ve yayını, U05/P02 ile seçim/kapsam kabulü ve sunucu araması **AÇIK** kalır; F01 kapanışı Enes'in karar kaydıyla olur. 06:15 sınırından çok önce bitirildi; yeni iş açılmadı.
