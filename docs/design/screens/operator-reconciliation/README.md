# Yetkili mağaza kontrolü — kabul

4 Kasım 2026. Mevcut onaylı yönetim görünümüne eklendi. Gerçek Next ekranı; tüm servis istekleri `qa-fixture.cjs` ile sentetik yanıtlandı. Gerçek mağaza sorgusu, satın alma, iade veya aile kaydı değişikliği yapılmadı.

- `desktop.png`: 1440×1100 görünümde seçilen aile/mağaza ve gerekçeli doğrulama formu.
- `recovery-tablet.png`: 1024×1000 görünümde kayıp yanıt sonrası tam yeniden açılış; aynı kontrolü doğrulama.
- `failure-tablet.png`: aynı tablette eksik mağaza bağlantısı başarısız görünür; başarı sayılmaz.
- Bunlar tam sayfa çıktılarıdır, native cihaz kabulü değildir.

İlk başarılı kayıt yanıtı bağlantı hatasıyla düşürüldü. Yenileme sonrası aynı kimlik/içerik tekrarlandı; iki istemci çağrısında tek mağaza kontrolü ve tek iş kaydı oluştu. Kontrol geçmişi/başarı ve hata ayrımı doğrulandı. Aynı oturumda finans rolü kaldırılınca aile detayları ve kontrol alanı kapandı. Her iki ölçüde sayfa taşması yok. Form açılınca odağın işleme taşınması klavye/kaydırma erişimini sağlar.

31 SQL kontrolü; dört gerçek eşzamanlı DB yarışı; 18 sunucu testinde yetki, sınır, hata gizliliği, tekrar, eksik sağlayıcı, belirsiz sonuç ve atomik yazım kabulü var. Mevcut sağlayıcı istemcileri kullanılır. Google yalnız durum okur; bu akış satın almayı acknowledge etmez. Ücret iadesi/iptal yapmaz.

Bir kontrol kesildiğinde iki dakikalık süreden sonra aynı komut yeniden alınabilir; üç kesintiden sonra başarısız kapanır. Başka yetkili kişi de süresi dolmuş işi yeni gerekçeli kontrolle devralabilir. Eski işleyici yeni kaydı yazamaz. Saatlik sınır abonelik başına 5, operatör başına 20 yeni istektir. Tamamlanmış isteğin tekrarı kotayı tüketmez.

Bu işlem başarısız webhook kaydını otomatik “işlendi” yapmaz: abonelik güncelliği ve bildirim teslimi farklıdır. Henüz eşleşmemiş satın alma/token keşfi, mağaza olay geçmişi ve canlı mağaza kabulü ayrı açık işlerdir. Migration 074000, yeni Edge işlevi ve arayüz henüz dağıtılmadı.
