# Haftalık AI özeti — erişim ve ücretli işlem kabulü

4 Kasım 2026, 088000 + `ai-weekly-summary`. Yeni aile ekranı veya haftalık ortak değerlendirme akışının tamamlandığı anlamına gelmez.

## Bulunan fark ve düzeltme

Eski `get_weekly_summary_data` aile claim'i yokluğunu hizmet hesabı sayabiliyordu; çocuk rolü de kendi ailesindeki diğer çocukların özet girdisine erişebiliyordu. Yeni kontrol yalnız canlı aile üyeliğiyle kendi ailesinin velisine veya gerçek hizmet rolüne izin verir. Eksik claim, çocuk, başka aile ve ayrılmış veli reddedilir. Takma adlandırma tek başına yetki kontrolü değildir.

Kaynak yalnız aile saat diliminde tamamlanmış son sekiz haftadan bir Pazartesi olabilir. Henüz bitmeyen hafta, gelecekteki veya çok eski tarih, sonsuz/geçersiz tarih reddedilir. Girdi çocuk adı, doğum tarihi, okul, görev başlığı, belge veya özel not taşımaz. Sınıf, takma ad, kayıtlı görev durumlarının sayımı ve o hafta onaylı görevlerden gelen pozitif yıldız toplamı vardır. Bunlar tüm planlanan görevlerin tamamlanma oranı değildir; ödül harcaması başarısızlık diye yorumlanmaz. Eski, tekrarları açılmamış gelecek etkinlik sayımı kaldırıldı.

## Tek ücretli iş ve kurtarma

- İlk çağrıda aile/hafta için girdi, model, token sınırları, istem ve çıktı şeması özel sunucu kaydında sabitlenir. Model veya veri sonradan değişince aynı hafta bağımsız olarak yeniden üretilmez.
- Mevcut AI işlem altyapısı `weekly` işlemiyle kullanılır: paket/global kapatma, model etkinliği, aylık/dakikalık/eşzamanlı sınır, sağlayıcı kesintisinde duraklama ve süreli işlem sahipliği.
- Başlangıç politikası: ücretsiz kapalı; `ai_weekly` hakkı olan paketlerde ayda beş, dakikada üç, aynı anda bir. Mevcut yönetim ekranından değiştirilebilir; paket hakkı ayrıca sunucuda aranır.
- Eşzamanlı iki istek yalnız bir üretim başlatır. Sonucu belirsiz çağrı otomatik ücretli tekrara dönmez. Yetkili operatör, sağlayıcı kaydını inceleyip gerekçeli izin verebilir.
- Sonuç önce AI işine kaydedilir. Aile özeti kaydı/yanıtı kaybolursa aynı ücretli sonuç kullanılır. Özet yalnız aynı bağlama bağlı, tamamlanmış işten yazılabilir; başka haftanın işi bağlanamaz.
- Eski hizmet hesabının doğrudan `ai_summaries` yazma yetkisi kapatılır; yazma yeni güvenli RPC ile yapılır. Geç gelen eski çalışan yeni bağı atlayamaz.
- Çocuk silinince ailede onu içeren ortak türetilmiş özetler/bağlamlar temizlenir. İşlerin içerikleri silinir ve eski işlem sahipliği geçersizleşir; kullanım sayımı korunur. Silinmiş bağlama operatör tekrar izni de veremez.
- Eski v1 özetler v2 üretim girdisi olarak tekrar kullanılmaz. Üretilen metin veli önerisidir; pedagojik/psikolojik tanı veya doğrulanmış yeterlilik sonucu değildir.

## Doğrulama

- 46 yeni SQL; mevcut takma adlama testi dinamik kapalı haftaya ve açık erişim reddine uyarlandı. Toplam 66 dosya / 1851 kontrol.
- Dört gerçek eşzamanlı DB kabulü: aynı hafta, iki hafta arasında tek hak yarışı, sonuç kaydı tekrarı, üretim/çocuk silme yarışı. Yalnız silinen geçici audit klonlarında.
- 17 Edge testi (beş haftalık handler + 12 ortak AI işlem testi): yanlış/çok büyük istek, yetki/kaynak/model kapısı, donmuş bağlam, belirsiz sonuç, kayıp kayıt yanıtı, bozuk/eksik/yinelenen etiketler, sağlayıcı çağrısız önbellek kurtarması.
- Edge/core/backoffice tip ve backoffice lint kontrolleri. Yönetim ekranında mevcut tabloya Türkçe işlem adı eklendi; yeni tasarım yok.

Gerçek sağlayıcı çağrısı veya aile kaydı kullanılmadı. JSON/etiket kontrolü metnin her iddiasını pedagojik olarak doğrulamış sayılmaz. Gerçek sağlayıcı, içerik değerlendirmesi, fiziksel cihaz ve üretim kabulü açıktır.

## Dağıtım sırası

Üretim/TestFlight 17 değişmedi. Yayın zamanı yeni Edge önce dağıtılır: 088000 yoksa yeni RPC bulunamayacağı için güvenli biçimde başarısız olur; ücretli çağrı başlamaz. Ardından 088000 uygulanır ve sentetik kapalı haftayla kontrollü kabul yapılır. Edge ve migration tek yayın değişikliği olarak izlenir. Eski doğrudan yazıcı geri açılmaz.

Yerel audit DB'de `pg_cron` bulunmadığından 12 aylık bağlam/iş temizliği zamanlanamadı. Üretimde cron görevinin varlığı dağıtım kabulünde ayrıca kontrol edilmelidir. Özet tablosunun mevcut 12 aylık temizliği korunur. Haftalık ortak aile değerlendirmesi ekranı ayrı açık kapsamdır.
