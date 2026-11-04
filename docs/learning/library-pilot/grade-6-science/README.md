# 6. sınıf Fen Bilimleri — gökyüzü ve hareket taslak havuzu

4 Kasım 2026. **20 özgün açık uçlu taslak; 0 bağımsız alan editörü onayı, 0 yayın.** Ücretli sağlayıcı çağrısı yapılmadı. Bu havuz yıllık ders kapsamı, seçilmiş okul senaryosu veya tek oturumluk sınav değildir.

## Dosyalar ve önizleme

- `pilot.json`: sorular, kaynak bağı, cevaplar, çözüm, dört ayrı 1 puanlık ölçüt, olası yanılgı ve sonraki adım.
- [Öğrenci görünümü](student.html), `student.json`: cevap/çözüm/rubrik/doğrulama alanları bulunmaz.
- [Editör görünümü](review.html): cevaplı **özel inceleme belgesi**; öğrenciye veya genel dosya deposuna sunulmaz.
- `assets/`: dört özgün SVG ve sRGB PNG; hash, ölçü, köken ve okuma genişliği `manifest.json` içindedir. Etiketler sorunun verisidir; uygulama kontrolü değildir. Kaynaklardan soru/görsel kopyalanmadı.
- [Telefon: gezegen panosu](student-phone.png), [telefon: kuvvet şeması yatay kaydırma](student-forces-phone.png), [kuvvet ve puanlama](review-forces.png), [yol karşılaştırması](review-routes.png), [tutulma ve puanlama](review-eclipses.png).
- `source-verification.json`: okunan program sayfalarının hash’leri ve dönem kaynağı hücreleri. `verification.json`: teknik kabulün sınırları.

Görüntüler yerel HTML içerik önizlemesidir; uygulama ekranı veya fiziksel cihaz kabulü değildir. 390 px telefonda gezegen tablosu yatay kaydırmadan sığar. Diğer şemalar 520 px asgari okuma genişliğinde kaydırılabilir; tam boy açma ve açıklayıcı alt metin vardır. Sayfanın kendisinde yatay taşma yoktur. Editör görüntüleri 1280 px tarayıcıda tam soru kartı olarak alınmıştır.

## Müfredat ve kaynak sınırı

