# Görev gönderim kimliği — 090000

4 Kasım 2026. Yeni tasarım veya mobil ekran değişikliği yoktur. Mevcut görev tamamlama/geri gönderme/onay/geri alma sözleşmesinin kayıt güvenliği güçlendirildi.

## Doğrulanan sorunlar ve düzeltme

- Eski `complete_task`, yalnız `client_id` eşleşmesinde bulunan tamamlanma satırını döndürüyordu. Geçerli kendi görevini gönderen bir kullanıcı, başka aileye ait bilinen işlem kimliğini kullanınca o ailenin satırını alabiliyordu. **İzole testte yeniden üretildi.** Artık işlem kimliği aile, çocuk, şablon ve güne bağlıdır; eşleşmeyen bağlam açık hata alır.
- Geri gönderilen görev yeni kimlikle tekrar yollandığında satırdaki eski kimlik unutuluyordu. Eski istek daha sonraki bir geri gönderimden sonra tekrarlanırsa yeni gönderime dönüşebiliyordu. Özel kalıcı makbuz eski kimlikleri korur; eski istek yalnız mevcut durumu okur, geçiş yaratmaz.
- Kullanıcı tamamlanma işaretini geri aldığında satır silinir, makbuzda geri alınmış işlem izi kalır. Aynı istek bunu geri oluşturamaz; yeni açık kullanıcı eylemi yeni kimlikle mümkündür.
- `undo_complete` artık onay akışıyla aynı satır kilidini alır. Onay işleminden önce okuduğu eski `done` durumuna dayanıp, onaydan sonra onaylı kaydı silme yarışı kapandı.
- Görev haftanın seçilmemiş gününde gönderilemez; istemcinin tekrar takvimi ile sunucu kontrolü eşleşir. Boş istek/tarih ve sonsuz tarih reddedilir.

## Kabul

27 yeni SQL ile 68 dosyada 1936 kontrol. Altı gerçek eşzamanlılık senaryosu:

1. Aynı isteğin iki gönderimi → bir makbuz/bir tamamlanma.
2. Aynı kimlikle iki farklı görev → bir kayıt, diğerinde bağlam çakışması.
3. İki cihazın aynı onaysız görevi tamamlaması → tek tamamlanma/tek yıldız yazımı.
4. Eski isteğin tekrarı ile yeni açık yeniden gönderim → yalnız yeni işlem durumu değiştirir.
5. Geri alma ile eski isteğin tekrarı → kayıt geri oluşmaz, makbuz geri alınmış kalır.
6. Onay satır kilidini tutarken geri alma → onaylı kayıt ve yıldız korunur, geri alma reddedilir.

SQL yalnız `gina_completion_audit`, yarışlar silinen `gina_*_audit` klonlarında çalıştırıldı. Gerçek aile/demo kayıtları değiştirilmedi. `scripts/test-task-submission-races.py --template gina_completion_audit` yalnız açıkça adlandırılmış denetim şablonunu kabul eder.

## Sınırlar ve yayın

Migration mevcut satırlarda bulunan son işlem kimliklerini içeri alır. **Eski sürümün daha önce üzerine yazıp kaybettiği kimlikler geçmişten yeniden üretilemez.** Yeni kalıcı makbuzlar bundan sonraki işlemleri korur. Satırın güncel durumu döner; yanıtın ilk durumunun sabit görüntüsü olduğu iddia edilmez. Mevcut etkin şablon, canlı aile/cihaz ve yedi günlük gönderim kontrolleri korunur.

Aile/çocuk/şablon silme makbuzları da kaldırır; yalnız tamamlanmayı geri alma kimlik izini korur. Tablolar doğrudan istemciye açılmaz. İlgili silme/yabancı anahtar yolları indekslidir.

090000 henüz üretime uygulanmadı. Bu güvenlik düzeltmesi de kullanıcının tüm kapsam sonrası yayın kararına göre yayın paketindedir; TestFlight 17 değişmedi. Bu belge bütün uygulamanın güvenlik denetiminin tamamlandığı anlamına gelmez.
