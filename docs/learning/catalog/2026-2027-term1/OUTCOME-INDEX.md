# Öğrenme çıktısı aday dizini

3 Kasım 2026. Bu dizin, mevcut 648 senaryo adayının sınıf/ders/çıktı bağını kaynak hücreleriyle korur. Tam müfredat veya uygulamada etkin resmî senaryo kataloğu değildir. Veritabanına yükleme, AI istemlerine bağlama veya soru yayımlama yapmaz.

## Bu artım

- 62 sınıf–ders grubu, 648 senaryo, 708 çıktı aday kaydı.
- Resmî kod taşımayan 4 kaynak yönergesi ayrı tutuldu; bunlara çıktı kodu uydurulmadı.
- Aynı kapsam ve kodda farklı metin taşıyan 6 kayıt işaretlendi. Bunlar Türk Dili ve Edebiyatında farklı tema bağlamlarıdır; hata oldukları ileri sürülmez. Tema bağının programla eşlenmesi gerekir; ifadeler kaybolmaz ve tek bir tanım seçilmez.
- Önceki 17 senaryo uyarısı ve kaynak seviyesindeki sınıfı çözülemeyen sayfa uyarısı korundu.
- Birden çok çıktıyı kapsayan soru adedi çoğaltılmadı. Senaryo seçimi okul adına yapılmadı.
- Her metin varyantı dosya URL’si, SHA-256, çalışma sayfası, çıktı hücresi, soru adedi hücresi ve senaryo kimliği taşır.

Kimlikler akademik yıl, dönem, sınıf, ders ve koddan deterministik üretilir. Kodsuz kayıtlar kaynak hash’i/sayfası/hücresiyle ayrılır. Kaynak değiştiğinde aynı içerikmiş gibi kabul edilmez. Bütün kayıtlar `pending_source_review` ve `publishable: false` durumundadır. Bu araç onaylı katalogları işleyip yayımlamak için kullanılamaz; onaylı girdi de reddedilir.

## Kaynak kontrolü ve ilk pilot yönü

[MEB 2026–2027 birinci dönem dizini](https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724) ve [5. sınıf geometri program sayfası](https://tymm.meb.gov.tr/ortaokul-matematik-dersi/unite/448?kod=MAB3) yeniden açılarak incelendi. Bu kontrol 708 kaydın tek tek doğrulandığı anlamına gelmez.

İlk içerik pilotu: 5. sınıf Matematik, geometri, 20 özgün soru taslağı. Araç kullanımı, gerekçelendirme ve çizimli yanıtları kapsamalı; her soruya sırf görsel eklemek amaç değildir. Pilotun kod ailesi `MAT.5.3.1`–`MAT.5.3.7`; dönem tablosu aday kimliği `tr-2026-2027-t1-ilkmat2-g5-d6` bir inceleme bağlantısıdır, seçilmiş okul senaryosu değildir. Yedi soruluk bu senaryoyu 20 soruluk havuzla aynı şey olarak sunma.

Eski [5. sınıf kaynak sayfası](https://odsgm.meb.gov.tr/www/5-sinif-matematik/icerik/1275) ile yeni program sayfasında tema sırası/çıktı ifadesi farkları görülebiliyor. Bu nedenle okulun uyguladığı program sürümü ve kaynak tarihi kesinleşmeden yalnız sınıf adına göre “resmî sınava tam uyumlu” etiketi verilmez.

## Tekrar üretme ve test

```sh
python3 scripts/build-curriculum-candidates.py docs/learning/catalog/2026-2027-term1/scenario-candidates.json docs/learning/catalog/2026-2027-term1/outcome-index.json
python3 scripts/test-curriculum-candidates.py
```

9 kontrol: deterministik üretim/kaynak hücreleri, yinelenen senaryo, kaynak hash değişimi, onay durumunu içeri aktarma, metin varyantları, kodsuz yönerge, ortak blok soru adedi, yanlış toplam ve depodaki tüm adaylarla çıktı eşitliği. CI’ye eklendi. JSON girdisi kullanılır; dosyalardaki formüller çalıştırılmaz.

## Açık işler

1. Program sürümü, tema ve okul türü/dal eşlemesi; uyarıların kaynak üzerinden incelenmesi.
2. Pilot 20 sorunun üretimi, cevap anahtarı, puan ölçütü, gerektiğinde ortak görsel/metin ve erişilebilirlik denetimi. **Bu artımda soru üretilmedi.**
3. Katalog/API/AI/sınav kapsamı entegrasyonu ve açık okul senaryosu seçimi.
4. İnsan editoryal onayı, daha sonra yayın. 77 hücre × 20 soru hedefi henüz tamamlanmadı.