[Güncel Güneş sistemi programı](https://tymm.meb.gov.tr/fen-bilimleri-dersi/unite/409) ile [kuvvet/hareket programı](https://tymm.meb.gov.tr/fen-bilimleri-dersi/unite/410) 4 Kasım 2026’da okundu. Program adları eşleme adayıdır; teknik kontrol alan onayı yerine geçmez.

| Çıktı adayı | Sorular | Ölçülen bölüm |
|---|---|---|
| FB.6.1.1 | 1–4 | Verilen nitelikleri sınıflandırma, iddiayı sınama, yakınlık sırası |
| FB.6.1.3 | 5–8 | Sıralama/gölge ilişkisi, kanıt ve modelin sınırları |
| FB.6.2.1 | 9–12 | Aynı doğrultudaki kuvvetlerin bileşkesi ve dengeleyici |
| FB.6.2.2 | 13–14 | Kurgusal veri yorumlama ve deney planı; gerçek deney performansı değil |
| FB.6.2.3 | 15–20 | Yol, yer değiştirme, zaman ve yön üzerinden nitel sürat/hız karşılaştırması |

Dönem dağılım adayının kimliği `tr-2026-2027-t1-fen3_2-g6-g6`: `fen3_2.xlsx`, `6. sınıf` sayfası, `G6` başlığı; çıktı hücreleri `C7`, `C9`, `C11`, `C12`, `C13`. Kaynak SHA-256: `f01e0f96328e6c766776cd1e4dad760923a31331e701ce906b59eef359b75a3c`. [MEB dağılım dizini](https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724). Bu altı soruluk senaryo **seçilmedi** ve 20 soruluk sınava dönüştürülmedi; yalnız kaynak kodları çapraz kontrol edildi.

FB.6.2.3’te sayısal sürat/hız hesabı, grafik okuma ve birim dönüştürme istenmez. Toplam yolculuk ortalaması ile anlık hareket ayrımı nitel örneklerle ele alınır; bunun sınıf/dil uygunluğu editörce ayrıca incelenmelidir. Bileşke kuvvet bölümünde N cinsinden toplama/çıkarma vardır. Gezegenlerin uydu sayıları sorulmaz.

Bilimsel bilgi kontrolü için [NASA gezegen özeti](https://science.nasa.gov/solar-system/planets/), [dört dev gezegenin halkaları](https://science.nasa.gov/resource/ring-king/) ve [tutulma türleri](https://science.nasa.gov/eclipses/types/) kullanıldı. Gazsal dış gezegen üst grubunda gaz/buz devi ayrımı açıklanır; gezegenlerin bütünüyle gaz olduğu söylenmez. Tutulma şemaları yalnız sıralamayı gösterir, gölgeler çizilmemiştir ve ölçekli model değildir. Çocuklardan Güneş gözlemi istenmez.

## İçerik ve puanlama

- Beş ortak kaynak tekil kimlikle tutulur. 1–3, 5–6, 9–12 ve 15/19 kendi ortak kaynaklarına bağlıdır; önceki sorunun cevabı gerekmez. Aynı kaynaktan gelen yakın maddeler bağımsız yeterlilik kanıtı sayılmaz; birbirine ipucu verebilme etkisi editörce incelenir.
- Dört ölçüt bağımsız puanlanır. Bir hesap hatası diğer doğru açıklamaları otomatik sıfırlamaz. Eşdeğer yazılı/çizimli bilimsel açıklamalar kabul edilir; hız ve güzel yazı puanlanmaz.
- 13–14. sorularla deney yapılmış sayılmaz. 15–20. sorulardaki geometrik doğrulama yalnız üretim aracının kontrolüdür; öğrenciye hesap yaptırmaz.
- Zorluklar editoryal tahmindir; psikometrik kalibrasyon yapılmadı. Boş cevap yetersizlik tanısı değildir.
- Testler belli bilimsel/sayısal sonuçları, şemanın yön/sıra geometrisini ve paket sınırlarını denetler. Her cümlenin, rubriğin veya müfredat eşlemesinin pedagojik doğruluğunu ispatlamaz.

## Teknik kabul

```sh
node scripts/render-library-draft.mjs docs/learning/library-pilot/grade-6-science
python3 scripts/test-library-science6.py
python3 scripts/test-library-math6.py
python3 scripts/test-library-draft.py
python3 scripts/test-learning-pilot.py
python3 scripts/test-library-import-preparer.py
python3 scripts/build-library-coverage.py --check
python3 scripts/test-library-draft-roundtrip.py --folder docs/learning/library-pilot/grade-6-science --template gina_completion_audit
```

27 yeni kontrol; mevcut 22 Matematik6, 20 Fen5, 18 Matematik5 ve üç aktarım testi geçti. Saptanan örnek hatalar: ters kuvvet oku, değişmiş gezegen sırası, yanlış gölge hedefi, sürat/hız karışması, yanlış ortak kaynak, öğrenciye cevap sızıntısı ve sahte onay/yayın işareti.

Ayrı geçici DB klonunda 20 soru, beş kaynak ve dört PNG bütün alanları/baytlarıyla geri okunup karşılaştırıldı; aynı istek ikinci paket yaratmadı. İşlem geri alındı, klon kaldırıldı; editör onayı/yayın oluşturulmadı. Mobil tip ve lint kontrolü de geçti; mobil kod değiştirilmedi.

## Açık işler

Alan/dil/erişilebilirlik incelemesi, gerçek uygulama soru/defter/kitapçık akışı ve fiziksel cihaz kabulü açık. Toplam havuz [coverage.json](../coverage.json): 77 sınıf–ders hücresinde **80 taslak**, **1460 yazılmamış**, **0 bağımsız onay**, **0 yayın**. TestFlight 17 ve üretim değişmedi.
