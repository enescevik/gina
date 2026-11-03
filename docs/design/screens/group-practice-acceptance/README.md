# Birlikte Prova — katılım ve sonuç kabulü

3 Kasım 2026. Mevcut GINA ekranı ve ortak onaylı bileşenler korundu. Yeni tasarım onayı veya fiziksel cihaz testi değildir.

## Düzeltilenler

- Katılım hatası artık açık katılım penceresinin içinde görünür.
- Tek uygun çocuk önceden seçilir; katılım ve sıralama onayları yine ayrı ve başlangıçta kapalıdır.
- Zaten katılan çocuk tekrar katılma seçeneklerinde gösterilmez. Uygun bütün çocuklar katılmışsa tekrar “Çocuğum katılsın” düğmesi yoktur.
- Tarihler cihazın konumuna göre değil ailenin saat dilimine göre gösterilir.
- Sonuç penceresi açıkken 15 saniyede güncellenir; katılım süresi sona erdiğinde pencereyi kapatıp açmak gerekmez. Genel sayfa saati de saniyede bir bütün ekranı yeniden çizmez.
- Katılım ve sıralama istekleri 20 saniyede sonuç kontrolüne döner. Hata, işlemin sunucuda geri alındığı anlamına gelmez. Kayıp katılım yanıtında katalog yenilenir; var olan katılım bulunursa doğru başarı durumu gösterilir.
- Sıralama onay penceresi iki yönü de destekler; gönderirken onay kutuları değiştirilemez.
- Bildirim testinde farklı Provaların bekleyen bildiriminin birbirini bastırdığı bulundu. 063000 yalnız Prova atama/bitişinde olay kimliğini ayırır. Mevcut görev/haftalık bildirim birleştirme kuralı korunur. Aynı bekleyen Prova bildirimi ikinci kez eklenmez. Bu, haricî push teslimatında kesin tek-sefer garantisi değildir.

## Doğrulama

- `join-error-phone.png`, `enrolled-phone.png`, `result-tablet.png`: 390×844 ve 1280×800 gerçek React Native Web ekranı, sentetik API.
- `qa-fixture.cjs`: iki onay kapalı → tek uygun çocuk otomatik seçili → hata pencerede görünür → sunucu kabulünden sonra kayıp yanıt → tek katılım bulunur → tekrar katıl düğmesi kalkar → sonuç sunucuda hazır olduğunda açık pencere güncellenir. Sıralama kendiliğinden açılmaz.
- `scripts/test-group-enrollment-races.py`: aynı çocuk iki kez (tek sınav), son aile hakkıyla iki ayrı grup (yalnız biri), iptal ile katılım yarışı. Kendi geçici audit veritabanlarını silerek biter.
- `scripts/test-notification-outbox-races.py`: aynı Prova olayı paralel gönderilince bir, farklı Provalar gönderilince iki bekleyen bildirim.
- 029 SQL testine eklenen beş kontrol: tek atama, tek bitiş, veli hedefi, doğru aile, yalnız kimlik içeren payload. 46 dosya / toplam 1.123 SQL kontrolü geçti. Mobil typecheck/lint geçti.

## Kalan kabul sınırları

Üretimde `cohorts.enabled` açılmadı. TestFlight 17 değişmedi. Gerçek iPhone/iPad/Android, push sağlayıcısına teslim ve sıralama onayının gerçek iki cihazda değişmesi açık. Eski görselsiz çoktan seçmeli kütüphaneyle grup oluşturma temel akışı var; yeni sürümlü/görselli/ortak kaynaklı kütüphane paketlerinden grup oluşturma henüz bağlı değil. Bu eksik ve editoryal içerik kabulü çözülmeden toplu Prova genel kullanıma açılmış sayılmamalı.
