# Alan adı ve hesap e-postaları — 6 Kasım 2026

Bu kayıt X01'in alan adı ve Supabase Auth SMTP kısmını günceller; ürün bildirimleri/SMS kurulumu değildir.

- `ginafamily.com`, `www` yönlendirmesi ve `admin.ginafamily.com` kurulmuş; yönetim Access koruması önceki doğrulama sonrası yeniden açılmıştır.
- GINA Supabase Auth, Brevo'daki ayrı GINA SMTP anahtarıyla `noreply@ginafamily.com` üzerinden gönderir. Öğretsen yapılandırması değiştirilmemiştir.
- Şifre sıfırlama, kullanıcı tarafından e-posta alma → şifre değiştirme → yeni şifreyle giriş adımlarıyla doğrulanmıştır.
- Markalı TR/EN doğrulama ve şifre yenileme şablonları canlıdır (PR #151). Markalı Türkçe reset mesajında Gmail SPF/DKIM/DMARC pass, gelen kutusu teslimatı ve görseller doğrulanmıştır. İngilizce gerçek teslimatı ve yeni hesap doğrulaması ayrı uçtan uca test edilmemiştir.
- Dil metadata güncellemesi tablet 30 kaynak commit'i `bba2b0111f750245a98b4cfd2a987432f29fb2a7` içinde vardır. C14c iOS 30 TestFlight gönderimini kaydeder; bu kayıt Apple onayı veya kullanıcının cihazına kurulmuş olduğu anlamına gelmez. Yeni bir build sırf bu değişiklik için gerekli değildir.
- Hukuk taslaklarındaki alan adı yer tutucuları güncellendi. Taslaklar yayımlanmadı; yasal kimlik/adres ve avukat incelemesi bekleniyor. E-postalarda hukuk bağlantıları yok.
- Destek e-postası için Cloudflare Email Routing MX/SPF/DKIM kayıtları kuruldu ve DNS üzerinden doğrulandı; kullanıcının onayladığı Gmail hedefi Cloudflare’da Verified, `destek@ginafamily.com` kuralı Active. Test mesajı için Cloudflare özeti `Total received 1 / Delivered-Forwarded 1` gösterdi. Gmail aynı gönderici/hedef olduğundan ayrı gelen kutusu kopyası doğrulanmadı; iletim başarısı Cloudflare kaydıyla doğrulandı. Yönlendirme, destek adresinden yanıt gönderebilen bir posta kutusu değildir.
- Haftalık pazartesi 10:00 işletim kontrolü bu Codex sohbetinde kuruldu (`gina-alan-ad-ve-e-posta-kontrol`). Hesap erişimi gerektiren kontroller erişim yoksa doğrulanmadı olarak raporlanır; 7/24 servis izleme değildir.

- Registry RDAP kontrolü: alan adı bitişi `2029-11-06T16:40:39Z` (Verisign, 6 Kasım 2026 sorgusu). Otomatik yenileme/ödeme yöntemi bu kayıttan çıkarılamaz.

- Kullanıcının sağladığı yasal ad ve adres, yalnız Git tarafından dışlanan `.codex-setup/legal-private-2026-11-06/` altındaki 10 yerel taslak kopyasına işlendi. Ev adresi uzak depoya veya web’e yüklenmedi. Posta kodu kullanıcı tarafından teyit edilip özel yerel kopyalara eklendi; hukuk incelemesi bekliyor.

- Gmail gönderici kurulumu tamamlandı: `GINA Destek <destek@ginafamily.com>`, Brevo SMTP 587/TLS. Kullanıcı ayrı `GINA Gmail SMTP` anahtarını oluşturup Gmail’e kendisi kaydetti; anahtar değeri okunmadı veya depoya yazılmadı. Gmail adres onayı başarılı. "İletinin gönderildiği adresten yanıtla" seçeneği etkin; kişisel varsayılan gönderen değişmedi. Gönderici test mesajı hedef Gmail hesabında INBOX etiketi ve doğru From adresiyle doğrulandı; farklı sağlayıcıya dış teslimat ayrıca test edilmedi.

## Düşük maliyetli başlangıç — öneri ve açık işler

- Öneri: Türkiye odaklı davetli ücretsiz beta; pazarlama ve ücretli satış sonraki aşama. Bu öneri onaylanmış ürün kapsamının veya canlı erişim/ödeme ayarlarının değiştirildiği anlamına gelmez.
- Yeni ücretli hizmet alınmadı. Mevcut destek iletimi Cloudflare → Gmail, yanıtlar Gmail → Brevo; gizlilik taslağına TR/EN teknik veri akışı eklendi.
- Güncel kaynaklardan 10 özel yerel taslak yeniden oluşturuldu; doğrulanmış ad, iletişim adresi ve posta kodu korundu. Ev adresi uzak depoya veya web’e konmadı.
- Ücretsiz beta kişisel veri yükümlülüklerini kaldırmaz. Gerçek ailelere açılıştan önce çocuk verileri, aydınlatma/veli beyanı, sağlayıcı sözleşmeleri, yurt dışı aktarım ve gerçek saklama/silme davranışları hukuk incelemesine taşınmalı. Mevcut DECISIONS.md hukuk incelemesi şartı sürer.
- KEP/VERBİS gerekliliği ve GVK mükerrer 20/B uygunluğu doğrulanmadı; hizmet satın alınması veya vergi muafiyeti varsayılmadı. Ücretli satıştan önce mali müşavir değerlendirmesi gerekir.
- Uygulamada olmayan ekranlar, planlı silme/bildirimler ve doğrulanmamış saklama süreleri taslakların yayın engelidir; bu dokümantasyon düzeltmesi bunları uygulamaz. Destek için sabit cevap süresi taahhüdü eklenmedi.
