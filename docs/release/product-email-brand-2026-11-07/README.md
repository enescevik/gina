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
- Canlı yayın ve Gmail teslim kanıtı aşağıdaki takip kaydında tamamlanacaktır.

## Sınırlar

- Bildirim izni açık kullanıcıya giden duyurular ve iletişim adresi doğrulama e-postaları kapsamda. Tüm görev olaylarına yeni otomatik e-posta tetikleyicisi eklenmedi.
- Önceki H04 SMTP makbuz kesintisi/ikinci gönderim riski bu görünüm değişikliğiyle çözülmüş sayılmaz.
- Outlook/iOS Mail/dark mode fiziksel kabulü ayrıca açık; fallback düz metin mevcut.
