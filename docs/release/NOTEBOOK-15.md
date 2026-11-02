# Çözüm defteri — TestFlight 15

2 Kasım 2026. Kullanıcının onayladığı ikinci telefon/tablet maketi uygulandı. Kaynak commit `dab1f66dc7d311de8329e454e6b66ee0a5f6549b`, EAS build `07aabe77-73fc-480d-8886-76dc5813ab93`, hedef `0.1.0 (15)`. **0.1.0 (15) TestFlight’ta iç test hesabına açıldı. Apple durumu `VALID / IN_BETA_TESTING`, süresi dolmamış; 2 Kasım 2026 son kontrolünde doğrulandı.**

## Bu sürümde denenecekler

1. Çocuk modunda açık uçlu sorusu olan bir Prova aç. Telefonda Soru/Defter sekmelerini, tablette yan yana düzeni gör.
2. Tablette Genişlet ile soru bölümünü kapatıp defteri büyüt; Soruyu aç ile geri dön. Telefonda soru görseli önizlemesini daraltıp aç.
3. Kalemle çiz; kaleme tekrar dokunarak renk ve kalınlık ayarlarını aç. Silgi, seçim/taşıma, yazı ve sembolleri dene. Telefonda ek araçlar üç nokta menüsündedir.
4. Soruda metin olarak verilen ölçü varsa Verilenler düğmesinden deftere al. Soruyla ilişkilendirilmiş görsel varsa Sorudan deftere al içinden tamamını veya bir bölümünü seç.
5. Kaydedildi yazısını gördükten sonra sonraki soruya git ve geri dön; çözümün korunmalı. Hata mesajı varsa başarılı kayıt sayılmaz; yeniden denemeden uygulamayı kapatma.
Süreli Prova’da Ara ver ile ekrandan çıkmak süreyi durdurmaz; zaman sınırı sunucuda devam eder.

6. Veli hesabında aynı denemenin incelemesini aç; çocuğun defterini gör ve elle değerlendir.

## Kanıt

- [Onaylı maket](../design/screens/prova-notebook/phone-tablet-refined-v2-proposal.png)
- [Telefon uygulaması](../design/screens/prova-notebook/phone-refined-v2-web.png)
- [Tablet uygulaması](../design/screens/prova-notebook/tablet-refined-v2-web.png)
- [Kontrol kaydı](../design/screens/prova-notebook/refined-v2-review.json)

Görüntüler çalışan Expo web ekranından, sentetik sorular ve izole test veritabanıyla alındı. Fiziksel iPhone ekran görüntüsü değildir. 320/390/1280 genişliklerinde kontrol, kayıt/navigasyon/yenileme, görsel aktarımı, çizim, silgi, kalınlık ve geri alma/yineleme denendi. Workspace lint/tip/test (7 görev, 38 core test), GitHub CI ve iOS Hermes paketlemesi geçti.

Eski iPhone simülatör geliştirme uygulaması Metro bağlantısında JavaScript yerine HTML yanıtı aldı; bu turda native ekran etkileşimi doğrulanmış sayılmaz. Gerçek cihaz kalem gecikmesi, Apple Pencil basınç/eğim/avuç içi reddi ayrıca sınanmalı. Çizgi kalınlığı elle seçilir; basınçtan türetilmez.

## Korunan sınırlar

- Kaydedilmemiş çizimler için kalıcı çevrimdışı kuyruk yok; uygulamayı zorla kapatmak gönderilmemiş düzenlemeyi kaybettirebilir.
- Defter içeren yanıtları AI henüz görsel olarak değerlendirmez; yanlış bir metin-only değerlendirme yerine veli incelemesine yönlenir.
- Sürümlü ortak görsel/metin ve çoklu soru ilişkisi, veli not katmanı ve gelişmiş gelişim raporu sonraki aşamadır. Arayüz gerçek veri olmadan “ortak görsel / 1–3” bilgisi üretmez.
- `sources.enabled` ve `cohorts.enabled` üretimde kapalı kalır; bu yayın özellik bayraklarını değiştirmez. Mevcut AI soru üretimi ayrı akıştır.
- Yeni kütüphane soru üretimi 0; 77 sınıf–ders hücresi için 20'şer aday hedefi henüz teslim edilmiş değildir.

Üretim şeması önceki artımda `20261102160500_group_notebook_guard` dahil dağıtıldı. Bu görsel düzeltme yeni üretim migration'ı veya gerçek aile kaydı değişikliği yapmaz. Test kopyaları ve geçici test oturumları temizlendi.

## Gönderim yolu

Expo gönderimi `7bed1383-3343-4b4f-b851-7fe7679cca97` sırada beklediği için, Apple altool paket doğrulaması hatasız tamamlandıktan sonra iptal edildi. İptal durumu doğrulandı; aynı 0.1.0 (15) IPA dosyası Apple’ın resmi aracıyla doğrudan yüklendi. Yükleme `UPLOAD SUCCEEDED with no errors`, teslim kimliği `5830915d-b38a-4789-81c0-bd2449c08274`. Yeni anahtar oluşturulmadı; mevcut gönderim anahtarı yalnız yüklemede kullanıldı. Expo’daki iptal kaydı Apple yüklemesinin başarısız olduğu anlamına gelmez.

Apple son kontrol zamanı (UTC): `2026-11-02T17:31:49.937977+00:00`. Yükleme için geçici yerel dosyaya alınan özel anahtar işlem sonunda silindi.
