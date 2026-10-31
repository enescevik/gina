# Görsel düzen revizyonu — tasarım incelemesi sürüyor

TestFlight 8 teknik kararlılık ve küçük yerleşim düzeltmeleri içeriyordu. Ekranların açılmasını kontrol etmek kapsamlı görsel tasarım değerlendirmesi değildi. Kullanıcı bu sürümün görsel kalitesini reddetti.

Bu revizyon mevcut uygulama bileşenlerini değiştirir: veli ana sayfasında büyük profil kartları, belirgin ilk çocuk ekleme, hızlı görev/çocuk alanı eylemleri; alt ekranlarda küçük gezinme çubuğu, tam genişlikte başlıklar ve isteğe bağlı açılan formlar; seçili güne odaklanan takvim; yatay çocuk odasında hedef bileti, takvim panosu ve ödül dolabı. Küçük koleksiyon görsellerinin otomatik olarak eski SVG çizimine dönmesi kaldırıldı. Veriler, mutasyonlar ve yetki kuralları değiştirilmedi.

Somut olarak yeniden düzenlenen ekranlar: veli ana sayfası ve boş durumu, görevler, takvim, notlar, puanlar, yatay telefon çocuk ana sayfası. Ortak başlık/düğme/nesne değişiklikleri diğer ekranlara da yansır; bu onların tek tek tamamen yeniden tasarlandığı anlamına gelmez. Tablet ana kompozisyonu henüz yeniden ele alınmadı.

Karşılaştırma: `index.html`. Görüntüler React Native web üretim çıktısıdır, iPhone’dan alınmış görüntüler değildir. Aynı ölçüde (430×932) önce/sonra; çocuk odası 932×430. Yeni düzen TestFlight’a gönderilmedi.

TypeScript ve lint geçti. Dört formda aç/kapat ve taslağı koruma, takvimde gün seçimi doğrulandı. Demo kayıtları değiştirilmedi. Sonraki görsel inceleme: veli Prova akışları, hesap/ayar ekranları, çocuk alt ekranları ve tablet yerleşimleri; ardından native cihaz kabulü.
