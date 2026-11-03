# Göreve bağlı odak sayacı — uygulama kontrolü

Mevcut onaylı çocuk görev penceresine uyarlanmıştır. Yeni rota, ana menü veya dünya görseli yoktur. Süre seçimi görev ayrıntısında isteğe bağlı açılır; bütün görev listesine sayaçlar yığılmaz. Ortak Nunito, krem, mor ve mint bileşenleri kullanılır.

- `phone.png`: gerçek React Native Web bileşeni, 390×844, süre seçimi.
- `tablet.png`: 1280×800, duraklatılmış sayaç (ilk kontrol).
- `finished-tablet.png`: 1280×800, süre doldu; görev hâlâ tamamlanmamış.
- `qa-fixture.cjs`: yalnız sahte cihaz oturumu/veri; ginaqa alanına yönlenen tüm HTTP cevapları yerel olarak taklit edilir. Gerçek aileye veya veritabanına yazmaz.

## Kontroller

5/10/15/25 dakika, başla/duraklat/devam, 5 dakika mola, erken mola sonu, sayaç bitirme onayından vazgeçme, yeniden açılışta duraklamanın korunması ve süre dolması uygulama üzerinde kontrol edildi. Hızlandırılmış saatle bitişte sunucu POST sayısı **0**, görev hâlâ “Hazır olduğunda başlayabilirsin”. Çekirdek testleri hesap/aile/çocuk/gün ayrımı, eşzamanlı pencere çakışması, kayıt hatası, bozuk kaydı silme ve çıkış sonrası eski yazıcıyı da kapsar.

Süre cihazda saklanır, kapalı uygulamada zaman ilerler. Mola sonunda odak kendiliğinden başlamaz. Süre bitişi yıldız veya başarı vermez; görevin mevcut tamamlama/onay yolu değişmez. Sayaçlar cihazlar arasında eşitlenmez, gelişim raporuna çalışma süresi kanıtı olarak yazılmaz. Saat ileri alınırsa sayaç erken bitebilir; geçmiş çalışma zamanı veya yıldız üretmediği için bu bir ödül açığı oluşturmaz. Çalışan süreçte geri alınan saat sayacı duraklatır; cihaz kapalıyken saat değişikliğini güvenilir biçimde ayırt etmek mümkün değildir.

TypeScript ve Expo lint geçti. Çekirdek 92 test geçti (11 yeni odak kontrolü). Görseller web kanıtıdır; fiziksel iPhone/iPad/Android arka plan ve ekran okuyucu kabulünün yerine geçmez. Bildirim veya arka plan sesi eklenmedi. TestFlight'a henüz gönderilmedi.
