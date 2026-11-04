# Prova — gerçek arayüz kabul turu, 4 Kasım 2026

Bu tur yeni, sentetik bir aileyle yapıldı. Mevcut aileler ve demo kayıtları
kullanılmadı/değiştirilmedi. Üretim Supabase hizmetlerine bağlanan web istemcisi
kullanıldı; düzeltmeler yerelde üretim derlemesi ve gerçek `_headers` CSP kurallarıyla
sunuldu. Bu, fiziksel iPhone/iPad veya Android kabulünün yerine geçmez.

## Bulunan ve giderilen hatalar

- Yayındaki webde çizim ekleme başarısızdı. İşlenmiş resmin `blob:` adresine yapılan
  `fetch`, `connect-src` tarafından engelleniyordu. Expo ImageManipulator'ın doğrudan
  base64 çıktısı okunuyor; CSP gevşetilmedi, native dosya okuma yolu korundu.
- Defter yazısı sunucuya kaydedilmesine rağmen gösterge “Cevabın kaydediliyor…”
  durumunda kalıyordu. Editör, şema doğrulama ve jsonb aynı nesnenin alanlarını farklı
  sıraya koyabiliyor. Cevap karşılaştırması nesne alan sırasından bağımsız yapılıyor;
  eleman/çizgi noktası dizilerinin sırası ve daha yeni düzenlemeler korunuyor.
- Soru listesi yüklenirken sorular “artık erişilebilir değil” diye gösteriliyordu.
  Yükleniyor, yükleme hatası ve gerçekten eksik soru durumları ayrıldı.
- Görseli olmayan açık uçlu soruda boş çerçeve görünüyordu. Çerçeve yalnız görsel
  varsa çiziliyor. Defter yazıları çizim sırasında tarayıcı metin seçimine girmiyor.
- Çocuk “Tamamlananlar” listesindeki Prova'yı tekrar açamıyordu. Mevcut sonuç ekranına
  erişim eklendi; açılışta eski deneme sonucu yenileniyor. Tam incelenmiş Prova'da
  “ebeveynin inceleyecek” açıklaması gösterilmiyor.
- İnceleme başlığındaki her isme sabit “’nin” eki eklenmesi kaldırıldı.

## Kabul senaryosu

1. Veli gerçek giriş ekranından sentetik hesabına giriş yaptı.
2. Beşinci sınıf Matematik için üç soruluk Prova oluşturdu.
3. Elle bir şıklı soru ve çizilmiş dikdörtgen görseli ekledi. İşlenen PNG
   1000×600 boyutunda açıldı, aileye özel saklama onayıyla yüklendi ve önizlemede göründü.
4. Aynı bahçe metnine bağlı iki açık uçlu soru oluşturdu. Grup ve bağımsız soru
   aynı Prova'ya eklendi; üçü birlikte çocuğa atandı.
5. Çocuk PIN'iyle çocuk moduna girildi. Şıklı soruda B seçildi, ortak metinle
   açık uçlu sorular açıldı. Deftere yazı/çizgi ve son soruya klavye cevabı eklendi.
6. Sayfa yeniden açıldı; kaydedilen defter yazısı korundu. Düzeltmeden sonra yeni
   yazı ve çizgi kaydı “Kaydedildi” durumuna döndü. Çizim sırasında pencere kaymadı.
7. Çocuk Prova'yı tamamladı: şıklı soru 1/1 doğru, açık uçlular veli incelemesinde.
8. Ebeveyn PIN'iyle geri dönüldü. Şıklı incelemede soru görseli, seçilen B ve doğru B
   görünüyordu. İki açık uçlu cevaba 100 puan ve ayrı geri bildirim kaydedildi.
   Özet 100/100 ve 2/2 puanlandı olarak yenilendi.

9. Çocuk tamamlanan Prova kartından sonucu tekrar açtı. İki veli geri bildirimi de
   görüntülendi; tamamlanmış inceleme için bekliyor mesajı çıkmadı.
10. Veli defterinde metin üzerinden kalemle çizildi: tarayıcı metin seçimi boş kaldı,
    pencere kaymadı. Deneme çizgisi geri alındı; kayıt/reopen sonrası geri bildirim korundu.

Ekran görüntüleri telefon 390×844 ve tablet 1280×800 tarayıcı boyutlarındadır.
Tamamlanmış Prova ve geri bildirim gerçek hizmetlerden okunur; yerleşim örneği veya
uydurulmuş uygulama ekranı değildir. Fiziksel cihaz ekran görüntüsü değildir.

## Otomatik doğrulama

`check-answer-recovery` testine alan sırası değişmiş gerçek biçimli defter cevabı
regresyonu eklendi: düzeltmeden önce başarısız, sonra başarılı. Daha yeni metnin,
katman sırasının ve çizgi noktası sırasının farklı sayıldığı da doğrulanır.
Mobil tip/lint geçti; notebook layout ve answer recovery toplam 16/16 kontrol geçti. Core testleri 37 dosyada 238/238 geçti.

## Sınırlar / sonraki işler

- Yeni ailede Prova ders seçimi hâlâ aile kütüphanesine bağlı; hazır sınıf/okul
  önerileri ayrı iyileştirme olarak açık. Serbest ders ekleme çalışıyor.
- Fiziksel kalem, iOS modal yön değişimi ve Android cihaz kabulü bu tarayıcı turunda
  yapıldı sayılmaz. Bu değişiklikler TestFlight18'in içinde değildir.
- Bu tur yeni AI üretimi veya yeni AI puanlaması yapmadı; ücretli AI kabulü önceki
  sunucu raporundadır. Google/Apple giriş, gerçek ödeme ve bildirim teslimi ayrı açık
  kabul maddeleridir.
- Yerel derleme sırasında statik çıktı değiştiği için bir eski sekmede chunk404
  görüldü; derleme tamamlandıktan sonra tam sayfa açılarak test tekrarlandı. Bu olay
  ayrı test ortamı kesintisidir, canlı kullanıcı hatası diye raporlanmadı.

## Temizleme ve teslim

Normal hesap-silme akışıyla sentetik Auth hesabı ve aile kaldırıldı; Auth404 ve boş
aile sorgusu doğrulandı. Kaynak satırları ve yüklenen tek PNG nesnesinin Storage'dan
silindiği ayrıca kontrol edildi. Geçici kimlik bilgileri dosyası silindi.
Son derlemedeki veli inceleme turunda konsol hatası 0 (iki React Native web uyarısı).

| Görünüm | Telefon | Tablet |
|---|---|---|
| Şıklı soru inceleme | [Telefon](parent-choice-phone.png) | [Tablet](parent-choice-tablet.png) |
| Defter inceleme | [Telefon](parent-notebook-phone.png) | [Tablet](parent-notebook-tablet.png) |
| Çocuğa geri bildirim | [Telefon](child-feedback-phone.png) | [Tablet](child-feedback-tablet.png) |

Yayın kaydı PR/Cloudflare sonucunda ayrıca doğrulanır; bu rapor tek başına yayına
çıkıldığını veya TestFlight18'in güncellendiğini söylemez.
