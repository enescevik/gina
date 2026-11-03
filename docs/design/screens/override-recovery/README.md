# Geçici paket hakkı — kayıt kurtarma kabulü

4 Kasım 2026. Onaylı ortak yönetim tasarımı uyarlandı; yeni logo/palet kullanılmadı.

Gerçek Next ekranı, yalnız `qa-fixture.cjs` içindeki sentetik servis yanıtlarıyla görüntülendi. Gerçek aileye hak verilmedi/geri alınmadı; ödeme/iade yapılmadı.

- `pending-desktop.png`: 1440×1100 görünüm; kayıp yanıt ve tam sayfa yenilemesinden sonra aynı işlem korunur.
- `tablet.png`: 1024×1000 görünüm; geniş tablo yerine aile kayıt kartları ve geniş tarih alanı.
- `expire-tablet.png`: aynı tablet ölçüsünde açık gerekçe/etki formu; tarayıcı prompt'u kaldırıldı.
- Görseller full-page çıktıdır; görünüm yüksekliğinden uzun olabilir. Native cihaz kanıtı değildir.

Hak verme ve sonlandırmada sunucu işlemiş gibi davranıp ilk yanıt bağlantısı kesildi. Yenileme sonrası aynı request/payload tekrarlandı: toplam dört servis çağrısı, bir hak ve iki denetim olayı. Belirsiz işlem varken yeni form kilitli; tekrar kontrol ikinci hak oluşturmadı. Her iki ölçüde yatay sayfa taşması yok. Tablet tablosunun kesilen ilk sütunu görsel incelemede yakalandı ve kartlarla düzeltildi.

Sunucu 23 yeni pgTAP kontrolü ve üç gerçek eşzamanlı DB yarışıyla doğrulandı. Toplam 51 dosya / 1291 SQL kontrolü geçti. İstek sahibi/yük uyuşmazlığı, canlı admin iptali, tekrar grant/expire, sonlandırılmış hakkın eski grant tekrarıyla canlandırılmaması ve özel kayıt gizliliği kapsamda.

Yeni arayüz `admin_save_override` kullanır. Dağıtımdaki eski backoffice için eski grant/expire uçları uyum amacıyla kalır; eski istemcilere geriye dönük tekrar güvenliği iddia edilmez. Kayıt, yalnız gönder düğmesinden sonra kalıcıdır; gönderilmemiş form otomatik taslak değildir. Bu teslim para iadesi veya mağaza aboneliği iptali değildir. Migration 073000 ve backoffice henüz canlıya dağıtılmadı.
