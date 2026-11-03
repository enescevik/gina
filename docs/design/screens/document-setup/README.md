# Belgeden görev, ödül ve hedef kaynağı — 4 Kasım 2026

Mevcut onaylı GINA sihirbazının ortak bileşenleri kullanılır; yeni görsel yön veya maskot yok. Fotoğraf/PDF → ayrı saklama ve AI paylaşım izinleri → en fazla üç düzenlenebilir öneri → çoklu seçim → gün/yıldız düzenleme → veli onayı → atomik kayıt. Hedef, mevcut ödül seçimi üzerinden aynı kaynak belgeye ulaşır; bağımsız ve otomatik bir hedef oluşturulmaz.

## Doğrulama

Gerçek React Native Web bileşenleri, 390×844 telefon ve 1280×800 tablet. `qa-fixture.cjs` yalnız sentetik aile/ağ yanıtları kullanır; gerçek aile verisi veya ücretli AI sağlayıcısı çağrılmadı. Dosya seçicisine sentetik PDF verildi; bu, PDF ayrıştırıcısının veya model okuma kalitesinin testi değildir.

- Dosya seçildiğinde yükleme/AI çağrısı yok. Yalnız saklama izni verilince üretim kapalı; iki ayrı izin ve üret düğmesiyle devam edilir.
- İlk üretim cevabı testte kesildi. Tam sayfa yeniden açılışında özgün belge/istek kimliği ve gövde korundu. İkinci ağ isteği aynı kaydı aldı: test sağlayıcısı bir kez üretim yaptı.
- İki görev birlikte seçildi; günler başlangıçta boş, gün seçmeden ilerleme kapalı. Pazartesi ve cuma ayrı seçilip tek işlemde kaydedildi. Kayıtlardaki kaynak kimliği aynı kaldı.
- İki ödül birlikte seçildi ve kaydedildi. Katalogda kaynak bağlantıları göründü. Hedef seçiminde ödülün kaynak bağlantısı gösterildi.
- Kaynak bağlantısı yeni sekmede sentetik özel belgeyi açtı; gerçek imzalı Storage URL/yerel PDF açma kabulü ayrıca yapılacak.
- İlk seçimde henüz işlevi olmayan sabit “Devam et” kaldırıldı. Elle seçim yapıldığında görünür; AI seçiminde önerileri düzenle düğmesi sonraki adıma taşır. Uzun belge adları iki satırla sınırlıdır.
- Core: 116 test. AI Edge: bu artım için 23 kontrol. SQL: 53 dosya, 1.355 kontrol. Dört gerçek PostgreSQL yarış senaryosu geçti: aynı AI isteği, aynı belge bağlantılı kayıt, kayıt sırasında temizlik, silme önce kazanırsa kayıt reddi. Bütün DB kontrolleri izole denetim veritabanında.
- Mobil tip kontrolü ve lint geçti.

## Görüntüler

- `consent-phone.png`: dosya ve ayrı onaylar.
- `selected-tablet.png`: iki öneriyi bir arada seçme.
- `review-phone.png`, `reward-review-phone.png`: kayıt öncesi veli kontrolü.
- `saved-phone.png`, `saved-tablet.png`, `rewards-tablet.png`: kaydedilen öğeler ve kaynak bağlantısı.

## Sınırlar ve dağıtım

075000 göçü ve yeni `setup-suggestions` birlikte dağıtılmalı; önce sunucu, sonra istemci. Kaynak yüklemenin mevcut `sources.enabled`, özel bucket/Edge/temizlik kurulumları geçerli. Yeni paket eklenmedi. Henüz üretime/TestFlight’a gönderilmedi; yayımlanan sürüm 17 değişmedi.

AI sağlayıcısı sonucu belirsizse aynı istek otomatik tekrar üretilmez. Veli açıkça isteği bırakıp yeni üretim seçerse bu yeni kullanım olabilir. Sonucu alınmış öneriler cihazda saklanır; çıkışta silinir. Gerçek belge bytes’ları bu kayıt defterine yazılmaz. Yükleme tamamlanmadan uygulama kapanırsa dosyanın yeniden seçilmesi gerekebilir. Kaydedilmemiş belge, mevcut 24 saatlik sahipsiz kaynak temizliğine tabidir. Düzenleme adımındaki gönderilmemiş form alanları tam otomatik taslak değildir.

Tarih/saat veya tek seferlik ödev bu akışta sessizce tekrarlanan göreve çevrilmez: öneriler destekleyici alışkanlık/ortak zaman taslaklarıdır; günleri veli seçer. Tam ödev/ders/kurs planlama akışı ayrı açık madde. Gerçek sağlayıcı belge okuma kalitesi, iPhone/iPad dosya seçimi, uygulama kapatıp açma ve VoiceOver kabulü tamamlanmış sayılmaz.
