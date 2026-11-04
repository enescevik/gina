# 6. sınıf Matematik — sayılar ve veri taslak havuzu

4 Kasım 2026. **20 özgün açık uçlu taslak; 0 bağımsız editör onayı, 0 yayın.** Ücretli sağlayıcı çağrısı yapılmadı. Bu paket tek oturumluk sınav, yıllık ders kapsamı veya seçilmiş okul senaryosu değildir.

## Dosyalar

- `pilot.json`: kaynaklar, sorular, cevap/çözüm, dört ayrı puan ölçütü, yanılgı ve sonraki adım.
- [Öğrenci önizlemesi](student.html), `student.json`: öğretmen cevabı, rubrik, çözüm ve doğrulama alanları çıkarılmıştır.
- [Editör önizlemesi](review.html): cevaplı özel inceleme belgesidir; öğrenciye veya genel dosya deposuna sunulmaz.
- `assets/`: üç özgün SVG, sRGB PNG ve hash/ölçü/yerleşim manifesti. Etiketler soru verisidir. Dışarıdan soru veya görsel kopyalanmadı.
- [Telefon örneği](student-phone.png), [rota ve puanlama](review-route.png), [veri ve puanlama](review-data.png): yerel içerik önizlemesi; uygulama/native cihaz testi değildir.
- [Doğrulama kaydı](verification.json): teknik kabul, gerçek alan incelemesinden ayrı.

## Kaynak ve eşleme sınırı

[Güncel sayılar teması](https://tymm.meb.gov.tr/ortaokul-matematik-dersi/unite/457) ve [istatistik teması](https://tymm.meb.gov.tr/ortaokul-matematik-dersi/unite/461) 4 Kasım 2026'da okundu. Soru metinleri özgündür; programdaki öğrenme çıktıları eşleme adayı olarak kullanılır.

| Çıktı adayı | Sorular | Burada ölçülen bölüm |
|---|---|---|
| MAT.6.1.5 | 1–4 | Basamak, kesirle çözümleme, karşılaştırma ve yer tutucu sıfır |
| MAT.6.1.6 | 5–7 | Paylaşım, sonlu/devirli ayrımı, bir örüntüyü açıklama |
| MAT.6.1.7 | 8–12 | Kesir/ondalık/yüzde ile gerekçeli problem çözme |
| MAT.6.1.8 | 13–15 | Ortak birim, ölçüm başlangıcı ve uzunluk kararı |
| MAT.6.5.1 | 16–20 | Hazır kurgusal veri, özet, karar ve araştırma planı |

Mevcut 2026–2027 dönem kaynağı: `ilkmat2.xlsx`, `6.sınıf` sayfası, `I6` başlığı, `I12:I16` dağılımı. Aday kimliği `tr-2026-2027-t1-ilkmat2-g6-i6`; SHA-256 `d5429b5962a08adc04acd71ceaae2d517bca507f8b4cf94354bcd55a9670aebf`. [MEB dağılım dizini](https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724). Paket bu yedi soruluk senaryonun sınavı değildir; senaryo seçimi boştur. Kaynağın “İlköğretim Matematik” adı yalnız bilinen “Matematik” eşdeğeriyle eşlenir.

Eski bazı resmî belgelerde MAT.6.1.7 / MAT.6.1.8 sırası farklıdır. Bu pakette güncel program sayfası ile saklı dönem kaynağının aynı sırası kullanılır. Eski kodun aynı metin olduğu varsayılmaz. Okul/yıl uygulanabilirliği ve tüm madde eşlemeleri alan editörünün incelemesini bekler.

## İçerik kararları

- 1 ve 3 aynı ölçüm tablosuna; 16–18 aynı kurgusal veri grafiğine bağlıdır. Kaynak tek dosyadır. Hiçbir soru önceki cevabı gerektirmez; yakın soruların birbirine ipucu verebileceği editörce değerlendirilmelidir.
- 19. soru araştırma **planını** sorar; gerçekten veri toplamayı ölçtüğünü iddia etmez. 14. soru gerçek cetvel kullanmanın yerine geçmez. Veri veya okuma miktarıyla çocuklara kişilik/başarı sıralaması yapılmaz.
- Şemalar ölçekli değildir. 13. soruda etiketler esas alınır; rota rengi alt metindeki yol sırasıyla da açıklanır. Metinle yanıt, çizimle yanıtla eşit kabul edilir.
- Ölçüm tablosu ve nokta grafiği telefon genişliğine sığar. Ayrıntılı rota 520 px asgari okuma genişliğinde yatay kaydırılır; tam boy açma vardır. Native soru/defter/kitapçık ve ekran okuyucu kabulü ayrıca gerekir.
- Her soruda dört ayrı 1 puanlık ölçüt vardır. Hesap hatası sonrası tutarlı yöntemi incelemek gerekir; aynı hata bütün ölçütleri otomatik sıfırlamaz. Yazı güzelliği ve hız ölçüt değildir.
- Sayısal sonuçlar tam kesir aritmetiğiyle bağımsız hesaplanır. Ortanca/sıklık/ortalama ortak grafiğin verisinden türetilir. Teknik kontrol bütün serbest metnin veya rubriğin pedagojik doğruluğunun garantisi değildir.

## Tekrar üretme ve kabul

```sh
node scripts/render-library-draft.mjs docs/learning/library-pilot/grade-6-math
python3 scripts/test-library-math6.py
python3 scripts/test-library-draft.py
python3 scripts/test-learning-pilot.py
python3 scripts/test-library-import-preparer.py
python3 scripts/build-library-coverage.py --check
python3 scripts/test-library-draft-roundtrip.py --folder docs/learning/library-pilot/grade-6-math --template gina_completion_audit
```

22 yeni teknik test, önceki 20 Fen +18 Matematik +3 aktarım testi geçti. Son aktarım ayrı geçici DB klonundadır: 20 soru, dört ortak kaynak ve üç PNG'nin tüm alanları/baytları geri okunup karşılaştırıldı; yinelenen istekte tek paket kaldı. İşlem geri alındı, klon silindi. Yayın veya inceleme kaydı yaratılmadı.

İlk havuz toplamı [coverage.json](../coverage.json) içinde gerçek dosyalardan hesaplanır: 77 sınıf/ders hedefinde 60 taslak; 1480 henüz yazılmamış, 0 onaylı/yayımlanmış. Sıradaki kabul alan/dil/erişilebilirlik incelemesi ve onaylı içerikle fiziksel cihaz akışıdır. TestFlight veya üretim değişmedi.
