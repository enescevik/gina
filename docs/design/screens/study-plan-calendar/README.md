# Veli çalışma planı → takvim

3 Kasım 2026. Mevcut çalışma planı ekranına, kullanıcının ortak onaylı tasarımı uyarlama izniyle eklenen işlev. Yeni bağımsız tasarım onayı veya fiziksel cihaz testi değildir.

## Kullanım

Prova sonucundan oluşturulan çalışma planında gözlem ile AI önerisi ayrılır. Günler başlangıçta seçili değildir. Veli uygun günleri seçer; tarih, saat, süre, başlık ve etkinlik açıklamasını değiştirebilir. Form yalnız “Tarih, saat ve içeriği düzenle” ile açılır. İlk önerilen tarih yarındır; kaynakta atlanan gün numaraları korunur.

“Gözden geçir” henüz kayıt oluşturmaz. Son adım seçilen kayıtları, aile saat dilimini, mevcut takvimde görülen çakışmaları ve yaratılacak etkiyi gösterir. “Takvime ekle” atomik olarak yalnız seçilen günleri ekler ve planı onaylı yapar. Görev veya yıldız yaratılmaz; önceki etkinlikler silinmez. Etkinlik açıklaması takvim gündeminde, çocuk ayrıntısında ve veli etkinlik penceresinde okunur; mevcut genel etkinlik düzenleyicisi başlık/zamanı değiştirir, bu açıklamayı korur.

Kayıp yanıt cihazdaki istekle kurtarılır. Sunucuda işlem makbuzu, plan satırı kilidi, plan güncellik kontrolü ve plan–gün tekilliği vardır. Silinen etkinliğin bağlantısı geçmiş olarak kalır; aynı öneri sessizce yeniden oluşturulamaz. Plan arşivlenmesi takvim kayıtlarını silmez. Çocuk başka aileye bağlıysa, kullanıcı veli değilse veya plan arşivliyse yeni uygulama reddedilir.

## Kanıt

- `phone.png` (390×844), `tablet.png` (1280×800): gerçek React Native Web ekranında kontrol adımı; resim maketi değildir. Kaydırılmış ekran bölümleridir.
- `saved-phone.png`: kayıp yanıt ve yeniden açılıştan sonra doğrulanmış günler.
- `qa-fixture.cjs`: yalnız `ginaqa.supabase.co` sahte aile/veri; gerçek API, ücretli AI veya üretim kaydı yok.
- Web: iki gün seç → süreyi düzenle → önizle → sunucu kabul ettikten sonra yanıtı kes → sayfayı yeniden aç → aynı istekle kontrol et. İki gönderim, **aynı istek**, iki etkinlik ve sıfır bekleyen yerel kayıt.
- 46 SQL dosyası / 1.118 kontrol; yeni akış için 25 kontrol. Üç gerçek eşzamanlı yarış kendi geçici audit veritabanlarında; aynı istek, farklı istekle aynı gün ve eski plan görüntüsüyle farklı gün.
- 100 çekirdek testi; tarih/saat dilimi, yaz saati boşluğu, seçim, plan içi çakışma, tekrar eden ders/iptal ve çok günlük aile etkinliği dahil. Mobil typecheck/lint geçti.
- Yerel uzun ömürlü Metro testi bir kez bellek sınırında kapandı. QA sunucusu yeniden başlatıldı ve kayıp yanıt testi baştan başarıyla tekrarlandı. Bu geliştirme sunucusu olayı fiziksel uygulama çökmesi veya düzeltilmiş native bellek sorunu sayılmaz.

## Sınırlar

Mevcut takvim çakışmaları kontrol anındaki uyarıdır; başka cihazın sonradan eklediği bir etkinliği engelleyen rezervasyon sistemi değildir. Plan içindeki çakışma sunucuda reddedilir. Tarih/saat düzenlemesi mevcut kontrollü alanları kullanır; yeni tarih seçici bağımlılığı eklenmedi. Kayıt henüz gönderilmeden yapılan form düzenlemeleri cihazda saklanmaz; belirsiz gönderim saklanır. Gerçek iPhone/iPad, VoiceOver ve Android kabulü açık. Migration `20261103062000` üretime uygulanmadı; TestFlight 17 değişmedi.
