# Görevler — onaylı tasarımın uygulaması

Onay kaynağı: `proposal-v1.png`. Kullanıcı görevler tasarımını onayladı; bu teslim veli görev listesi ve yeni görev formunu uygular. Ödüller yalnız bir sonraki tasarım önerisidir.

## Korunan davranışlar

- Çocuk başına görev şablonları; aktif/duraklatılmış görevler ve yeniden etkinleştirme.
- Görev adı, mevcut tüm simgeler, 0–10 yıldız ve en az bir tekrar günü.
- Mevcut başlangıç tarihi/aile saat dilimi ve onay gereksinimi varsayımları.
- Aynı Supabase tablo ve yetkiler; yeni paket veya migration yok.

## Uygulama kararları

Krem zemin, mevcut onaylı logo ve kitaplı mint maskot, mor saten düğmeler, pastel simge alanları ve Nunito yazı ailesi kullanıldı. Maketteki üretilmiş harfler ve ikonlar kaynak dosya değildir; mevcut uygulama fontu ve TaskIcon SVG seti korunmuştur. Sahte bildirim noktası eklenmedi. Görev yıldızları puanlama ölçeği değil gerçek kazançtır; maketteki sönük üçüncü yıldız bu nedenle kullanılmadı.

Telefonda tek sütun, 900 dp ve üzerinde iki sütun görev listesi bulunur. Yeni görev düğmesi ve formun kaydetme alanı görünür kalır; içerik kaydırılır. iOS modalı kendi SafeAreaProvider'ıyla sistem çentiği ve alt güvenli alanı korur. Form hata durumunda değerleri kaybetmez; kaydedilmemiş taslak çıkışında uyarır.

Veli görev önbelleği çocuk tarafının yalnız aktif kayıtları içeren önbelleğinden ayrıldı. Kayıt/duraklatma sonrasında veli, çocuk ve ana ekran verileri geçersizleştirilir. Güncelleme id, child_id ve family_id ile sınırlandırılır; bulunmayan/yetkisiz kayıt başarı gibi gösterilmez.

## Doğrulama

- `pnpm turbo run lint typecheck test`: 7/7 iş başarılı, 22 çekirdek testi geçti.
- Expo web export başarılı.
- `docs/release/evidence/tasks-premium/check.cjs`: oluşturma, duraklatma/sürdürme, başarısız kayıt ve tekrar deneme, yıldız sınırı, zorunlu gün, taslak koruması, çocuk ayrımı, 48 dp hedefler.
- `states-check.cjs`: yükleme hatası/tekrar deneme, çocuksuz aile yönlendirmesi, 320 px liste ve form taşma denetimi.
- 390×844 telefon ve 1280×800 tablet ekranları gerçek uygulamanın web çıktısından alındı. Bunlar tasarım üretimi değildir; yalıtılmış örnek veriler kullanılır.
- iPhone 17 Pro / iOS 26.5 simülatöründe kayıt ve duraklatma başarılı; form güvenli alanı görsel olarak doğrulandı. Native kanıt dosyaları simülatör çerçevesi ve geliştirme göstergelerini içerir. Gerçek iPhone 14 Pro Max, Android cihaz ve native iPad üzerinde bu turda test yapılmadı.
- Gerçek geliştirme/üretim veritabanı kayıtları değiştirilmedi. TestFlight'a gönderilmedi.

Görüntüler ve referans karşılaştırması: `index.html`.
