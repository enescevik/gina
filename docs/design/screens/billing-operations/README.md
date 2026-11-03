# Paketler ve ödemeler — 4 Kasım 2026

Onaylı ortak GINA dilinin yönetim ekranına uyarlaması: Nunito metin, Baloo başlık, krem zemin, mint durum özeti ve mor seçimler. Yeni logo, maskot veya alternatif tasarım yok. Masaüstünde aile listesi + ayrıntı; tablette tek sütun ve kısa aile listesi.

Gerçek Next uygulamasının sentetik API ile alınan görüntüleri:
- `desktop.png`: 1440 × 1100 görünümden tam sayfa; mağaza Plus ve geçici Pro hakkı açıkça ayrılır.
- `tablet.png`: 1024 × 1000 görünümden tam sayfa.
- `notifications-tablet.png`: eşleşmiş/eşleşmemiş işlenemeyen mağaza bildirimi.

Kontroller: aile seçimi, aileye bağlı/genel kuyruk, arama/boş liste, bağlantı hatasında son okuma uyarısı, yetki kaldırıldığında aile verisinin görünümden kalkması, yatay taşma yok. 22 SQL kontrolü canlı finans rolü, başka rolün reddi, rol bitişi/iptali, eski admin claim'i ve gizli mağaza verisinin dışarı çıkmamasını kapsar. `qa-fixture.cjs` tüm servis çağrılarını yerelde taklit eder; gerçek aileye/mağazaya bağlanmaz.

Bu görünüm salt okunur finans incelemesidir. Mağaza makbuzu, işlem tokenı, özel payload, veli e-postası ve çocuk verisi istemciye verilmez. İçerik yenileme mağaza API'sinden yeni sorgu başlatmaz. Gerçek iade başlatma, mağaza geçmişinden kurtarma ve operatörün uzlaştırma eylemleri ayrı açık işlerdir. GINA geçici hakkı, ücret iadesi olarak gösterilmez.
