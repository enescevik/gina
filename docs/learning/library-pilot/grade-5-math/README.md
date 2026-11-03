# 5. sınıf Matematik — ilk 20 soruluk özgün taslak havuzu

3 Kasım 2026. **Yayımlanmamış içerik pilotu.** Bu dosyalar bir uygulama ekranı maketi, tamamlanmış kütüphane entegrasyonu veya resmî okul yazılısı değildir. Gerçek aile/çocuk verisi kullanılmadı. Ücretli bir AI sağlayıcısı çağrılmadı.

## Pakette ne var?

- `pilot.json`: 20 açık uçlu soru; beklenen cevap, çözüm, her biri dört puanlık bağımsız ölçütler, olası yanılgı ve sonraki çalışma önerisi. Çizim, şema tarifi ve yazı alternatifleri.
- `student.json` / `student.html`: yalnız öğrenciye gösterilecek soru, ortak bağlam ve görsel bilgileri. Çözüm, cevap anahtarı, puanlama veya AI değerlendirme bilgisi içermez.
- `review.html`: cevap ve ölçütleri de gösteren editoryal inceleme çıktısı. Öğrenci istemcisine dağıtılmamalı.
- `assets/`: sekiz özgün matematik diyagramının düzenlenebilir SVG kaynağı ve sRGB PNG karşılığı. Manifest ölçüleri, hash’leri ve geometrik parametreleri içerir. SVG içindeki harf/sayılar soru verisidir; uygulama arayüzü yazısı değildir.
- `review-sample.png`, `student-phone.png`: yerel içerik görüntüleyicisinden kanıt. Uygulamaya entegre ekran veya fiziksel cihaz testi sayılmaz.

Öğrenci çıktısı ayrı dosyadır; bu klasörün tamamı bir öğrenci uygulamasına veya herkese açık web köküne kopyalanmaz. Yerel inceleme için klasörden `python3 -m http.server 8776 --bind 127.0.0.1` ile açılabilir.

## Öğrenme kapsamı

| Çıktı adayı | Soru | Ölçülen yön |
|---|---|---|
| MAT.5.3.1 | 2, 3 | Araç seçimi, hizalama gerekçesi ve şematik temsil |
| MAT.5.3.2 | 1, 6 | Temel çizim özellikleri ve açı kolunun uzunluğu |
| MAT.5.3.3 | 4, 5 | Yerleştirilmiş açıölçeri okuma ve yanlış diziyi fark etme |
| MAT.5.3.4 | 7, 8, 9 | Kesişen doğrularda açı ilişkisi ve karşı örnek |
| MAT.5.3.5 | 10, 11, 12 | Kapalı sınır, doğru parçaları ve çokgen oluşturma |
| MAT.5.3.6 | 13, 14, 15, 16 | Düzgün çokgen, köşegen ve üçgen açıları |
| MAT.5.3.7 | 17, 18, 19, 20 | Kesişen çemberlerden üçgen ve yarıçap gerekçesi |

Bu kodların görünmesi bütün çıktının ölçüldüğü anlamına gelmez. Örneğin çizimi yazıyla tarif etmek gerçek pergel/gönye kullanımı kanıtı değildir. İki açıölçer sorusu da aracı fiziksel olarak doğru yerleştirme becerisini ölçmez. Zorluklar editoryal tahmindir; yaş/sınıf örnekleminde kalibre edilmedi.

