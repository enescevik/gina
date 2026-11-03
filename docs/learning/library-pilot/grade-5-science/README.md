# 5. sınıf Fen Bilimleri — gökyüzü çalışma havuzu

3 Kasım 2026. **20 özgün, yayımlanmamış açık uçlu soru taslağı.** Bu bir uygulama ekranı maketi veya resmî okul sınavı değildir. Üretim kaydı değiştirilmedi; ücretli AI çağrısı yapılmadı. Teknik kontrol ve yazarın kendi içerik kontrolü, bağımsız alan editörü onayının yerine geçmez.

## İçerik

- `pilot.json`: sorular, cevaplar, çözüm, dört bağımsız ölçütlü puanlama, olası yanılgılar ve sonraki çalışma önerileri.
- `student.json` / [öğrenci önizlemesi](student.html): cevap/puanlama alanları çıkarılmış ayrı içerik.
- [Editör önizlemesi](review.html): cevapları ve ölçütleri içerir; çocuğa veya genel dosya deposuna verilmez.
- `assets/`: dört özgün, kodla çizilmiş SVG ve sRGB PNG; ölçü/hash kayıtlı manifest. Harfler ve etiketler soru verisidir, uygulama arayüzü yazısı değildir. Başka kurumun görseli kullanılmadı.
- İki metin kaynağı: süre karşılaştırması ve varsayımsal eksik gözlem kaydı. Metin kaynağına yapay bir görsel eklenmedi.
- [Telefon örneği](student-phone.png) ve [cevap/puanlama örneği](review-sample.png): yerel içerik görüntüleyicisinden; uygulama içi/native kabul testi değildir.

## Kapsam ve kaynaklar

[MEB'in 5. sınıf Fen Bilimleri ilk ünite sayfası](https://tymm.meb.gov.tr/fen-bilimleri-dersi/unite/367) 3 Kasım 2026'da incelendi. Sayfada görülen güncel `FB.5.1.2`, `FB.5.1.3`, `FB.5.1.4` kodları kullanıldı; daha eski beş parçalı kodlar otomatik eş anlamlı sayılmadı. Bu kodlar yalnız **eşleme adayıdır**.

| Çıktı adayı | Sorular | Kanıtın sınırı |
|---|---|---|
| FB.5.1.2 | 1–6 | Hareketten çıkarım, süreleri ayırma, gözlem verisinin sınırları; gerçek uzun süreli gözlem değildir. |
| FB.5.1.3 | 7–15 | Evre temsili, model önerme/düzeltme; fiziksel modeli gerçekten kurma becerisini bütünüyle ölçmez. |
| FB.5.1.4 | 16–20 | Göreli büyüklük ve hareket modelinin gerekçesi; gerçek çap/uzaklık ölçeği veya yıllık ders kapsamı değildir. |

Yerel 2026–2027 dönem dizinindeki `tr-2026-2027-t1-fen3_2-g5-e6` adayı aynı üç kodu içerir. Kaynak: [MEB dağılım dizini](https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724), `fen3_2.xlsx`, SHA-256 `f01e0f96328e6c766776cd1e4dad760923a31331e701ce906b59eef359b75a3c`. Bu yedi soruluk adayın okulca seçildiği veya havuzun o sınav olduğu ileri sürülmez; `school_scenario_selection` boştur. İlk ünitedeki Güneş hakkında bilgi toplama çıktısı ve yılın diğer üniteleri bu paketle tamamlanmış sayılmaz.

Bilimsel kavram kontrolünde [NASA evre açıklaması](https://science.nasa.gov/moon/moon-phases/) ve [Ay bilgileri](https://science.nasa.gov/moon/facts/) kullanıldı: yansıyan ışık, görünen aydınlık alan, eşzamanlı dönme/dolanma ve yaklaşık 27,3/29,5 gün ayrımı. Soru metinleri ve şemalar özgündür; kaynak soru veya resim kopyalanmadı.

## İnceleme kararları

- Birlikte kullanılan kaynaklar soru başına bağımsız görsel kopyası değildir. Hiçbir soru önceki cevabı girdi olarak istemez; buna rağmen yakın maddeler birbirine ipucu verebilir. Özellikle dört evre kartına bağlı sorular bağımsız sınav kanıtları gibi rastgele ayrılmamalı; pratik/teşhis grubu olarak incelenmeli.
- Dönme şemasında sabit yüzey işareti her konumda Dünya'ya bakar. Işık şemasında dört Ay modelinin Güneş tarafı aydınlıktır. Gölgelenme/eğim çizilmediği açıkça belirtilir; her hizalanma tutulma gibi gösterilmez.
- Dört evre kartı telefonda birlikte görülebilsin diye iki satırdır. Diğer ayrıntılı şemalar 520 px asgari okuma genişliği taşır; yerel önizleme yatay kaydırma ve tam boy açmayı destekler. Native soru/defter/kitapçıkta okunabilirlik ayrıca kabul edilmelidir.
- Renk tek bilgi taşıyıcısı değildir: harf, konum, aydınlık/koyu alan ve metin karşılığı vardır. Ekran okuyucu uzman incelemesi henüz yapılmadı; betimlemenin görevin yanıtını ne ölçüde kolaylaştırdığı ayrıca değerlendirilmeli.
- Çizim ve yazılı açıklama kabul edilir. Yazı güzelliği, çizgi hassasiyeti veya hız puanlanmaz. Boş yanıttan genel öğrenme/kişilik sonucu çıkarılmaz. Her ölçüt ayrı 1 puandır; bir yanlış diğer doğru ölçütleri götürmez.
- Ay tutulması adı 15. soruda bilgi olarak verilir; çocuktan programa ek bir terimi önceden bilmesi beklenmez. Bu maddenin sınıf uygunluğu yine alan incelemesindedir.

## Tekrar üretme ve kabul

```sh
node scripts/render-library-draft.mjs docs/learning/library-pilot/grade-5-science
python3 scripts/test-library-draft.py
python3 scripts/prepare-library-import.py --folder docs/learning/library-pilot/grade-5-science --output /tmp/gina-science-request.json
python3 scripts/test-library-draft-roundtrip.py --folder docs/learning/library-pilot/grade-5-science --template gina_prova_builder_audit
python3 scripts/build-library-coverage.py --check
```

20 yeni teknik test, 18 eski Matematik testi ve üç aktarım hazırlayıcı testi geçti. Kod/sürüm, kaynak ilişkisi, cevap alanları, puan toplamı, öğrenci/öğretmen ayrımı, görsel hash ve model geometrisi kontrol edilir. Bunlar serbest metindeki bütün bilimsel veya dilsel hataları otomatik yakalayan bir sistem değildir.

Gerçek 20 soru ayrı geçici veritabanına aktarıldı: öğrenci/öğretmen/meta veri alanları, altı kaynak ve dört PNG baytları geri okundu ve birebir karşılaştırıldı. Aynı istek ikinci paket oluşturmadı. İşlem geri alındı, geçici veritabanı silindi; editör incelemesi veya yayın kaydı oluşturulmadı. [Doğrulama kaydı](verification.json).

Sıradaki kabul: alan/dil/erişilebilirlik incelemesi, onaylanan içerikle uygulama içi öğrenci–defter–veli inceleme–kitapçık ve rızalı AI akışı. Bu paket TestFlight veya üretime dağıtılmadı. [Gerçek dosyalardan hesaplanan kapsam](../coverage.json): 77 sınıf–ders hedefinde 40 taslak, 0 onaylı/yayımlanmış, 1500 henüz yazılmamış soru. Yirmi soru bulunması dersin bütün yılını kapsamak demek değildir.
