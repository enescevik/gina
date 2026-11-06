# Ürün e-postalarında onaylı marka tasarımı

Ürün e-postası SMTP bağlantısı başarılı olsa da gövde yalnız düz metindi. Kullanıcı, brand sohbetinde onayladığı hesap e-postası tasarımının ürün bildirimlerinde de kullanılmasını istedi.

## Değişiklik

- Kaynak: `supabase/templates/confirm.html` ve `reset.html`. Aynı logo, cihaz/aile maskotları, mint başlık alanı, mor düğme, yazı boyutları ve 560 px duyarlı yerleşim.
- Ürün adres doğrulaması: cihaz maskotu, görünür kod, doğrulama düğmesi, süre ve isteği kendisi göndermeyen kullanıcı için açıklama.
- Duyuru: aile maskotu, gerçek duyuru başlığı/gövdesi, GINA gelen kutusuna bağlantı ve e-posta iznini kapatma bağlantısı.
- TR/EN hesabın diline göre. Yönetici metni HTML olarak çalıştırılmaz; kaçış uygulanır, satır sonları korunur. URL'ler HTTPS olmalı.
- SMTP, HTML ve düz metni `multipart/alternative` olarak birlikte yollar. UTF-8 ve List-Unsubscribe başlıkları korunur. Büyük ileti için kısmi TCP yazımı tamamlanır.
- Auth şablonları, Auth/Gmail anahtarları, izin modeli, kuyruk veya puanlama değiştirilmedi. Yeni paket/migration yok. Yalnız `push-send` Edge dağıtımı gerekir; TestFlight gerekmez.

## Doğrulama

- Deno check: push-send geçti.
- Deno: SMTP/Resend, kanal işçisi, marka/XSS/MIME, unsubscribe ve TLS/STARTTLS toplam **30 test geçti**.
- Auth şablon denetimi: 8 dil varyantı, hata yok.
- Tarayıcı önizleme: Türkçe 390 px ve İngilizce 320 px; yatay taşma yok, logo/maskot yükleniyor. Bu, Gmail/iOS Mail gerçek görünüm kabulünün yerine geçmez.
- `b7998528` kaynak commit'inden yalnız `push-send` yayımlandı: ACTIVE, sürüm 26. `verify_jwt=false` mevcut durumuyla korundu; işçi kendi özel sırrıyla doğrulanır (`deployment.json`).
- Gerçek üretim kuyruğundan kendi test adresimize hem doğrulama hem duyuru ulaştı: Gmail INBOX, SPF/DKIM/DMARC başarılı, HTML + düz metin birlikte (`delivery.json`). Gmail'de logo, aile maskotu, başlık, gövde, mor düğme ve izin kapatma bağlantısı görsel olarak kontrol edildi.
- Tekrar işçi çağrısı ikinci ileti üretmedi; iki gönderinin de deneme sayısı 1 (`product-verification.json`, `product-announcement.json`).
- İzin kapatma 200, tekrar çağrı `already_unsubscribed`; sonraki test bildirimi gönderilmeden `preference_off` ile atlandı (`product-unsubscribe.json`).
- Brevo'nun teslim sırasında görsel/bağlantı adreslerini yeniden yazdığı ve takip pikseli eklediği gözlendi. Ortak hesap ayarlarına müdahale edilmedi.
- Sentetik test hesabı gerçek hesap silme akışıyla temizlendi; aile, iletişim adresi ve kuyruk kalıntıları `product-cleanup.json` ile doğrulandı.

## Sınırlar

- Bildirim izni açık kullanıcıya giden duyurular ve iletişim adresi doğrulama e-postaları kapsamda. Tüm görev olaylarına yeni otomatik e-posta tetikleyicisi eklenmedi.
- Önceki H04 SMTP makbuz kesintisi/ikinci gönderim riski bu görünüm değişikliğiyle çözülmüş sayılmaz.
- Outlook/iOS Mail/dark mode fiziksel kabulü ayrıca açık; fallback düz metin mevcut.
