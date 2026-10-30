# Çocuk Prova · cevap kalıcılığı ve süre sonu

31 Ekim 2026. İkinci göz denetiminde saptanan hatalar: kaydedilmiş cevapların yeniden açılışta boş görünmesi; yalnız Sonraki'de kayıt; geri giderken kaydetmeme; yakalanmayan kayıt hatası; süre dolunca başarısız bitirmenin sınırsız tekrarı.

Cevaplar yazma durduktan sonra 450 ms içinde tek istek halinde otomatik kaydedilir. Hata halinde taslak ekranda kalır; yeniden deneme vardır. Önceki/Sonraki geçişleri kaydı bekler. Expo 58 `usePreventRemove`, kaydedilmemiş cevaptan çıkışı engeller ve açık bir vazgeçme seçeneği verir. Süre bitince otomatik bitirme bir kez denenir; hata sonrası yalnız kullanıcı yeniden dener. Zamanlayıcı ekran odağında çalışır ve uygulama yeniden öne gelince saati yeniler. Bitmiş deneme yeniden açıldığında yeni attempt oluşturulmaz.

`get_saved_exam_answers` yalnız question_id/answer_key/answer_text döndürür. Cevap tablosu cihazlara açılmadı; doğruluk, çözüm ve AI/veli geri bildirimi verilmez. Global soru kütüphanesi doğru cevap anahtarlarını da cihazdan gizler. Başlatma, cevap kaydetme ve bitirme RPC'leri satır kilidiyle aynı denemedeki yarışları sıralar.

`flows.js` ve `flows-qa.json`: sekiz davranış geçti; bütün API çağrıları yakalandı, demo DB'ye yazılmadı. Telefon/tablet görüntüleri production Expo web'den. Migration'lar yerel demo DB'ye uygulanmadı; pgTAP CI'da disposable DB'de çalışır. iPhone/iPad klavye, geri gezinme ve uçak modu kabulü ayrıca gerekli.