[MEB program sayfası](https://tymm.meb.gov.tr/ortaokul-matematik-dersi/unite/448?kod=MAB3), sayfada görünen 4 Eylül 2026 güncellemesiyle incelendi. Dış bükey şekiller kullanıldı; köşegen sayısı formülü ve üçgen dışındaki çokgenlerin iç açı toplamı sorulmadı. [2026–2027 dönem dizini](https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724) ve yerel `ilkmat2.xlsx` adayının yedi koduna bağlantı var; tekil soru eşlemesi ve okulda uygulanan sürüm hâlâ alan incelemesi bekler. Soru metinleri mevcut sınavlardan kopyalanmadı.

## Ortak kaynak ve ölçme kararları

14 soru görsel bağlam kullanır; altısı görsel olmadan çözülebilir. Sekiz kaynak kaydı aynı metin/görselin soru başına bağımsız kopyalanmasını önler. İnceleme HTML’si her soruyu tek başına değerlendirebilmek için kaynağı tekrar gösterir; bu, uygulama ekranına önerilen bir düzen değildir.

18 ve 20. sorulardaki farklı çember ölçüleri için ilk şekil yeniden kullanılmadı; her duruma geometrisi doğru ayrı görsel üretildi. Sorular önceki sorunun cevabını girdi olarak istemez. Ancak aynı bağlamdaki yakın sorular bağımsız öğrenme kanıtı gibi sayılmamalı; `evidence_unit` ilişkisi korunmalı. Özellikle açıölçerin yanlış okumasını açıklayan soru önceki okumaya ipucu verebilir; bunlar teşhis/pratik grubu olarak ele alınmalı, bağımsız sınav maddeleri gibi rastgele dağıtılmamalı.

20 soru bir havuzdur; çocuğa tek oturumda 20 soruyu zorunlu kılma kararı yoktur. Eksik yanıt, düşük yeterlilik veya kişilik yargısı değildir. Yazı güzelliği ve motor hassasiyet puanlanmaz; eşdeğer çözümler kabul edilir. Öneri metinleri öğretmen/veli tarafındadır, sınav sırasında otomatik ipucu değildir.

## Görsel kabul

Tüm şekiller sayısal parametrelerle çizildi. Açıölçerin ışın açısı, çember yarıçapları/merkez uzaklıkları ve üçgenin kesişim noktaları gerçek SVG koordinatları üzerinden doğrulanır. Telefonda küçük sayıların okunması için açıölçer `minimum_reading_width: 640` taşır; yerel görüntüleyici yatay kaydırma ve tam boy açmayı destekler. Uygulama aktarımı da aynı okunabilirliği/zoom olanağını sağlamadan tamamlanmış sayılmaz. Ekrandan fiziksel santimetre ölçümü istenmez. Görsellere metin karşılıkları eklendi; uzman erişilebilirlik incelemesi henüz yapılmadı.

## Tekrar üretme ve kontrol

```sh
node scripts/render-learning-pilot.mjs
python3 scripts/validate-learning-pilot.py
python3 scripts/test-learning-pilot.py
```

18 teknik kontrol: taslak/yayın sınırı, kaynak ve sınıf eşleşmesi, uydurma çıktı kodu, yinelenen kimlik, eksik cevap, puan toplamı, açı/üçgen hesapları, yanlış varyant resmi, soru-cevap bağımlılığı, öğrenciye anahtar sızması, değiştirilmiş görsel ve paket dışı yol. CI’ye eklendi. Kontroller insan alan/dil incelemesinin yerine geçmez; matematiksel sayısal meta veriler, şekil ve taslak metinler ayrıca okunarak gözden geçirildi.

## Entegrasyondan önce kalanlar

1. Matematik alan editörü: soru/çıktı eşlemesi, Türkçe, kısmi puan ve görsel yeterliliği. `human_editorial_approval` boş kalır; teknik test sonucu onaya çevrilmez.
2. Ortak kaynakları ve görselleri bütünlük içinde taslak kütüphaneye aktarma. Mevcut tekil `library_question` normalleştirmesi bu ilişkileri taşımaz; ona doğrudan beslenmez.
3. Erişim/paket hakları, kaynak silinmesi, sabit soru sürümleri ve tekrar güvenli aktarım; öğrenciye yalnız öğrenci projeksiyonu.
4. Gerçek Prova, çözüm defteri, inceleme ve AI değerlendirme akışlarında telefon/tablet testi. Sonra insan onaylı yayın; TestFlight en son.

77 sınıf–ders hücresinde 1.540 soru hedefinin yalnız ilk 20 taslağı hazırlandı. Diğer 1.520 soru ve tüm sınıfların okul/program eşlemesi tamamlanmadı.
